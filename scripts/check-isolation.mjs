#!/usr/bin/env node
// Product-isolation guardrail for the LARE platform.
//
// Enforces: LARE Learn (LMS) and LARE Hire (Drive) are two separate products
// that never call each other's APIs. They meet only at the shared PLATFORM
// layer (auth, notifications, files, analytics, audit, org, AI, code-runner).
//
// Fails (exit 1) if:
//   A. a backend LMS service references a "drive-*" internal-service key,
//   B. a backend Drive service references an "lms-*" internal-service key,
//   C. a non-Hire frontend file imports Hire-only UI (components/drive/*).
//
// Platform keys ("platform-*", "lare-*", "auth") are shared and always allowed.
// Run:  node scripts/check-isolation.mjs   (from anywhere)

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

// ---------- helpers ----------
function walk(dir, exts) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "__pycache__" || name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

// ============================================================
// A + B. Backend: no cross-product internal service calls
// ============================================================
const SERVICES = join(ROOT, "backend", "services");
const LMS_SERVICES = ["institution", "learner", "curriculum", "content", "progress", "assessment", "gamification", "certification"];
const DRIVE_SERVICES = ["candidate", "drive", "questionbank", "exam", "submission", "anticheat", "evaluation", "interview", "result", "evidence", "competency", "decision", "action", "recruit_ai"];
// Everything else (auth, notification, files, analytics, audit, organization,
// coding→platform-coding, ai_orchestration→platform-ai, ai_tutor, gateway) is
// platform or product-neutral and is not checked here.

function checkBackend(serviceDirs, forbiddenPrefix, productLabel) {
  for (const svc of serviceDirs) {
    const dir = join(SERVICES, svc, "app");
    for (const file of walk(dir, [".py"])) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        // match a quoted internal-service key like "drive-core" / "lms-assessment"
        const m = line.match(new RegExp(`["']${forbiddenPrefix}-[a-z-]+["']`));
        if (m) {
          violations.push(`${rel(file)}:${i + 1}  ${productLabel} service references ${m[0]} — cross-product API call`);
        }
      });
    }
  }
}
checkBackend(LMS_SERVICES, "drive", "LMS");
checkBackend(DRIVE_SERVICES, "lms", "Hire");

// ============================================================
// C. Frontend: Hire-only UI (components/drive/*) imported only by Hire files
// ============================================================
const FE = join(ROOT, "frontend", "src");
// Files allowed to import Hire UI: anything under pages/recruiter/, plus the
// student-facing Hire pages. Keep this list tight — adding an LMS page here
// would defeat the guard.
const HIRE_ALLOW = [
  "pages/Drives.jsx",
  "pages/MatchedOpportunities.jsx",
  "pages/AttendDrive.jsx",
  "pages/ExamPortal.jsx",
  "pages/CodingIDE.jsx",
  "pages/Profile.jsx", // recruitment profile (Hire-side only)
];
const isHireFile = (p) => {
  const r = rel(p);
  return r.includes("/pages/recruiter/") || r.includes("/components/drive/") || HIRE_ALLOW.some((a) => r.endsWith(a));
};

for (const file of walk(FE, [".jsx", ".js"])) {
  if (isHireFile(file)) continue;
  const txt = readFileSync(file, "utf8");
  if (/from\s+["'][^"']*components\/drive\//.test(txt)) {
    violations.push(`${rel(file)}  non-Hire file imports Hire-only UI (components/drive/*)`);
  }
}

// ---------- report ----------
if (violations.length) {
  console.error("\n✗ Product-isolation check FAILED — LMS and Hire must not cross:\n");
  for (const v of violations) console.error("  • " + v);
  console.error(`\n${violations.length} violation(s). LMS and Hire connect only through the shared platform layer.\n`);
  process.exit(1);
}
console.log("✓ Product isolation OK — no LMS↔Hire cross-calls or cross-imports.");
