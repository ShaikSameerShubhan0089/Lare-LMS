import { useState } from "react";
import { Award, ShieldCheck, Search, ExternalLink, BadgeCheck, X, Printer, Download } from "lucide-react";
import { Card, Badge, Button, Input } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource, EmptyState } from "../components/ui/states.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../lib/auth.jsx";
import { api, withFallback } from "../lib/api.js";
import { demoCertificates, DEMO_LEARNER_ID } from "../lib/demo.js";
import { certificateHtml, printCertificate } from "../lib/certificate.js";

// Full static class strings (Tailwind JIT can't see interpolated class names).
const SERIES_ICON = {
  1: "bg-brand-500/10 text-brand-600",
  2: "bg-teal-500/10 text-teal-600",
  3: "bg-amber-500/10 text-amber-600",
  4: "bg-rose-500/10 text-rose-600",
};

export default function Certificates() {
  const { user } = useAuth();
  const learnerId = user?.id || DEMO_LEARNER_ID;
  const loaded = useAsync(() => withFallback(api.certificates(learnerId), demoCertificates), [learnerId]);
  const [selected, setSelected] = useState(null);

  if (loaded.loading) return <Loading />;
  const certs = loaded.data || [];

  return (
    <div>
      <PageHeader
        title="Certificates"
        subtitle="Your 4-year programme certificate series"
        right={<DataSource live={loaded.live} />}
      />
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          {certs.map((c) => (
            <button
              key={c.verify_id || c.year_no}
              onClick={() => setSelected(c)}
              className="w-full text-left"
            >
              <Card className="p-6 relative overflow-hidden hover:border-brand-300 hover:shadow-sm transition">
                <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-amber-400/20 to-transparent rounded-bl-full" />
                <div className="flex items-start gap-4">
                  <span className={`grid place-items-center h-12 w-12 rounded-lg ${SERIES_ICON[c.year_no] || SERIES_ICON[1]}`}>
                    <Award size={26} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-semibold text-ink-900">{c.certificate}</h3>
                      {c.ppo_tag && <Badge tone="amber"><BadgeCheck size={12} /> PPO eligible</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">Year {c.year_no} · {c.cert_no || c.certificate}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <Badge tone={c.status === "issued" ? "teal" : "slate"}>
                        <ShieldCheck size={12} /> {c.status || "issued"}
                      </Badge>
                      <span className="text-sm text-brand-600 flex items-center gap-1">
                        View certificate <ExternalLink size={13} />
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </button>
          ))}
          {certs.length === 0 && (
            <EmptyState title="No certificates yet" hint="Complete a programme year to earn your first certificate — it auto-issues." />
          )}
        </div>
        <VerifyWidget />
      </div>

      {selected && <CertificateModal cert={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CertificateModal({ cert, onClose, verifiedBanner }) {
  const [busy, setBusy] = useState(false);
  const verifyUrl = cert.verify_id ? `${window.location.origin}/verify/${cert.verify_id}` : "";

  async function download() {
    setBusy(true);
    try { await api.downloadCertificatePdf(cert.id, cert.cert_no); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-invert-900/50 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => printCertificate(cert)}><Printer size={16} /> Print</Button>
            {cert.id && (
              <Button variant="secondary" onClick={download} disabled={busy}><Download size={16} /> {busy ? "…" : "Download PDF"}</Button>
            )}
            {verifyUrl && (
              <Button as="a" href={verifyUrl} target="_blank" rel="noreferrer" variant="secondary">
                <ShieldCheck size={16} /> Public verify
              </Button>
            )}
          </div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full bg-white/90 text-slate-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>
        {verifiedBanner && (
          <div className="mb-3 rounded-lg bg-teal-500/10 border border-teal-200 p-3 text-sm text-teal-800 flex items-center gap-2">
            <ShieldCheck size={16} className="text-teal-600" /> Authentic — verified by LARE Learn ({cert.verify_id})
          </div>
        )}
        <div className="rounded-lg shadow-2xl overflow-hidden"
             dangerouslySetInnerHTML={{ __html: certificateHtml(cert) }} />
      </div>
    </div>
  );
}

function VerifyWidget() {
  const [vid, setVid] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(null); // cert-shaped, opens the modal

  async function verify(e) {
    e.preventDefault();
    if (!vid.trim()) return;
    setBusy(true); setError("");
    try {
      const r = await api.verifyCertificate(vid.trim());
      if (r?.valid) {
        // build a cert object for the shared artwork (no id => no PDF download)
        setVerified({
          holder_name: r.holder_name, certificate: r.certificate, cert_no: r.cert_no,
          year_no: r.year_no, issued_at: r.issued_at, ppo_tag: r.ppo_eligible, verify_id: vid.trim(),
        });
      } else {
        setError("This certificate is not valid or has been revoked.");
      }
    } catch {
      setError("No certificate found for that verify id.");
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-6 h-fit">
      <h2 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2">
        <Search size={18} className="text-brand-500" /> Verify a certificate
      </h2>
      <p className="text-xs text-slate-400 mb-4">Enter a certificate's verify id (e.g. LARE-VER-4821) — anyone can confirm it.</p>
      <form onSubmit={verify} className="flex gap-2">
        <Input value={vid} onChange={(e) => setVid(e.target.value)} placeholder="LARE-VER-…" />
        <Button type="submit" disabled={busy}>{busy ? "…" : "Verify"}</Button>
      </form>
      {error && (
        <div className="mt-4 rounded-md p-3 text-sm bg-rose-500/10 text-rose-700">{error}</div>
      )}
      {verified && <CertificateModal cert={verified} onClose={() => setVerified(null)} verifiedBanner />}
    </Card>
  );
}
