import { useEffect, useState } from "react";
import { BarChart3, Users, CheckCircle2, Percent, Code2, Download } from "lucide-react";
import { Card, Button } from "../../components/ui/primitives.jsx";
import { Loading } from "../../components/ui/states.jsx";
import { api } from "../../lib/api.js";

// Admin analytics for a drive's written test (Round 1): attendance, pass rate,
// score distribution, coding stats — plus one-click Excel export of the
// attendees and the cleared students for sharing with college officials.
export default function AnalyticsTab({ id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setData(await api.driveAnalytics(id)); }
      catch { setErr("Could not load analytics yet."); }
      finally { setLoading(false); }
    })();
  }, [id]);

  async function download(cleared) {
    setBusy(cleared ? "cleared" : "all");
    setErr("");
    try { await api.downloadRoundXlsx(id, 1, cleared); }
    catch (e) { setErr(e?.message || "Export failed."); }
    finally { setBusy(""); }
  }

  if (loading) return <Loading />;

  const w = data?.written || {};
  const c = data?.coding || {};
  const dist = w.score_distribution || [];
  const maxBucket = Math.max(1, ...dist.map((d) => d.count));

  const tiles = [
    { label: "Registered", value: data?.total_registered ?? 0, icon: Users, tone: "text-brand-600 bg-brand-500/10" },
    { label: "Attended written test", value: w.attended ?? 0, icon: BarChart3, tone: "text-ink-900 bg-slate-100" },
    { label: "Cleared", value: w.cleared ?? 0, icon: CheckCircle2, tone: "text-teal-600 bg-teal-500/10" },
    { label: "Pass rate", value: `${w.pass_rate ?? 0}%`, icon: Percent, tone: "text-amber-600 bg-amber-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-lg text-ink-900">Drive analytics</h2>
          <p className="text-sm text-slate-500">Written test (Round 1) — attendance, results &amp; coding.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => download(false)} disabled={!!busy}>
            <Download size={16} /> {busy === "all" ? "Preparing…" : "Attendees (Excel)"}
          </Button>
          <Button onClick={() => download(true)} disabled={!!busy}>
            <Download size={16} /> {busy === "cleared" ? "Preparing…" : "Cleared (Excel)"}
          </Button>
        </div>
      </div>

      {err && <div className="rounded-md bg-rose-500/10 text-rose-700 p-3 text-sm">{err}</div>}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <span className={`grid place-items-center h-10 w-10 rounded-lg ${t.tone}`}><t.icon size={20} /></span>
            <p className="mt-3 text-sm text-slate-500">{t.label}</p>
            <p className="font-display text-2xl font-bold text-ink-900">{t.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Score distribution */}
        <Card className="p-6">
          <h3 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-500" /> Score distribution
          </h3>
          <p className="text-xs text-slate-400 mb-4">By percentage · average {w.avg_percentage ?? 0}%</p>
          {w.attended ? (
            <div className="space-y-3">
              {dist.map((b) => (
                <div key={b.band}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{b.band}</span>
                    <span className="tabular-nums text-slate-500">{b.count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${(b.count / maxBucket) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No written-test results yet.</p>
          )}
        </Card>

        {/* Coding stats */}
        <Card className="p-6">
          <h3 className="font-display font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <Code2 size={18} className="text-teal-500" /> Coding questions
          </h3>
          {c.students_with_coding ? (
            <div className="space-y-2.5 text-sm">
              <Row label="Students with coding questions" value={c.students_with_coding} />
              <Row label="Attempted coding" value={c.students_attempted} />
              <Row label="Total answers correct" value={c.total_correct} />
              <Row label="Total attempted" value={c.total_attempted} />
              <Row label="Coding accuracy" value={`${c.accuracy}%`} highlight />
            </div>
          ) : (
            <p className="text-sm text-slate-400">No coding questions in this drive's written test.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className={`flex items-center justify-between rounded-md px-3 py-2 ${highlight ? "bg-teal-500/10" : "bg-slate-50"}`}>
      <span className="text-slate-600">{label}</span>
      <span className={`font-display font-semibold ${highlight ? "text-teal-700" : "text-ink-900"}`}>{value}</span>
    </div>
  );
}
