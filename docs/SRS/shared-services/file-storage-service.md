# SRS — File & Storage Service (Shared)

**Service ID:** `lare-files` · **Domain:** Shared · **Version:** 1.0
**Backing store:** Supabase Storage.

---

## 1. Purpose
Central, secure handling of all binary/document assets: resumes, profile photos, course content, certificates, coding artifacts, proctoring snapshots, and report exports. Provides pre-signed upload/download so large files bypass the API path, plus validation, virus scanning, and lifecycle rules.

## 2. Responsibilities
- Issue pre-signed upload URLs (direct-to-storage) and time-limited download URLs.
- Validate MIME type, size, and extension against per-purpose policy.
- Malware/AV scan on upload (async) before an object is marked usable.
- Metadata registry (owner, purpose, linkage to domain entity).
- Access control: only authorized users/services get signed URLs.
- Lifecycle: retention, archival, deletion (privacy requests).
- Image processing (thumbnails for photos, PDF preview generation where useful).

## 3. Storage Buckets / Purposes
| Purpose | Bucket | Access |
|---------|--------|--------|
| Resumes | `resumes` | Private, owner + recruiters on applied drives |
| Photos | `avatars` | Private, owner + proctor context |
| Course content | `lms-content` | Private, enrolled learners |
| Certificates | `certificates` | Private, owner + TPO; verifiable link |
| Coding artifacts | `code-submissions` | Private, evaluation service only |
| Proctoring snapshots | `proctor` | Private, admin/proctor only, short retention |
| Report exports | `reports` | Private, requesting admin only |

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| FS-1 | `POST /files/v1/upload-url` returns pre-signed PUT + `file_id`, constrained by purpose policy. |
| FS-2 | Client uploads directly to storage; then `POST /files/v1/{id}/complete` triggers validation+scan. |
| FS-3 | Files remain `pending` until scan passes; consumers must check `status=ready`. |
| FS-4 | `GET /files/v1/{id}/download-url` returns a short-lived signed URL after authorization. |
| FS-5 | Enforce max sizes (resume 5 MB, photo 2 MB, content 200 MB, etc.). |
| FS-6 | Deletion + retention policy per purpose; hard-delete on privacy request. |
| FS-7 | Verifiable certificate URLs are public-read but unguessable + revocable. |

## 5. Data Model (`shared_files` schema)
| Table | Key columns |
|-------|-------------|
| `files` | id, owner_user_id, purpose, bucket, object_key, mime, size, status, scan_result, entity_type, entity_id, created_at, expires_at |
| `access_grants` | file_id, principal_type, principal_id, action, granted_by, expires_at |

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/files/v1/upload-url` | Pre-signed upload. |
| POST | `/files/v1/{id}/complete` | Finalize + scan. |
| GET | `/files/v1/{id}/download-url` | Signed download. |
| DELETE | `/files/v1/{id}` | Delete (authorized). |
| GET | `/files/v1/{id}/meta` | Metadata/status. |

## 7. Security
- Every signed URL is scoped, expiring, single-purpose.
- AV scan gate before availability; block executable/script MIME where not allowed.
- Object keys are random UUIDs; no user-controlled paths (prevents traversal).
- Access decisions cross-check ownership + domain grants.

## 8. Non-Functional
- Upload/download never proxies large bytes through Flask (pre-signed only).
- Scan completes < 60 s typical; consumers poll or receive `file.ready` event.

## 9. Events
`file.uploaded`, `file.ready`, `file.scan_failed`, `file.deleted`.

## 10. Deployment (No Docker)
Gunicorn + Nginx; systemd `lare-files.service`; async scan worker `lare-files-scan.service`. Supabase Storage credentials in secret store.
