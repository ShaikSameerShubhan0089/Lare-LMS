import { useEffect, useState } from "react";
import { BarChart3, Users, CheckCircle2, Percent, Code2, Download, Filter, Trophy, GitBranch, Gauge } from "lucide-react";
import { Card, Button } from "../../components/ui/primitives.jsx";
import { Loading } from "../../components/ui/states.jsx";
import { api, withFallback } from "../../lib/api.js";
import { ReadOut, band, bandHex, initials, hueFor } from "../../components/drive/grammar.jsx";

// World-class drive analytics: recruitment funnel, real score distribution,
// pipeline occupancy, outcome & eligibility mix, and top performers — all
// derived from live drive data (analytics + funnel + registrations). No mocks.
export default function AnalyticsTab({ id }) {
  const [a, setA] = useState(null);       // driveAnalytics
  const [f, setF] = useState(null);       // funnel
  const [regs, setRegs] = useState([]);   // registrations (real marks)
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [an, fn, rg] = await Promise.all([
        api.driveAnalytics(id).catch(() => null),
        withFallback(api.funnel(id), { total: 0, by_status: {} }).then((r) => r.data ?? r).catch(() => ({ total: 0, by_status: {} })),
        withFallback(api.driveRegistrations(id), []).then((r) => r.data ?? r).catch(() => []),
      ]);
      setA(an); setF(fn || { total: 0, by_status: {} }); setRegs(Array.isArray(rg) ? rg : []);
      if (!an) setErr("Written-test analytics aren't available yet.");
      setLoading(false);
    })();
  }, [id]);

  async function download(cleared) {
    setBusy(cleared ? "cleared" : "all"); setErr("");
    try { await api.downloadRoundXlsx(id, 1, cleared); }
    catch (e) { setErr(e?.message || "Export failed."); }
    finally { setBusy(""); }
  }

  if (loading) return <Loading />;

  const w = a?.written || {};
  const c = a?.coding || {};
  const bs = f?.by_status || {};
  const total = a?.total_registered ?? f?.total ?? regs.length ?? 0;

  const inFlight = (bs.shortlisted || 0) + (bs.in_round || 0);
  const selected = bs.selected || 0;
  const rejected = bs.rejected || 0;
  const screening = (bs.applied || 0);

  // Recruitment funnel — real counts, each scaled to the top of the funnel.
  const funnel = [
    { key: "registered", label: "Registered", value: total, tone: "#2563EB" },
    { key: "attended", label: "Attended test", value: w.attended ?? 0, tone: "#2563EB" },
    { key: "cleared", label: "Cleared written", value: w.cleared ?? 0, tone: "#1D4ED8" },
    { key: "inpipe", label: "In rounds", value: inFlight + selected, tone: "#0D9488" },
    { key: "selected", label: "Selected", value: selected, tone: "#0D9488" },
  ];
  const funMax = Math.max(1, ...funnel.map((s) => s.value));

  // Real score distribution (written test bands) + average.
  const dist = w.score_distribution || [];
  const distMax = Math.max(1, ...dist.map((d) => d.count));

  // Pipeline occupancy by current round (from registrations).
  const roundMap = {};
  regs.forEach((r) => { const k = r.current_round || 0; roundMap[k] = (roundMap[k] || 0) + 1; });
  const rounds = Object.keys(roundMap).map(Number).sort((x, y) => x - y)
    .map((k) => ({ label: k === 0 ? "Not started" : `Round ${k}`, count: roundMap[k] }));
  const roundMaxN = Math.max(1, ...rounds.map((r) => r.count));

  // Eligibility split.
  const elig = { yes: 0, no: 0, unknown: 0 };
  regs.forEach((r) => { elig[r.eligible === "yes" ? "yes" : r.eligible === "no" ? "no" : "unknown"]++; });

  // Top performers by real marks.
  const top = regs.filter((r) => r.score != null).sort((x, y) => (y.score || 0) - (x.score || 0)).slice(0, 8);
  const scored = regs.filter((r) => r.score != null).length;

  const outcome = [
    { label: "Selected", n: selected, color: "#0D9488" },
    { label: "In flight", n: inFlight, color: "#F59E0B" },
    { label: "Screening", n: screening, color: "#64748b" },
    { label: "Rejected", n: rejected, color: "#E11D48" },
  ].filter((x) => x.n > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-lg text-ink-900">Drive analytics</h2>
          <p className="text-sm text-slate-500">Recruitment funnel, performance &amp; pipeline — from live drive data.</p>
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

      {err && <div className="rounded-md bg-amber-500/10 text-amber-700 p-3 text-sm">{err}</div>}

      {/* KPI instruments */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <ReadOut label="Registered" value={total} hint="candidate pool" />
        <ReadOut label="Attended" value={w.attended ?? 0} hint={total ? `${Math.round((w.attended || 0) / total * 100)}% of pool` : "written test"} />
        <ReadOut label="Pass rate" value={w.pass_rate ?? 0} unit="%" hint={`avg ${w.avg_percentage ?? 0}%`} />
        <ReadOut label="In flight" value={inFlight} hint="shortlisted + in-round" />
        <ReadOut label="Selected" value={selected} hint={total ? `${Math.round(selected / total * 100)}% conversion` : "ready for offer"} />
      </div>

      {/* Recruitment funnel */}
      <Card className="p-6">
        <h3 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2"><Filter size={18} className="text-brand-500" /> Recruitment funnel</h3>
        <p className="text-xs text-slate-400 mb-4">How the pool narrows at each stage · conversion between stages shown on the right</p>
        <div className="space-y-2.5">
          {funnel.map((st, i) => {
            const prev = i === 0 ? null : funnel[i - 1].value;
            const conv = prev ? Math.round((st.value / (prev || 1)) * 100) : 100;
            return (
              <div key={st.key} className="flex items-center gap-3" title={`${st.label}: ${st.value}`}>
                <div className="w-28 shrink-0 text-[12.5px] text-slate-600 text-right">{st.label}</div>
                <div className="flex-1 h-7 rounded-lg bg-slate-100 overflow-hidden relative">
                  <div className="h-full rounded-lg flex items-center justify-end pr-2 text-white text-[12px] font-semibold tabular-nums transition-all"
                    style={{ width: `${Math.max(6, (st.value / funMax) * 100)}%`, background: st.tone }}>
                    {st.value}
                  </div>
                </div>
                <div className="w-14 shrink-0 text-[11.5px] tabular-nums text-slate-400 text-right">{i === 0 ? "" : `${conv}%`}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Score distribution */}
        <Card className="p-6">
          <h3 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2"><BarChart3 size={18} className="text-brand-500" /> Score distribution</h3>
          <p className="text-xs text-slate-400 mb-4">Written test · average {w.avg_percentage ?? 0}%</p>
          {w.attended ? (
            <div className="space-y-3">
              {dist.map((b) => (
                <div key={b.band} title={`${b.band}: ${b.count}`}>
                  <div className="flex justify-between text-[12.5px] mb-1"><span className="text-slate-600">{b.band}</span><span className="tabular-nums text-slate-500">{b.count}</span></div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(b.count / distMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">No written-test results yet.</p>}
        </Card>

        {/* Pipeline occupancy by round */}
        <Card className="p-6">
          <h3 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2"><GitBranch size={18} className="text-teal-500" /> Pipeline occupancy</h3>
          <p className="text-xs text-slate-400 mb-4">Where candidates sit right now</p>
          {rounds.length ? (
            <div className="space-y-3">
              {rounds.map((r) => (
                <div key={r.label} title={`${r.label}: ${r.count}`}>
                  <div className="flex justify-between text-[12.5px] mb-1"><span className="text-slate-600">{r.label}</span><span className="tabular-nums text-slate-500">{r.count}</span></div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-teal-500" style={{ width: `${(r.count / roundMaxN) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">No candidates yet.</p>}
        </Card>
      </div>

      {/* Outcome + eligibility segmented bars */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-display font-semibold text-ink-900 mb-4 flex items-center gap-2"><Gauge size={18} className="text-brand-500" /> Outcome mix</h3>
          <SegmentBar total={total} parts={outcome} />
        </Card>
        <Card className="p-6">
          <h3 className="font-display font-semibold text-ink-900 mb-4 flex items-center gap-2"><CheckCircle2 size={18} className="text-teal-500" /> Eligibility</h3>
          <SegmentBar total={regs.length} parts={[
            { label: "Eligible", n: elig.yes, color: "#0D9488" },
            { label: "Ineligible", n: elig.no, color: "#E11D48" },
            { label: "Unscreened", n: elig.unknown, color: "#64748b" },
          ].filter((x) => x.n > 0)} />
        </Card>
      </div>

      {/* Top performers + coding */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> Top performers</h3>
          <p className="text-xs text-slate-400 mb-4">By real marks · {scored} of {total} scored</p>
          {top.length ? (
            <div className="space-y-2">
              {top.map((r, i) => {
                const nm = r.candidate_name || r.candidate_id;
                const sc = Math.round(r.score || 0);
                return (
                  <div key={r.candidate_id} className="flex items-center gap-3">
                    <span className="w-5 text-[12px] tabular-nums text-slate-400 text-right">{i + 1}</span>
                    <span className="grid place-items-center h-8 w-8 rounded-lg text-white text-[11px] font-bold shrink-0" style={{ background: hueFor(nm) }}>{initials(nm)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium text-ink-900 truncate">{nm}</div>
                      <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${sc}%`, background: bandHex(band(sc)) }} /></div>
                    </div>
                    <span className="font-display font-bold tabular-nums text-[15px]" style={{ color: bandHex(band(sc)) }}>{sc}</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-slate-400">No marks recorded yet.</p>}
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-semibold text-ink-900 mb-4 flex items-center gap-2"><Code2 size={18} className="text-teal-500" /> Coding performance</h3>
          {c.students_with_coding ? (
            <div className="space-y-2.5 text-sm">
              <Row label="Students with coding" value={c.students_with_coding} />
              <Row label="Attempted coding" value={c.students_attempted} />
              <Row label="Answers correct" value={c.total_correct} />
              <Row label="Total attempted" value={c.total_attempted} />
              <Row label="Coding accuracy" value={`${c.accuracy}%`} highlight />
            </div>
          ) : <p className="text-sm text-slate-400">No coding questions in this drive's written test.</p>}
        </Card>
      </div>
    </div>
  );
}

function SegmentBar({ total, parts }) {
  const sum = parts.reduce((n, p) => n + p.n, 0) || total || 1;
  if (!parts.length) return <p className="text-sm text-slate-400">No data yet.</p>;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 gap-[2px]">
        {parts.map((p) => (
          <div key={p.label} title={`${p.label}: ${p.n}`} style={{ width: `${(p.n / sum) * 100}%`, background: p.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label} <b className="tabular-nums text-ink-900">{p.n}</b>
            <span className="text-slate-400">({Math.round((p.n / sum) * 100)}%)</span>
          </span>
        ))}
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
