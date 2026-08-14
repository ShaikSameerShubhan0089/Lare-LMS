"""Auth business logic: registration, login, token issue/rotation, RBAC.

Implements refresh-token rotation with reuse detection (AU-2): each refresh
issues a new token in the same family and revokes the old one; presenting an
already-rotated (revoked) token revokes the whole family.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from lare_common.errors import Conflict, Forbidden, TooManyRequests, Unauthorized
from lare_common.security import (
    create_access_token, hash_password, hash_token, new_id, random_token,
    verify_password,
)

import secrets

from .config import AuthConfig
from .models import RefreshToken, Role, User, UserRole, VerificationToken


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class AuthService:
    def __init__(self, cfg: AuthConfig):
        self.cfg = cfg

    # ---------- helpers ----------
    def _role_names(self, s: Session, user: User) -> list[str]:
        rows = s.execute(
            select(Role.name)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user.id)
        ).scalars().all()
        return sorted(set(rows))

    def _college_ids(self, s: Session, user: User) -> list[str]:
        rows = s.execute(
            select(UserRole.college_id).where(
                UserRole.user_id == user.id, UserRole.college_id.is_not(None)
            )
        ).scalars().all()
        return sorted({r for r in rows if r})

    def _issue_tokens(self, s: Session, user: User, device: str | None,
                      family_id: str | None = None) -> dict:
        roles = self._role_names(s, user)
        access = create_access_token(
            subject=user.id,
            roles=roles,
            tenant_id=user.tenant_id,
            college_ids=self._college_ids(s, user),
            alg=self.cfg.JWT_ALG,
            signing_key=self.cfg.signing_key,
            issuer=self.cfg.JWT_ISSUER,
            audience=self.cfg.JWT_AUDIENCE,
            ttl_minutes=self.cfg.ACCESS_TOKEN_TTL_MIN,
            # Product scope — the Gateway uses this to keep a Learn session out of
            # Hire and vice versa. The two products are separate accounts.
            extra={"product": getattr(user, "product", "learn")},
        )
        raw_refresh = random_token()
        rt = RefreshToken(
            id=new_id(),
            user_id=user.id,
            family_id=family_id or new_id(),
            token_hash=hash_token(raw_refresh),
            device=device,
            expires_at=_utcnow() + timedelta(days=self.cfg.REFRESH_TOKEN_TTL_DAYS),
        )
        s.add(rt)
        return {
            "access_token": access,
            "refresh_token": raw_refresh,
            "expires_in": self.cfg.ACCESS_TOKEN_TTL_MIN * 60,
        }

    # ---------- use cases ----------
    def register(self, s: Session, email: str, password: str,
                 full_name: str | None, product: str = "learn") -> User:
        # Accounts are per-product: the same email may register once for Learn and
        # once for Hire, each with its own password. Uniqueness is (email, product).
        exists = s.execute(
            select(User).where(User.email == email.lower(), User.product == product)
        ).scalar_one_or_none()
        if exists:
            raise Conflict("Email already registered", code="email_taken")
        user = User(
            id=new_id(),
            email=email.lower(),
            product=product,
            password_hash=hash_password(password, rounds=self.cfg.BCRYPT_ROUNDS),
            full_name=full_name,
            tenant_id=self.cfg.DEFAULT_TENANT_ID,
        )
        s.add(user)
        s.flush()
        return user

    def mint_drive_token(self, s: Session, email: str, full_name: str | None) -> dict:
        """Passwordless identity for Drive campus registration. Get-or-create a
        student account by email and issue tokens — the Student ID is the returning
        credential, so there is no password. Reuses the platform JWT so the exam /
        proctor / evaluation services accept the session unchanged."""
        email = email.lower().strip()
        # Campus Drive registration is a LARE Hire account (passwordless, Student-ID).
        user = s.execute(
            select(User).where(User.email == email, User.product == "hire")
        ).scalar_one_or_none()
        if user is None:
            user = User(
                id=new_id(), email=email, product="hire",
                # Random unusable password — this account only logs in via Student ID.
                password_hash=hash_password(secrets.token_urlsafe(24),
                                            rounds=self.cfg.BCRYPT_ROUNDS),
                full_name=full_name, tenant_id=self.cfg.DEFAULT_TENANT_ID,
                email_verified=True, status="active",
            )
            s.add(user)
            s.flush()
        elif full_name and not user.full_name:
            user.full_name = full_name
        self.assign_role(s, user.id, "student", None)
        s.flush()
        tokens = self._issue_tokens(s, user, device="drive")
        return {"user_id": user.id, "email": user.email,
                "full_name": user.full_name, **tokens}

    def login(self, s: Session, email: str, password: str, device: str | None,
              product: str = "learn") -> dict:
        user = s.execute(
            select(User).where(User.email == email.lower(), User.product == product)
        ).scalar_one_or_none()
        # Uniform failure to avoid user enumeration.
        if not user:
            raise Unauthorized("Invalid credentials", code="invalid_credentials")

        if user.locked_until and _lock_active(user.locked_until):
            raise TooManyRequests("Account temporarily locked", code="account_locked")

        if user.status != "active":
            raise Forbidden("Account is not active", code="account_inactive")

        if not verify_password(password, user.password_hash):
            user.failed_attempts += 1
            if user.failed_attempts >= self.cfg.MAX_LOGIN_ATTEMPTS:
                user.locked_until = _utcnow() + timedelta(minutes=self.cfg.LOCKOUT_MINUTES)
                user.failed_attempts = 0
            raise Unauthorized("Invalid credentials", code="invalid_credentials")

        user.failed_attempts = 0
        user.locked_until = None
        return self._issue_tokens(s, user, device)

    def refresh(self, s: Session, raw_refresh: str) -> dict:
        token_hash = hash_token(raw_refresh)
        rt = s.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        ).scalar_one_or_none()
        if not rt:
            raise Unauthorized("Invalid refresh token", code="invalid_refresh")

        # Reuse detection: a revoked token presented again → revoke the family.
        # Persist the revocation before raising, otherwise the session context
        # manager rolls it back on the exception and the sibling token survives.
        if rt.revoked_at is not None:
            self._revoke_family(s, rt.family_id)
            s.commit()
            raise Unauthorized("Refresh token reuse detected", code="refresh_reuse")

        if not rt.is_active:
            raise Unauthorized("Refresh token expired", code="refresh_expired")

        user = s.get(User, rt.user_id)
        if not user or user.status != "active":
            raise Unauthorized("User not active", code="account_inactive")

        rt.revoked_at = _utcnow()  # rotate: revoke old, mint new in same family
        return self._issue_tokens(s, user, rt.device, family_id=rt.family_id)

    def logout(self, s: Session, raw_refresh: str) -> None:
        rt = s.execute(
            select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_refresh))
        ).scalar_one_or_none()
        if rt and rt.revoked_at is None:
            rt.revoked_at = _utcnow()

    def assign_role(self, s: Session, user_id: str, role_name: str,
                    college_id: str | None) -> None:
        role = s.execute(select(Role).where(Role.name == role_name)).scalar_one_or_none()
        if not role:
            raise Conflict("Unknown role", code="unknown_role")
        user = s.get(User, user_id)
        if not user:
            raise Conflict("Unknown user", code="unknown_user")
        exists = s.execute(
            select(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role.id,
                UserRole.college_id.is_(college_id) if college_id is None
                else UserRole.college_id == college_id,
            )
        ).scalar_one_or_none()
        if exists:
            return
        s.add(UserRole(id=new_id(), user_id=user_id, role_id=role.id, college_id=college_id))

    # ---------- OTP / password reset / email verification ----------
    def _issue_verification(self, s: Session, user: User, purpose: str,
                            ttl_min: int, numeric: bool) -> str:
        # Invalidate prior unconsumed tokens of the same purpose.
        for t in s.execute(
            select(VerificationToken).where(
                VerificationToken.user_id == user.id,
                VerificationToken.purpose == purpose,
                VerificationToken.consumed_at.is_(None))
        ).scalars().all():
            t.consumed_at = _utcnow()
        raw = f"{secrets.randbelow(900000) + 100000}" if numeric else random_token()
        s.add(VerificationToken(
            id=new_id(), user_id=user.id, purpose=purpose,
            token_hash=hash_token(raw),
            expires_at=_utcnow() + timedelta(minutes=ttl_min)))
        s.flush()
        return raw

    def _consume_verification(self, s: Session, purpose: str, raw: str,
                              user_id: str | None = None) -> User:
        q = select(VerificationToken).where(
            VerificationToken.purpose == purpose,
            VerificationToken.token_hash == hash_token(raw),
            VerificationToken.consumed_at.is_(None))
        if user_id:
            q = q.where(VerificationToken.user_id == user_id)
        vt = s.execute(q).scalar_one_or_none()
        if not vt:
            raise Unauthorized("Invalid or used token", code="invalid_token")
        exp = vt.expires_at.replace(tzinfo=timezone.utc) if vt.expires_at.tzinfo is None else vt.expires_at
        if exp < _utcnow():
            raise Unauthorized("Token expired", code="token_expired")
        vt.consumed_at = _utcnow()
        user = s.get(User, vt.user_id)
        if not user:
            raise Unauthorized("User not found", code="user_not_found")
        return user

    def request_otp(self, s: Session, email: str, product: str = "learn") -> str | None:
        """Issue a 6-digit login OTP. Returns the code (delivered via
        Notification in prod; returned in dev for testing). No user enumeration."""
        user = s.execute(
            select(User).where(User.email == email.lower(), User.product == product)
        ).scalar_one_or_none()
        if not user:
            return None
        return self._issue_verification(s, user, "otp", ttl_min=10, numeric=True)

    def verify_otp(self, s: Session, email: str, code: str, device: str | None,
                   product: str = "learn") -> dict:
        user = s.execute(
            select(User).where(User.email == email.lower(), User.product == product)
        ).scalar_one_or_none()
        if not user:
            raise Unauthorized("Invalid credentials", code="invalid_credentials")
        self._consume_verification(s, "otp", code, user_id=user.id)
        return self._issue_tokens(s, user, device)

    def request_password_reset(self, s: Session, email: str, product: str = "learn") -> str | None:
        user = s.execute(
            select(User).where(User.email == email.lower(), User.product == product)
        ).scalar_one_or_none()
        if not user:
            return None  # silent: no enumeration
        return self._issue_verification(s, user, "password_reset", ttl_min=30, numeric=False)

    def reset_password(self, s: Session, token: str, new_password: str) -> None:
        user = self._consume_verification(s, "password_reset", token)
        user.password_hash = hash_password(new_password, rounds=self.cfg.BCRYPT_ROUNDS)
        user.failed_attempts = 0
        user.locked_until = None
        # Revoke all refresh families on password change (security best practice).
        for rt in s.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        ).scalars().all():
            rt.revoked_at = _utcnow()

    def request_email_verification(self, s: Session, user_id: str) -> str:
        user = s.get(User, user_id)
        if not user:
            raise Unauthorized("User not found", code="user_not_found")
        return self._issue_verification(s, user, "email_verify", ttl_min=60 * 24, numeric=False)

    def verify_email(self, s: Session, token: str) -> dict:
        user = self._consume_verification(s, "email_verify", token)
        user.email_verified = True
        return self.user_out(s, user)

    def _revoke_family(self, s: Session, family_id: str) -> None:
        tokens = s.execute(
            select(RefreshToken).where(
                RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None)
            )
        ).scalars().all()
        for t in tokens:
            t.revoked_at = _utcnow()

    def user_out(self, s: Session, user: User) -> dict:
        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "status": user.status,
            "email_verified": user.email_verified,
            "mfa_enabled": user.mfa_enabled,
            "tenant_id": user.tenant_id,
            "product": getattr(user, "product", "learn"),
            "roles": self._role_names(s, user),
        }


def _lock_active(locked_until: datetime) -> bool:
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    return locked_until > _utcnow()
