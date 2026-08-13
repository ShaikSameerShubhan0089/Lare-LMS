import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Building2, MapPin, Clock, ChevronRight, X, Trash2, Search, Command, Rocket, Trophy, GitBranch } from "lucide-react";
import { Card, Button, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading } from "../../components/ui/states.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { api, withFallback } from "../../lib/api.js";
import { ReadOut, Attention, bandHex } from "../../components/drive/grammar.jsx";
import CommandPalette from "../../components/drive/CommandPalette.jsx";
import { TiltCard } from "../../components/ui/Decor.jsx";

/* Cross-drive Command Center — the operating console across every drive.
   Real data: api.drives() + api.funnel(id) per drive. */
export default function RecruiterDrives() {
  const drivesA = useAsync(() => withFallback(api.drives(), []), []);
  const [creating, setCreating] = useState(false);
  const [extra, setExtra] = useState([]);
  const [removed, setRemoved] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [funnels, setFunnels] = useState({}); // driveId -> {total,by_status}

  const all = [...(drivesA.data || []), ...extra].filter((d) => !removed.has(d.id));

  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(all.map(async (d) => [d.id, await api.funnel(d.id).catch(() => ({ total: 0, by_status: {} }))]));
      if (alive) setFunnels(Object.fromEntries(entries));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivesA.data, extra.length]);

  if (drivesA.loading) return <Loading />;

  const query = q.trim().toLowerCase();
  const list = all.filter((d) => {
    const mq = !query || [d.title, d.company_name, d.venue].some((v) => (v || "").toLowerCase().includes(query));
    const ms = statusF === "all" || d.status === statusF;
    return mq && ms;
  });

  const stat = (d) => funnels[d.id] || { total: 0, by_status: {} };
  const flightOf = (f) => (f.by_status?.shortlisted || 0) + (f.by_status?.in_round || 0);
  const healthOf = (d) => {
    if (d.status === "draft") return "neutral";
    const f = stat(d); const sel = f.by_status?.selected || 0; const fl = flightOf(f);
    if (!f.total) return "neutral";
    if (fl > 0 && sel === 0 && f.total >= 10) return "warn";
    return "good";
  };

  const openDrives = all.filter((d) => d.status === "open").length;
  const totalPool = all.reduce((n, d) => n + (stat(d).total || 0), 0);
  const totalFlight = all.reduce((n, d) => n + flightOf(stat(d)), 0);
  const totalSelected = all.reduce((n, d) => n + (stat(d).by_status?.selected || 0), 0);

  const actions = [];
  const drafts = all.filter((d) => d.status === "draft");
  if (drafts.length) actions.push({ priority: "high", tone: "warn", icon: Rocket, title: `${drafts.length} drive${drafts.length > 1 ? "s are" : " is"} in draft`, detail: "Open them to start receiving and screening candidates.", actions: [{ label: "Review drafts", primary: true, onClick: () => setStatusF("draft") }] });
  const stalled = all.filter((d) => healthOf(d) === "warn");
  if (stalled.length) actions.push({ priority: "high", tone: "warn", icon: GitBranch, title: `${stalled.length} drive${stalled.length > 1 ? "s" : ""} may be stalled`, detail: "Candidates are in flight but none are selected yet — check for a stage bottleneck.", actions: [{ label: "Open first", primary: true, onClick: () => { window.location.hash = ""; }, }] });
  if (totalSelected) actions.push({ priority: "medium", tone: "teal", icon: Trophy, title: `${totalSelected} candidate${totalSelected > 1 ? "s" : ""} selected across drives`, detail: "Move them to results & offers to close the loop." });

  return (
    <div>
      <CommandPalette />
      <PageHeader
        title="Recruitment Command Center"
        subtitle="Every hiring mission at a glance — state, movement, and what needs attention."
        right={<Button onClick={() => setCreating(true)}><Plus size={18} /> New drive</Button>}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <ReadOut label="Open drives" value={openDrives} hint={`${all.length} total`} />
        <ReadOut label="Candidate pool" value={totalPool} hint="across all drives" />
        <ReadOut label="In flight" value={totalFlight} hint="shortlisted + in-round" />
        <ReadOut label="Selected" value={totalSelected} hint="ready for offer" />
      </div>

      {actions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-surface overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-[13.5px] font-semibold text-ink-900 flex items-center gap-2"><Command size={16} className="text-slate-400" /> Needs attention</h3>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">across all drives</span>
          </div>
          <Attention items={actions} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drives by title, company, venue…" className="h-9 pl-8 w-72" />
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="h-9 px-2 rounded-md border border-slate-200 text-sm bg-surface capitalize">
          {["all", "draft", "open", "closed"].map((st) => <option key={st} value={st}>{st === "all" ? "All statuses" : st}</option>)}
        </select>
        <span className="text-xs text-slate-400">{list.length} of {all.length}</span>
      </div>

      {list.length === 0 && <Card className="p-8 text-center text-slate-400">{all.length ? "No drives match your search." : "No drives yet — create your first one."}</Card>}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((d) => {
          const f = stat(d); const health = healthOf(d); const fl = flightOf(f); const sel = f.by_status?.selected || 0;
          return (
            <TiltCard key={d.id} strength={6} className="rounded-2xl border border-slate-200 bg-surface p-5 hover:shadow-lift transition-shadow">
              <div className="flex items-start justify-between">
                <span className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-invert-800 to-invert-950 text-white shadow-sm"><Building2 size={22} /></span>
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2 py-1 rounded" style={{ background: health === "good" ? "rgba(13,148,136,.1)" : health === "warn" ? "rgba(217,119,6,.12)" : "rgba(100,116,139,.1)", color: bandHex(health) }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: bandHex(health) }} />
                  {d.status === "draft" ? "Draft" : health === "good" ? "On track" : health === "warn" ? "Needs attention" : "Idle"}
                </span>
              </div>
              <h2 className="mt-3 font-display font-semibold text-ink-900 tracking-[-0.01em]">{d.title}</h2>
              <p className="text-sm text-slate-500">{d.company_name}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[["Pool", f.total || 0], ["In flight", fl], ["Selected", sel]].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                    <div className="font-display text-[17px] font-bold text-ink-900 tabular-nums leading-none">{v}</div>
                    <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mt-1">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
                {d.venue && <span className="flex items-center gap-1.5"><MapPin size={13} /> {d.venue}</span>}
                {d.reporting_time && <span className="flex items-center gap-1.5"><Clock size={13} /> {d.reporting_time}</span>}
              </div>
              <div className="flex gap-2 mt-4">
                <Button as={Link} to={`/drive/recruiter/drives/${d.id}`} variant="secondary" className="flex-1">Open console <ChevronRight size={18} /></Button>
                <button onClick={() => del(d)} aria-label="Delete drive" className="grid place-items-center h-11 w-11 rounded-md border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300"><Trash2 size={17} /></button>
              </div>
            </TiltCard>
          );
        })}
      </div>

      {creating && <CreateDrive onClose={() => setCreating(false)} onCreated={(d) => { setExtra((e) => [...e, d]); setCreating(false); }} />}
    </div>
  );

  async function del(d) {
    if (!window.confirm(`Delete "${d.title}"? This permanently removes the drive and all its rounds, marks, registrations, and results.`)) return;
    try { await api.deleteDrive(d.id); } catch { /* still hide locally */ }
    setRemoved((r) => new Set(r).add(d.id));
  }
}

function CreateDrive({ onClose, onCreated }) {
  const [form, setForm] = useState({ company_name: "", title: "", venue: "", reporting_time: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const body = { company_id: form.company_name.toLowerCase().replace(/\s+/g, "-"), ...form };
    try { const created = await api.createDrive(body); onCreated(created); }
    catch { onCreated({ id: `local-${Date.now()}`, status: "draft", ...form }); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-invert-950/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-ink-900">New recruitment drive</h2>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-md hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Company name"><Input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Lare Consulting & Technologies Pvt. Ltd." /></Field>
          <Field label="Drive title"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="SWE Intern Drive 2027" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Venue"><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Aditya College" /></Field>
            <Field label="Reporting time"><Input value={form.reporting_time} onChange={(e) => setForm({ ...form, reporting_time: e.target.value })} placeholder="9:00 AM" /></Field>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create drive"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
