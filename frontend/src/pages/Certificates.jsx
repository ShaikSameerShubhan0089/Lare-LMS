import { useState } from "react";
import { Award, ShieldCheck, Search, ExternalLink, BadgeCheck } from "lucide-react";
import { Card, Badge, Button, Field, Input } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource, EmptyState } from "../components/ui/states.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../lib/auth.jsx";
import { api, withFallback } from "../lib/api.js";
import { demoCertificates, DEMO_LEARNER_ID } from "../lib/demo.js";

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
            <Card key={c.verify_id || c.year_no} className="p-6 relative overflow-hidden">
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
                    {c.verify_id && (
                      <a
                        href={`/verify/${c.verify_id}`}
                        className="text-sm text-brand-600 hover:underline flex items-center gap-1"
                      >
                        Public verify link <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {certs.length === 0 && (
            <EmptyState title="No certificates yet" hint="Complete a programme year to earn your first certificate — it auto-issues." />
          )}
        </div>
        <VerifyWidget />
      </div>
    </div>
  );
}

function VerifyWidget() {
  const [vid, setVid] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function verify(e) {
    e.preventDefault();
    if (!vid) return;
    setBusy(true);
    try {
      const r = await api.verifyCertificate(vid);
      setResult(r);
    } catch {
      setResult({ valid: false, error: true });
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-6 h-fit">
      <h2 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2">
        <Search size={18} className="text-brand-500" /> Verify a certificate
      </h2>
      <p className="text-xs text-slate-400 mb-4">Public, unguessable verification — anyone can confirm a certificate.</p>
      <form onSubmit={verify} className="flex gap-2">
        <Input value={vid} onChange={(e) => setVid(e.target.value)} placeholder="verify id" />
        <Button type="submit" disabled={busy}>Verify</Button>
      </form>
      {result && (
        <div className={`mt-4 rounded-md p-4 text-sm ${result.valid ? "bg-teal-500/10 text-teal-700" : "bg-rose-500/10 text-rose-700"}`}>
          {result.valid ? (
            <>
              <p className="font-semibold flex items-center gap-1.5"><ShieldCheck size={15} /> Valid certificate</p>
              <p className="mt-1">{result.certificate} · {result.holder_name}</p>
              <p className="text-xs opacity-80 mt-0.5">{result.cert_no}</p>
            </>
          ) : (
            <p className="font-semibold">{result.error ? "Not found" : "Not valid"}</p>
          )}
        </div>
      )}
    </Card>
  );
}
