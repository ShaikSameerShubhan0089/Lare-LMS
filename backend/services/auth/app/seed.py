"""Seed the RBAC engine: the granular permission catalog, the built-in role
ladder with default permission sets, and an initial super admin.

This is the bedrock every service enforces through. Permissions are *granular*
(one code per capability, e.g. ``analytics.branch.view``) and grouped by domain;
roles are bundles of permissions plus a data-visibility ``scope_level``. The seed
is idempotent — it adds anything missing and tops up each system role's default
permissions without ever removing an admin's later customisations.
"""
from __future__ import annotations

import os

from sqlalchemy import select

from lare_common.security import hash_password, new_id

from .config import AuthConfig
from .models import Permission, Role, User, UserRole

# ---------------------------------------------------------------------------
# Roles: (name, description, scope_level). scope_level is the data-visibility
# ceiling — platform > college > branch > section > self — enforced at the
# query layer. These are the SYSTEM roles (is_system=True): re-permissionable,
# never deletable. Admins may create additional custom roles at runtime.
# ---------------------------------------------------------------------------
ROLES = [
    ("super_admin",   "Platform owner (LARE). Full control across all institutions.", "platform"),
    ("company_admin", "LARE recruitment / programme operator.",                       "platform"),
    ("principal",     "Institution head — oversees one college end to end.",          "college"),
    ("dean",          "Academic head — oversees academics & development for a college.", "college"),
    ("hod",           "Head of Department — leads one branch's academics.",           "branch"),
    ("tpo",           "Training & Placement Officer — placements for one college.",   "college"),
    ("college_admin", "College coordinator / administrator.",                         "college"),
    ("trainer",       "Trainer / mentor (LMS).",                                      "section"),
    ("faculty",       "Faculty — teaches and assesses their assigned branch.",        "branch"),
    ("recruiter",     "Recruiter / interviewer (Drive).",                             "self"),
    ("student",       "Learner / candidate.",                                         "self"),
]

# ---------------------------------------------------------------------------
# Permission catalog: (code, description, domain). One code == one capability.
# Every API/service enforces on these codes; frontend hiding is cosmetic only.
# ---------------------------------------------------------------------------
PERMISSIONS = [
    # platform / system
    ("platform.system.config",     "Configure platform settings",          "platform"),
    ("platform.audit.view",        "View audit logs",                      "platform"),
    # identity & access management
    ("auth.user.manage",           "Create, edit, suspend users",          "auth"),
    ("auth.user.view",             "View users",                           "auth"),
    ("auth.role.manage",           "Create, edit, delete roles",           "auth"),
    ("auth.role.assign",           "Assign roles to users",                "auth"),
    # institution structure
    ("institution.manage",         "Manage colleges, branches, years, sections", "institution"),
    ("institution.view",           "View institution structure",          "institution"),
    ("institution.access.manage",  "Manage Access IDs",                    "institution"),
    # academic / curriculum
    ("academic.course.manage",     "Manage courses & curriculum",          "academic"),
    ("academic.course.view",       "View courses & curriculum",            "academic"),
    ("academic.enrollment.manage", "Manage student enrollment",            "academic"),
    ("lms.curriculum.manage",      "Manage LMS curriculum",                "lms"),
    # assessment
    ("assessment.manage",          "Create & edit assessments",            "assessment"),
    ("assessment.grade",           "Grade & override scores",              "assessment"),
    ("assessment.result.publish",  "Publish assessment results",           "assessment"),
    # recruitment (Drive)
    ("drive.drive.manage",         "Manage recruitment drives",            "drive"),
    ("drive.result.publish",       "Publish results / offers",             "drive"),
    # analytics — one code per hierarchy tier; the role's scope decides whose data
    ("analytics.platform.view",    "Platform-wide analytics (all colleges)", "analytics"),
    ("analytics.college.view",     "College-level analytics",              "analytics"),
    ("analytics.branch.view",      "Branch / department analytics",        "analytics"),
    ("analytics.section.view",     "Section / class analytics",            "analytics"),
    ("analytics.student.view",     "Individual student analytics",         "analytics"),
    ("analytics.export",           "Export reports & data",                "analytics"),
    # self-service
    ("self.profile.manage",        "Manage own profile",                   "self"),
    ("self.progress.view",         "View own progress",                    "self"),
]

