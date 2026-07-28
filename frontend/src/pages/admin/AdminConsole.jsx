import { useState } from "react";
import { Building2, Users, GraduationCap, CheckCircle2, Upload, Plus, ShieldCheck } from "lucide-react";
import { Card, Badge, Button, Field, Input, StatTile } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource, EmptyState } from "../../components/ui/states.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { api, withFallback } from "../../lib/api.js";
import { demoColleges, demoLearners, demoAdminDash } from "../../lib/demo.js";

// Super Admin / College Admin / TPO console: colleges, learner roster,
// bulk import, and verification.
export default function AdminConsole() {
  const dash = useAsync(() => withFallback(api.dashboard("college_admin"), demoAdminDash), []);
  const colleges = useAsync(() => withFallback(api.colleges(), demoColleges), []);
  const [tab, setTab] = useState("overview");

  if (dash.loading) return <Loading />;
  const d = dash.data || {};

  return (
    <div>
      <PageHeader
        title="Institution Console"
        subtitle="Manage colleges, onboard learners, and track readiness"
        right={<DataSource live={dash.live && colleges.live} />}
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatTile icon={Building2} label="Colleges" value={d.colleges ?? "—"} tone="brand" />
        <StatTile icon={Users} label="Learners" value={d.learners ?? "—"} tone="teal" />
        <StatTile icon={GraduationCap} label="Active drives" value={d.drives ?? "—"} tone="amber" />
      </div>

      <div className="flex gap-2 mb-5">
        {["overview", "learners"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-9 px-4 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-ink-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <Colleges list={colleges.data || []} />
      ) : (
        <LearnerRoster />
      )}
    </div>
  );
}

function Colleges({ list }) {
  const [rows, setRows] = useState(list);
  const [form, setForm] = useState({ name: "", code: "", city: "" });

  async function add(e) {
    e.preventDefault();
    let created;
    try {
      created = await api.createCollege(form);
    } catch {
      created = { id: `c-${Date.now()}`, ...form, learners: 0, verified: false };
    }
    setRows([created, ...rows]);
    setForm({ name: "", code: "", city: "" });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6">
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-display font-semibold text-ink-900">Colleges ({rows.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((c) => (
            <div key={c.id} className="p-4 flex items-center gap-3">
              <span className="grid place-items-center h-10 w-10 rounded-md bg-brand-500/10 text-brand-600 font-semibold">
                {c.code || c.name?.[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900 truncate">{c.name}</p>
                <p className="text-xs text-slate-400">{c.city} · {c.learners ?? 0} learners</p>
              </div>
              {c.verified ? (
                <Badge tone="teal"><ShieldCheck size={13} /> verified</Badge>
              ) : (
                <Badge tone="amber">pending</Badge>
              )}
            </div>
          ))}
          {rows.length === 0 && <EmptyState title="No colleges yet" hint="Add your first college on the right." />}
        </div>
      </Card>

      <Card className="p-6 h-fit">
        <h2 className="font-display font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <Plus size={18} className="text-brand-500" /> Add college
        </h2>
        <form onSubmit={add} className="space-y-3">
          <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Code"><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ACE" /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Button type="submit" className="w-full"><Plus size={16} /> Create college</Button>
        </form>
      </Card>
    </div>
  );
}

function LearnerRoster() {
  const loaded = useAsync(() => withFallback(api.learners(), demoLearners), []);
  const [rows, setRows] = useState(null);
  const [csv, setCsv] = useState("");
  const list = rows ?? loaded.data ?? [];

  if (loaded.loading) return <Loading />;

  async function verify(id) {
    try { await api.verifyLearner(id); } catch { /* demo */ }
    setRows(list.map((l) => (l.id === id ? { ...l, verified: true, status: "active" } : l)));
  }

  async function bulkImport() {
    const learners = csv.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [roll_no, full_name, branch_id, cgpa] = line.split(",").map((x) => x.trim());
      return { roll_no, full_name, branch_id, cgpa: Number(cgpa) || null };
    });
    if (!learners.length) return;
    let added = learners.map((l, i) => ({ id: `n${i}-${Date.now()}`, ...l, year_no: 1, verified: false, status: "pending" }));
    try {
      const res = await api.bulkImportLearners({ learners });
      if (Array.isArray(res?.imported)) added = res.imported;
    } catch { /* demo */ }
    setRows([...added, ...list]);
    setCsv("");
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6">
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-ink-900">Learner roster ({list.length})</h2>
          <DataSource live={loaded.live} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400 border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-4 font-medium">Roll no</th>
                <th className="py-2.5 px-4 font-medium">Name</th>
                <th className="py-2.5 px-4 font-medium">Branch</th>
                <th className="py-2.5 px-4 font-medium">Yr</th>
                <th className="py-2.5 px-4 font-medium">CGPA</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{l.roll_no}</td>
                  <td className="py-2.5 px-4 font-medium text-ink-900">{l.full_name}</td>
                  <td className="py-2.5 px-4 text-slate-500">{l.branch_id}</td>
                  <td className="py-2.5 px-4 tabular-nums">{l.year_no}</td>
                  <td className="py-2.5 px-4 tabular-nums">{l.cgpa ?? "—"}</td>
                  <td className="py-2.5 px-4">
                    {l.verified ? (
                      <Badge tone="teal"><CheckCircle2 size={12} /> verified</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => verify(l.id)}>Verify</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <EmptyState title="No learners" hint="Bulk-import a roster on the right." />}
        </div>
      </Card>

      <Card className="p-6 h-fit">
        <h2 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2">
          <Upload size={18} className="text-brand-500" /> Bulk import
        </h2>
        <p className="text-xs text-slate-400 mb-3">One learner per line: <code>roll_no, name, branch, cgpa</code></p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          className="w-full min-h-[160px] p-3 rounded-md border border-slate-200 text-ink-900 text-sm font-mono"
          placeholder={"21CSE050, Neha S., CSE, 8.1\n21ECE012, Kiran V., ECE, 7.4"}
        />
        <Button className="w-full mt-3" onClick={bulkImport}><Upload size={16} /> Import {csv.split("\n").filter((l) => l.trim()).length || ""}</Button>
      </Card>
    </div>
  );
}
