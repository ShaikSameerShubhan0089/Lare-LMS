"""Seed baseline roles, permissions, and an initial super admin."""
from __future__ import annotations

import os

from sqlalchemy import select

from lare_common.security import hash_password, new_id

from .config import AuthConfig
from .models import Permission, Role, User, UserRole

ROLES = {
    "super_admin": "Platform owner (LARE).",
    "company_admin": "LARE recruitment/programme owner.",
    "college_admin": "College coordinator / TPO.",
    "trainer": "Trainer / faculty mentor (LMS).",
    "recruiter": "Recruiter / interviewer (Drive).",
    "student": "Learner / candidate.",
}

PERMISSIONS = [
    ("auth.user.manage", "Manage users", "auth"),
    ("auth.role.assign", "Assign roles", "auth"),
    ("lms.curriculum.manage", "Manage curriculum", "lms"),
    ("drive.drive.manage", "Manage recruitment drives", "drive"),
    ("drive.result.publish", "Publish results / offers", "drive"),
]


def seed(db, cfg: AuthConfig) -> None:
    with db.session() as s:
        role_map: dict[str, Role] = {}
        for name, desc in ROLES.items():
            role = s.execute(select(Role).where(Role.name == name)).scalar_one_or_none()
            if not role:
                role = Role(id=new_id(), name=name, description=desc)
                s.add(role)
                s.flush()
            role_map[name] = role

        perm_map: dict[str, Permission] = {}
        for code, desc, domain in PERMISSIONS:
            p = s.execute(select(Permission).where(Permission.code == code)).scalar_one_or_none()
            if not p:
                p = Permission(id=new_id(), code=code, description=desc, domain=domain)
                s.add(p)
                s.flush()
            perm_map[code] = p

        # super_admin gets everything; company_admin gets programme/drive perms.
        for p in perm_map.values():
            if p not in role_map["super_admin"].permissions:
                role_map["super_admin"].permissions.append(p)
        for code in ("drive.drive.manage", "drive.result.publish", "lms.curriculum.manage"):
            p = perm_map[code]
            if p not in role_map["company_admin"].permissions:
                role_map["company_admin"].permissions.append(p)

        # Initial super admin
        admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@lareitcloudsolutions.com").lower()
        admin_pw = os.getenv("SEED_ADMIN_PASSWORD", "ChangeMe#123")
        admin = s.execute(select(User).where(User.email == admin_email)).scalar_one_or_none()
        if not admin:
            admin = User(
                id=new_id(),
                email=admin_email,
                password_hash=hash_password(admin_pw, rounds=cfg.BCRYPT_ROUNDS),
                full_name="LARE Super Admin",
                status="active",
                email_verified=True,
                tenant_id=cfg.DEFAULT_TENANT_ID,
            )
            s.add(admin)
            s.flush()
            s.add(UserRole(id=new_id(), user_id=admin.id,
                           role_id=role_map["super_admin"].id, college_id=None))
            print(f"[seed] created super admin: {admin_email} / {admin_pw}")
        else:
            print(f"[seed] super admin already exists: {admin_email}")

    print("[seed] roles & permissions ready")