# ---------------------------------------------------------------------------
# Default permission set per system role. super_admin is handled separately
# (gets everything). "*" as a prefix wildcard is expanded against the catalog.
# ---------------------------------------------------------------------------
_ANALYTICS_DOWN = ["analytics.college.view", "analytics.branch.view",
                   "analytics.section.view", "analytics.student.view",
                   "analytics.export"]

ROLE_DEFAULTS: dict[str, list[str]] = {
    "company_admin": [
        # Programme operator: full user & role administration, but not
        # platform.system.config or auth.role.manage (those stay super-admin-tier).
        "auth.user.manage", "auth.user.view", "auth.role.assign",
        "institution.manage", "institution.view", "institution.access.manage",
        "academic.course.manage", "academic.enrollment.manage", "lms.curriculum.manage",
        "assessment.manage", "assessment.grade", "assessment.result.publish",
        "drive.drive.manage", "drive.result.publish",
        "analytics.platform.view", *_ANALYTICS_DOWN,
    ],
    "principal": [
        "auth.user.view", "institution.view", "academic.course.view",
        *_ANALYTICS_DOWN,
    ],
    "dean": [
        "institution.view", "academic.course.manage", "academic.course.view",
        "analytics.college.view", "analytics.branch.view", "analytics.section.view",
        "analytics.student.view", "analytics.export",
    ],
    "hod": [
        # Department head: manages their branch's curriculum/assessments and sees
        # their branch's analytics. Scope (branch) limits it to their department.
        "institution.view", "academic.course.manage", "academic.course.view",
        "assessment.manage", "assessment.grade",
        "analytics.branch.view", "analytics.section.view", "analytics.student.view",
        "analytics.export", "self.profile.manage",
    ],
    "tpo": [
        "institution.view", "institution.access.manage", "academic.course.view",
        "drive.drive.manage", "drive.result.publish",
        *_ANALYTICS_DOWN,
    ],
    "college_admin": [
        "auth.user.view", "institution.view", "institution.access.manage",
        "academic.course.manage", "academic.enrollment.manage",
        *_ANALYTICS_DOWN,
    ],
    "trainer": [
        "lms.curriculum.manage", "academic.course.view",
        "assessment.manage", "assessment.grade",
        "analytics.section.view", "analytics.student.view",
        "self.profile.manage",
    ],
    "faculty": [
        "academic.course.manage", "academic.course.view",
        "assessment.manage", "assessment.grade",
        "analytics.branch.view", "analytics.section.view", "analytics.student.view",
        "self.profile.manage",
    ],
    "recruiter": [
        "drive.drive.manage", "self.profile.manage",
    ],
    "student": [
        "self.profile.manage", "self.progress.view", "analytics.student.view",
    ],
}


def seed(db, cfg: AuthConfig) -> None:
    with db.session() as s:
        # --- permissions ---
        perm_map: dict[str, Permission] = {}
        for code, desc, domain in PERMISSIONS:
            p = s.execute(select(Permission).where(Permission.code == code)).scalar_one_or_none()
            if not p:
                p = Permission(id=new_id(), code=code, description=desc, domain=domain)
                s.add(p)
                s.flush()
            perm_map[code] = p

        # --- roles ---
        role_map: dict[str, Role] = {}
        for name, desc, scope in ROLES:
            role = s.execute(select(Role).where(Role.name == name)).scalar_one_or_none()
            if not role:
                role = Role(id=new_id(), name=name, description=desc,
                            scope_level=scope, is_system=True, is_active=True)
                s.add(role)
                s.flush()
            else:
                # keep built-ins flagged and their scope/description current
                role.is_system = True
                role.scope_level = scope
                if desc:
                    role.description = desc
            role_map[name] = role

        # --- default permission grants (idempotent top-up; never revokes) ---
        def grant(role: Role, codes) -> None:
            have = {p.code for p in role.permissions}
            for code in codes:
                if code not in have and code in perm_map:
                    role.permissions.append(perm_map[code])

        grant(role_map["super_admin"], list(perm_map.keys()))  # everything
        for name, codes in ROLE_DEFAULTS.items():
            if name in role_map:
                grant(role_map[name], codes)

        # --- initial super admin ---
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
            print(f"[seed] created super admin: {admin_email}")
        else:
            print(f"[seed] super admin already exists: {admin_email}")

    print(f"[seed] RBAC ready — {len(PERMISSIONS)} permissions, {len(ROLES)} roles")
