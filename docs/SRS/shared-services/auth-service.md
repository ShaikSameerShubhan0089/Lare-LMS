# SRS — Authentication & Authorization Service (Shared)

**Service ID:** `lare-auth` · **Domain:** Shared · **Version:** 1.0
**Consumers:** API Gateway (JWKS), every service (RBAC context).

---

## 1. Purpose
Central identity provider for the platform. Handles registration, login, token issuance/rotation, password lifecycle, OTP/email verification, role & permission management, and service-to-service tokens. One user identity is shared across LMS and Drive domains.

## 2. Responsibilities
- User registration & login (email/password; extensible to SSO/OAuth for colleges).
- Issue JWT **access** tokens (15 min) and rotating **refresh** tokens (7 days).
- Password reset, change, and strength enforcement; bcrypt/Argon2id hashing.
- OTP generation/verification (email; SMS/WhatsApp-ready) for MFA and sensitive actions.
- Email verification flows.
- RBAC: roles, permissions, role assignment scoped by college/tenant.
- Mint short-lived **service tokens** for east–west calls.
- Publish JWKS for signature verification at the Gateway.
- Session/refresh-token revocation and device listing.

## 3. Roles (baseline)
`super_admin`, `company_admin`, `college_admin` (TPO), `trainer`, `recruiter`, `student` (== candidate). Roles are assignable per college; a user may hold several.

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| AU-1 | Register with email verification; students may be bulk-provisioned by College Admin (invite + first-login password set). |
| AU-2 | Login returns access+refresh; refresh rotates and invalidates the prior token (reuse detection → revoke family). |
| AU-3 | Enforce password policy; lockout/backoff after N failed attempts. |
| AU-4 | Password reset via signed, expiring email link + OTP. |
| AU-5 | RBAC: `has_permission(user, permission, scope)` resolvable; permissions grouped by domain. |
| AU-6 | MFA (OTP) required for admin roles and for high-stakes actions (offer generation, result publish). |
| AU-7 | Service tokens: scoped, ≤ 5 min, audience-bound to the target service. |
| AU-8 | Revocation list + refresh-token family tracking; logout revokes device. |
| AU-9 | Emit auth events to Audit (login, failed login, role change, reset). |

## 5. Data Model (`auth` schema)
| Table | Key columns |
|-------|-------------|
| `users` | id, email, password_hash, status, email_verified, mfa_enabled, tenant_id, created_at |
| `roles` | id, name, description |
| `permissions` | id, code, description, domain |
| `role_permissions` | role_id, permission_id |
| `user_roles` | user_id, role_id, college_id (nullable scope) |
| `refresh_tokens` | id, user_id, family_id, token_hash, device, expires_at, revoked_at |
| `otp_codes` | id, user_id, purpose, code_hash, expires_at, consumed_at |
| `email_verifications` | id, user_id, token_hash, expires_at, verified_at |

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/v1/register` | Register user. |
| POST | `/auth/v1/login` | Authenticate → tokens. |
| POST | `/auth/v1/refresh` | Rotate tokens. |
| POST | `/auth/v1/logout` | Revoke device/refresh. |
| POST | `/auth/v1/password/forgot` · `/reset` | Reset flow. |
| POST | `/auth/v1/otp/request` · `/otp/verify` | OTP/MFA. |
| POST | `/auth/v1/email/verify` | Verify email. |
| GET | `/auth/v1/me` | Current identity + roles/permissions. |
| POST | `/auth/v1/roles` · `/roles/assign` | Role & permission mgmt (admin). |
| POST | `/auth/v1/service-token` | Mint service token (internal). |
| GET | `/auth/v1/.well-known/jwks.json` | Public keys. |

## 7. Security
- Access token claims: `sub`, `roles`, `tenant_id`, `college_ids`, `exp`, `iss`, `aud`.
- Signing: RS256/ES256 with rotating keys (JWKS); refresh reuse detection.
- Hashing: bcrypt cost ≥ 12 (or Argon2id).
- Rate limit login/OTP; constant-time comparisons; no user-enumeration on errors.

## 8. Non-Functional
- Token verification is offline at Gateway (JWKS) → no per-request round trip.
- P95 login < 300 ms; JWKS cached 10 min.

## 9. Events
`user.registered`, `user.login`, `user.login_failed`, `role.assigned`, `password.reset` → Audit/Analytics/Notification.

## 10. Deployment (No Docker)
Gunicorn + Nginx; systemd `lare-auth.service`. Keys in host secret store; JWKS served from cache. Redis for OTP/rate-limit/revocation.
