import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet as WalletIcon, ShieldCheck, Copy, Download, RefreshCw, Link2,
  Sparkles, Code2, Compass, Ban,
} from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, Loading } from "../components/ui/states.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

// LARE Learn — Sovereign Learning Wallet. The learner owns a signed, verifiable
// snapshot of their proven competence and can share a public verify link.
export default function Wallet() {
  const { user } = useAuth();
  const id = user?.id;
  const [cred, setCred] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [flash, setFlash] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.getWallet(id);
      setCred(res?.credential ? res : null);
    } catch { setCred(null); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (id) load(); /* eslint-disable-next-line */ }, [id]);

  async function issue() {
    setBusy("issue");
    try { const res = await api.issueWallet(id); setCred(res); setFlash("Wallet updated with your latest competence."); }
    catch { setFlash("Couldn't issue your wallet — take an assessment first."); }
    finally { setBusy(""); setTimeout(() => setFlash(""), 3500); }
  }

  async function revoke() {
    setBusy("revoke");
    try { await api.revokeWallet(id); setFlash("Credential revoked. Re-issue any time."); await load(); }
    catch { setFlash("Couldn't revoke."); }
    finally { setBusy(""); setTimeout(() => setFlash(""), 3500); }
  }

  const verifyUrl = cred ? `${window.location.origin}/verify/wallet/${cred.verify_id}` : "";

  function copyLink() {
    navigator.clipboard?.writeText(verifyUrl);
    setFlash("Verify link copied.");
    setTimeout(() => setFlash(""), 2500);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(cred, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "lare-wallet.json";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  if (loading) return <Loading />;

  const vc = cred?.credential || {};

  return (
    <div>
      <PageHeader
        title="My Learning Wallet"
        subtitle="A signed, verifiable record of what you've proven — yours to own and share. Anyone you send it to can confirm it's authentic, no login required."
        right={<Button as={Link} to="/lms/skill-map" variant="secondary"><Sparkles size={16} /> Skill Map</Button>}
      />

      {flash && (
        <div className="mb-5 rounded-md bg-teal-500/10 text-teal-700 p-3 text-sm flex items-center gap-2">
          <ShieldCheck size={15} /> {flash}
        </div>
      )}

      {!cred ? (
        <Card className="p-10 text-center">
          <span className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-brand-500/10 text-brand-600">
            <WalletIcon size={28} />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-ink-900">Create your verified wallet</h2>
          <p className="mt-1 text-slate-500 max-w-md mx-auto">
            Turn your assessments, solved problems and viva-verified skills into one signed credential you can share with any recruiter.
          </p>
          <Button className="mt-5" onClick={issue} disabled={busy === "issue"}>
            {busy === "issue" ? "Issuing…" : "Issue my wallet"}
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* The credential card */}
          <Card className="p-6 border-brand-200 bg-gradient-to-br from-brand-500/5 to-transparent">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 flex items-center gap-1.5">
                  <ShieldCheck size={14} /> LARE Verified Competence
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">{cred.subject_name}</h2>
                <p className="text-sm text-slate-500">Issued {(cred.issued_at || "").slice(0, 10)} · {vc.issuer}</p>
              </div>
              <div className="flex items-center gap-4">
                {/* 3D verified seal */}
                <div aria-hidden className="relative grid place-items-center h-16 w-16 rounded-full text-white shrink-0"
                  style={{ background: "linear-gradient(145deg,#5eead4,#0d9488)", boxShadow: "0 12px 26px -6px rgba(13,148,136,.55), inset 0 2px 3px rgba(255,255,255,.55), inset 0 -4px 7px rgba(0,0,0,.3)" }}>
                  <ShieldCheck size={28} strokeWidth={2} />
                  <span className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 34% 24%, rgba(255,255,255,.5), transparent 46%)" }} />
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl font-bold text-brand-600 tabular-nums">{vc.overall_mastery}%</p>
                  <p className="text-xs text-slate-400">overall mastery</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid sm:grid-cols-3 gap-4">
              <Metric label="Assessments" value={vc.exams_taken} />
              <Metric label="Problems solved" value={vc.coding_solved} />
              <Metric label="Verified (viva)" value={vc.coding_verified} tone="teal" />
            </div>

            {(vc.proven_strengths || []).length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Proven strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {vc.proven_strengths.map((sname) => (
                    <span key={sname} className="rounded-full bg-teal-500/10 text-teal-700 px-2.5 py-1 text-xs font-medium">{sname}</span>
                  ))}
                </div>
              </div>
            )}

            {(vc.verified_coding_skills || []).length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5"><Code2 size={13} /> Viva-verified coding</p>
                <div className="flex flex-wrap gap-1.5">
                  {vc.verified_coding_skills.map((sname) => (
                    <span key={sname} className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 text-brand-700 px-2.5 py-1 text-xs font-medium">
                      <ShieldCheck size={12} /> {sname}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {vc.top_career && (
              <p className="mt-4 text-sm text-slate-600 flex items-center gap-1.5">
                <Compass size={14} className="text-brand-500" /> Closest career fit: <b className="text-ink-900">{vc.top_career.title}</b> ({vc.top_career.match_pct}%)
              </p>
            )}
          </Card>

          {/* Share + export */}
          <Card className="p-6">
            <h3 className="font-display font-semibold text-ink-900 mb-3 flex items-center gap-2"><Link2 size={18} className="text-brand-500" /> Share & verify</h3>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 bg-slate-50">
              <code className="text-sm text-slate-600 truncate flex-1">{verifyUrl}</code>
              <Button size="sm" variant="secondary" onClick={copyLink}><Copy size={14} /> Copy</Button>
              <Button size="sm" variant="ghost" as="a" href={verifyUrl} target="_blank" rel="noreferrer">Open</Button>
            </div>
            <p className="mt-2 text-xs text-slate-400">Anyone with this link can confirm your credential is authentic and current — no LARE account needed.</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => api.downloadWalletPdf(id)}><Download size={15} /> Download PDF</Button>
              <Button variant="secondary" onClick={downloadJson}><Download size={15} /> Download JSON</Button>
              <Button variant="secondary" onClick={issue} disabled={busy === "issue"}><RefreshCw size={15} /> {busy === "issue" ? "Refreshing…" : "Refresh"}</Button>
              <Button variant="ghost" onClick={revoke} disabled={busy === "revoke"} className="text-rose-600"><Ban size={15} /> Revoke</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "brand" }) {
  const tones = { brand: "text-brand-600", teal: "text-teal-600" };
  return (
    <div className="rounded-lg bg-white/60 border border-slate-100 p-3 text-center">
      <p className={`font-display text-2xl font-bold tabular-nums ${tones[tone]}`}>{value ?? 0}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
