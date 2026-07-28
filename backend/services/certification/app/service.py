"""Certification logic: the 4-year certificate series with public verification.

Certificates auto-issue when Progress signals `year.completed` (CE-2). Issuance
is idempotent per (learner, year). Year 4 carries the PPO eligibility tag. A
verifiable, unguessable verify_id backs the public verification endpoint (CE-4),
and certificates can be revoked with an audited reason (CE-6). PDF rendering +
storage via the File Service is a later wiring; here we mint the record + IDs.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from lare_common.errors import Conflict, NotFound
from lare_common.security import new_id, random_token

# The MoU four-year certificate series.
SERIES = {
    1: "Foundation & Personality Development",
    2: "Programming & Stream Readiness",
    3: "Placement Readiness",
    4: "Industry Readiness",
}

# Standalone certificate types (req #19) — not tied to a programme year.
CERT_TYPES = {
    "participation": "Certificate of Participation",
    "internship": "Internship Completion Certificate",
    "completion": "Course Completion Certificate",
}


class CertificationService:
    def upsert_template(self, s: Session, data) -> "Template":  # noqa: F821
        from .models import Template
        t = s.execute(select(Template).where(Template.year_no == data.year_no)).scalar_one_or_none()
        if t is None:
            t = Template(id=new_id(), year_no=data.year_no, name=data.name,
                         signatories=data.signatories)
            s.add(t)
        else:
            t.name = data.name
            t.signatories = data.signatories
            t.version += 1
        s.flush()
        return t

    def issue(self, s: Session, data) -> dict:
        from .models import Certificate, Template
        existing = s.execute(
            select(Certificate).where(
                Certificate.learner_id == data.learner_id,
                Certificate.year_no == data.year_no,
            )
        ).scalar_one_or_none()
        if existing:
            return {**self.out(existing), "new": False}

        tmpl = s.execute(
            select(Template).where(Template.year_no == data.year_no)
        ).scalar_one_or_none()
        cert_name = SERIES.get(data.year_no, f"Year {data.year_no} Certificate")
        seq = s.query(Certificate).count() + 1
        cert = Certificate(
            id=new_id(), learner_id=data.learner_id, year_no=data.year_no,
            template_id=tmpl.id if tmpl else None,
            cert_no=f"LARE-Y{data.year_no}-{seq:06d}",
            cert_name=cert_name,
            verify_id=random_token(12),
            ppo_tag=bool(data.ppo_tag and data.year_no == 4),
            holder_name=data.holder_name,
        )
        s.add(cert)
        s.flush()
        return {**self.out(cert), "new": True}

    def issue_typed(self, s: Session, learner_id: str, cert_type: str,
                    holder_name: str | None, ref: str | None = None) -> dict:
        """Issue a standalone (participation/internship/completion) certificate."""
        from .models import Certificate
        name = CERT_TYPES.get(cert_type)
        if not name:
            raise Conflict("Unknown certificate type", code="unknown_cert_type")
        seq = s.query(Certificate).count() + 1
        cert = Certificate(
            id=new_id(), learner_id=learner_id, year_no=0,
            cert_no=f"LARE-{cert_type[:4].upper()}-{seq:06d}",
            cert_name=name, verify_id=random_token(12),
            ppo_tag=False, holder_name=holder_name)
        s.add(cert)
        s.flush()
        return {**self.out(cert), "type": cert_type, "new": True}

    def certificate_pdf(self, s: Session, cert_id: str) -> tuple[bytes, str]:
        from lare_common.exports import to_pdf
        from .models import Certificate
        cert = s.get(Certificate, cert_id)
        if not cert:
            raise NotFound("Certificate not found", code="cert_not_found")
        lines = [
            "", "This is to certify that", "",
            f"    {cert.holder_name or cert.learner_id}", "",
            f"has been awarded the {cert.cert_name}.", "",
            f"Certificate No: {cert.cert_no}",
            f"Issued: {cert.issued_at.strftime('%d %b %Y')}",
            f"Verify at: /verify/{cert.verify_id}",
            "", "LARE IT Cloud Solutions",
        ]
        return to_pdf(cert.cert_name, lines), f"certificate-{cert.cert_no}.pdf"

    def for_learner(self, s: Session, learner_id: str) -> list[dict]:
        from .models import Certificate
        rows = s.execute(
            select(Certificate).where(Certificate.learner_id == learner_id)
            .order_by(Certificate.year_no)
        ).scalars().all()
        return [self.out(c) for c in rows]

    def revoke(self, s: Session, cert_id: str, reason: str, by: str) -> dict:
        from .models import Certificate, Revocation
        cert = s.get(Certificate, cert_id)
        if not cert:
            raise NotFound("Certificate not found", code="cert_not_found")
        if cert.status == "revoked":
            raise Conflict("Already revoked", code="already_revoked")
        cert.status = "revoked"
        s.add(Revocation(id=new_id(), certificate_id=cert_id, reason=reason, revoked_by=by))
        s.flush()
        return self.out(cert)

    def verify(self, s: Session, verify_id: str) -> dict:
        from .models import Certificate
        cert = s.execute(
            select(Certificate).where(Certificate.verify_id == verify_id)
        ).scalar_one_or_none()
        if not cert:
            raise NotFound("Certificate not found", code="cert_not_found")
        # Public view: minimal PII, validity only.
        return {
            "valid": cert.status == "issued",
            "cert_no": cert.cert_no,
            "certificate": cert.cert_name,
            "holder_name": cert.holder_name,
            "year_no": cert.year_no,
            "ppo_eligible": cert.ppo_tag,
            "issued_at": cert.issued_at.isoformat(),
            "status": cert.status,
        }

    @staticmethod
    def out(cert) -> dict:
        return {"id": cert.id, "learner_id": cert.learner_id, "year_no": cert.year_no,
                "cert_no": cert.cert_no, "certificate": cert.cert_name,
                "verify_id": cert.verify_id, "verify_url": f"/verify/{cert.verify_id}",
                "status": cert.status, "ppo_tag": cert.ppo_tag}
