import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck, ShieldX, Code2, Compass } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { api } from "../lib/api.js";

// PUBLIC page (no login) — a recruiter or anyone can confirm a shared LARE
// wallet credential is authentic and current.
export default function WalletVerify() {
  const { verifyId } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    (async () => {
      try { setState({ loading: false, data: await api.verifyWallet(verifyId) }); }
      catch { setState({ loading: false, data: { valid: false, reason: "error" } }); }
    })();
  }, [verifyId]);

  const d = state.data;
  const vc = d?.credential || {};
  const reasonText = {
    not_found: "No credential exists for this link.",
    revoked: "This credential has been revoked by its owner.",
    signature_invalid: "This credential's signature failed — it may have been altered.",
    signature_mismatch: "This credential's signature does not match.",
    error: "Couldn't verify right now — please try again.",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <Logo />
          <span className="text-xs text-slate-400">Credential verification</span>
        </div>

        {state.loading ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-slate-400">Verifying…</div>
        ) : d?.valid ? (
          <div className="rounded-2xl bg-white border border-teal-200 shadow-sm overflow-hidden">
            <div className="bg-teal-500/10 p-6 flex items-center gap-3">
              <span className="grid place-items-center h-12 w-12 rounded-full bg-teal-500 text-white"><ShieldCheck size={26} /></span>
              <div>
                <p className="font-display text-lg font-bold text-ink-900">Authentic & current</p>
                <p className="text-sm text-teal-700">Verified by LARE Learn · issued {(d.issued_at || "").slice(0, 10)}</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500">This credential belongs to</p>
              <h1 className="font-display text-2xl font-bold text-ink-900">{d.subject_name}</h1>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <Cell v={`${vc.overall_mastery ?? 0}%`} l="mastery" />
                <Cell v={vc.coding_solved ?? 0} l="solved" />
                <Cell v={vc.coding_verified ?? 0} l="viva-verified" tone="teal" />
              </div>

              {(vc.proven_strengths || []).length > 0 && (
                <Section title="Proven strengths">
                  {vc.proven_strengths.map((s) => (
                    <span key={s} className="rounded-full bg-teal-500/10 text-teal-700 px-2.5 py-1 text-xs font-medium">{s}</span>
                  ))}
                </Section>
              )}
              {(vc.verified_coding_skills || []).length > 0 && (
                <Section title="Viva-verified coding" icon={Code2}>
                  {vc.verified_coding_skills.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 text-brand-700 px-2.5 py-1 text-xs font-medium"><ShieldCheck size={12} /> {s}</span>
                  ))}
                </Section>
              )}
              {vc.top_career && (
                <p className="mt-4 text-sm text-slate-600 flex items-center gap-1.5">
                  <Compass size={14} className="text-brand-500" /> Closest career fit: <b className="text-ink-900">{vc.top_career.title}</b> ({vc.top_career.match_pct}%)
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-rose-200 shadow-sm p-8 text-center">
            <span className="mx-auto grid place-items-center h-12 w-12 rounded-full bg-rose-500/10 text-rose-600"><ShieldX size={26} /></span>
            <p className="mt-3 font-display text-lg font-bold text-ink-900">Could not verify</p>
            <p className="mt-1 text-sm text-slate-500">{reasonText[d?.reason] || "This credential is not valid."}</p>
            {d?.subject_name && <p className="mt-2 text-xs text-slate-400">Claimed holder: {d.subject_name}</p>}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by <Link to="/" className="text-brand-600 hover:underline">LARE</Link> — verified human competence.
        </p>
      </div>
    </div>
  );
}

function Cell({ v, l, tone = "brand" }) {
  const t = { brand: "text-brand-600", teal: "text-teal-600" };
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className={`font-display text-xl font-bold tabular-nums ${t[tone]}`}>{v}</p>
      <p className="text-[11px] text-slate-400">{l}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
        {Icon && <Icon size={13} />} {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
