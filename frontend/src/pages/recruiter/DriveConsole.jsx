import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Briefcase, Users, ListChecks, SlidersHorizontal, Rocket,
  Plus, Check, ChevronRight, Award, BarChart3, Trophy, MessagesSquare,
  ChevronUp, ChevronDown, Trash2, CheckCircle2, Search,
} from "lucide-react";
import { Card, Badge, Button, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource } from "../../components/ui/states.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { api, withFallback } from "../../lib/api.js";
import { demoDriveDetail, demoRegistrations, demoFunnel } from "../../lib/demo.js";
import ResultsTab from "./ResultsTab.jsx";
import InterviewsTab from "./InterviewsTab.jsx";
import RoundsTab from "./RoundsTab.jsx";
import AnalyticsTab from "./AnalyticsTab.jsx";

const TABS = [
  { id: "overview", label: "Overview", icon: Briefcase },
  { id: "config", label: "Roles & Rounds", icon: ListChecks },
  { id: "eligibility", label: "Eligibility", icon: SlidersHorizontal },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "rounds", label: "Rounds & Marks", icon: CheckCircle2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "interviews", label: "Interviews", icon: MessagesSquare },
  { id: "results", label: "Results & Offers", icon: Trophy },
  { id: "ppo", label: "PPO", icon: Award },
];

export default function DriveConsole() {
  const { id } = useParams();
  const detail = useAsync(() => withFallback(api.drive(id), demoDriveDetail), [id]);
  const [tab, setTab] = useState("overview");
  const [drive, setDrive] = useState(null);

  if (detail.loading) return <Loading />;
  const d = drive || detail.data;

  return (
    <div>
      <Link to="/drive/recruiter/drives" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900 mb-3">
        <ArrowLeft size={16} /> All drives
      </Link>
      <PageHeader
        title={d.title}
        subtitle={d.company_name}
        right={
          <div className="flex items-center gap-3">
            <DataSource live={detail.live} />
            <Badge tone={d.status === "open" ? "teal" : "slate"}>{d.status}</Badge>
            {d.status !== "open" && (
              <Button
                onClick={async () => {
                  try {
                    await api.openDrive(id);
                  } catch { /* demo */ }
                  setDrive({ ...d, status: "open" });
                }}
              >
                <Rocket size={17} /> Open drive
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 h-11 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === t.id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-slate-500 hover:text-ink-900"
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview d={d} id={id} />}
      {tab === "config" && <Config d={d} id={id} onChange={setDrive} />}
      {tab === "eligibility" && <Eligibility id={id} />}
      {tab === "candidates" && <Candidates id={id} rounds={(d.rounds || []).length} />}
      {tab === "rounds" && <RoundsTab id={id} />}
      {tab === "analytics" && <AnalyticsTab id={id} />}
      {tab === "interviews" && <InterviewsTab id={id} />}
      {tab === "results" && <ResultsTab id={id} />}
      {tab === "ppo" && <Ppo id={id} />}
    </div>
  );
}

function Overview({ d, id }) {
  const funnel = useAsync(() => withFallback(api.funnel(id), demoFunnel), [id]);
  const f = funnel.data || { total: 0, by_status: {} };
  const stages = ["applied", "shortlisted", "in_round", "selected"];
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="p-6 lg:col-span-2">
        <h2 className="font-display font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-brand-500" /> Recruitment funnel
        </h2>
        <div className="space-y-3">
          {stages.map((st) => {
            const v = f.by_status?.[st] || 0;
            const pct = f.total ? Math.round((v / f.total) * 100) : 0;
            return (
              <div key={st}>
                <div className="flex justify-between text-sm mb-1 capitalize">
                  <span className="text-slate-600">{st.replace("_", " ")}</span>
                  <span className="tabular-nums text-slate-500">{v}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="space-y-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Roles</p>
          <p className="font-display text-2xl font-semibold text-ink-900">{(d.roles || []).length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Rounds</p>
          <p className="font-display text-2xl font-semibold text-ink-900">{(d.rounds || []).length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Total registrations</p>
          <p className="font-display text-2xl font-semibold text-ink-900">{f.total}</p>
        </Card>
      </div>
    </div>
  );
}

const STAGE_TYPES = ["aptitude", "technical", "verbal", "coding", "sql", "gd", "interview", "hr", "custom"];

function Config({ d, id, onChange }) {
  const [roles, setRoles] = useState(d.roles || []);
  const [role, setRole] = useState({ title: "", ctc: "", positions: 1, skillsText: "" });

  // "Arrays, SQL:2, Python" -> [{name:"Arrays",weight:1},{name:"SQL",weight:2},...]
  function parseSkills(text) {
    return (text || "").split(",").map((t) => t.trim()).filter(Boolean).map((t) => {
      const [name, w] = t.split(":").map((x) => x.trim());
      const weight = Number(w);
      return { name, weight: weight > 0 ? weight : 1 };
    });
  }

  // Fully-customisable round pipeline (persisted via the workflow engine).
  const [stages, setStages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const wf = await api.getWorkflow(id).catch(() => null);
      if (wf && wf.length) {
        setStages(wf.map((s) => ({ type: s.type, label: s.label || "", optional: !!s.optional })));
      } else {
        setStages((d.rounds || []).map((r) => ({ type: r.type, label: r.label || "", optional: !!r.optional })));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addRole(e) {
    e.preventDefault();
    const skills = parseSkills(role.skillsText);
    const payload = { title: role.title, ctc: role.ctc, positions: Number(role.positions), skills };
    let created;
    try {
      created = await api.addRole(id, payload);
    } catch {
      created = { id: `r-${Date.now()}`, ...payload };
    }
    const next = [...roles, created];
    setRoles(next);
    onChange({ ...d, roles: next });
    setRole({ title: "", ctc: "", positions: 1, skillsText: "" });
  }

  const addStage = () => setStages((s) => [...s, { type: "aptitude", label: "", optional: false }]);
  const updateStage = (i, patch) => setStages((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const removeStage = (i) => setStages((s) => s.filter((_, j) => j !== i));
  const move = (i, dir) => setStages((s) => {
    const j = i + dir;
    if (j < 0 || j >= s.length) return s;
    const copy = [...s]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });

  async function savePipeline() {
    setSaving(true); setSaved(false);
    const payload = stages.map((s, i) => ({
      order: i + 1, type: s.type, label: s.label || s.type, optional: s.optional,
    }));
    try {
      const wf = await api.setWorkflow(id, payload);
      onChange({ ...d, rounds: wf }); // reflect across all tabs of this drive
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      onChange({ ...d, rounds: payload });
    } finally { setSaving(false); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <h2 className="font-display font-semibold text-ink-900 mb-4">Roles</h2>
        <div className="space-y-2 mb-4">
          {roles.map((r) => (
            <div key={r.id} className="rounded-md border border-slate-100 p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{r.title}</p>
                <p className="text-xs text-slate-500">{r.ctc || "—"} · {r.positions} positions</p>
                {(r.skills || []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.skills.map((sk) => (
                      <span key={sk.name} className="rounded bg-brand-500/10 text-brand-700 px-1.5 py-0.5 text-[11px]">
                        {sk.name}{sk.weight > 1 ? `·${sk.weight}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Briefcase size={16} className="text-slate-300 shrink-0" />
            </div>
          ))}
          {roles.length === 0 && <p className="text-sm text-slate-400">No roles yet.</p>}
        </div>
        <form onSubmit={addRole} className="space-y-3 border-t border-slate-100 pt-4">
          <Field label="Role title">
            <Input required value={role.title} onChange={(e) => setRole({ ...role, title: e.target.value })} placeholder="Software Engineer" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CTC">
              <Input value={role.ctc} onChange={(e) => setRole({ ...role, ctc: e.target.value })} placeholder="6 LPA" />
            </Field>
            <Field label="Positions">
              <Input type="number" min="1" value={role.positions} onChange={(e) => setRole({ ...role, positions: e.target.value })} />
            </Field>
          </div>
          <Field label="Required skills" hint="Comma-separated. Add a weight with ':' — e.g. Arrays, SQL:2, Python. Powers candidate skill-matching.">
            <Input value={role.skillsText} onChange={(e) => setRole({ ...role, skillsText: e.target.value })} placeholder="Arrays, SQL:2, Python" />
          </Field>
          <Button type="submit" variant="secondary" className="w-full"><Plus size={16} /> Add role</Button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-ink-900">Round pipeline</h2>
          {saved && <Badge tone="teal"><CheckCircle2 size={13} /> Saved</Badge>}
        </div>
        <p className="text-xs text-slate-400 mb-3">Build the exact stages for this drive — reorder, rename, and mark optional rounds. Saved to the drive and shown everywhere.</p>

        <div className="space-y-2 mb-4">
          {stages.map((s, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-2.5 flex items-center gap-2">
              <span className="grid place-items-center h-7 w-7 rounded-md bg-ink-900 text-white text-sm font-semibold shrink-0">{i + 1}</span>
              <select
                value={s.type}
                onChange={(e) => updateStage(i, { type: e.target.value })}
                className="h-9 px-2 rounded-md border border-slate-200 text-sm bg-white"
              >
                {STAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Input
                value={s.label}
                onChange={(e) => updateStage(i, { label: e.target.value })}
                placeholder="Label (e.g. Aptitude Test)"
                className="h-9 flex-1"
              />
              <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0" title="Optional round">
                <input type="checkbox" checked={s.optional} onChange={(e) => updateStage(i, { optional: e.target.checked })} className="accent-brand-500" />
                opt
              </label>
              <div className="flex flex-col shrink-0">
                <button onClick={() => move(i, -1)} className="text-slate-300 hover:text-ink-900 leading-none"><ChevronUp size={14} /></button>
                <button onClick={() => move(i, 1)} className="text-slate-300 hover:text-ink-900 leading-none"><ChevronDown size={14} /></button>
              </div>
              <button onClick={() => removeStage(i)} className="text-slate-300 hover:text-rose-500 shrink-0"><Trash2 size={15} /></button>
            </div>
          ))}
          {stages.length === 0 && <p className="text-sm text-slate-400">No rounds yet — add your first stage.</p>}
        </div>

        <div className="flex gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={addStage} className="flex-1"><Plus size={16} /> Add stage</Button>
          <Button onClick={savePipeline} disabled={saving}>{saving ? "Saving…" : "Save pipeline"}</Button>
        </div>
      </Card>
    </div>
  );
}

function Eligibility({ id }) {
  const [form, setForm] = useState({ min_cgpa: 7, branches: "CSE, CSE-AI", max_backlogs: 0, passing_year: 2027, max_age: "" });
  const [saved, setSaved] = useState(false);

  async function save(e) {
    e.preventDefault();
    const body = {
      min_cgpa: Number(form.min_cgpa),
      branches: form.branches.split(",").map((b) => b.trim()).filter(Boolean),
      max_backlogs: Number(form.max_backlogs),
      passing_year: Number(form.passing_year),
      max_age: form.max_age ? Number(form.max_age) : null,
    };
    try {
      await api.setEligibility(id, body);
    } catch { /* demo */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card className="p-6 max-w-lg">
      <h2 className="font-display font-semibold text-ink-900 mb-4">Eligibility criteria</h2>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Minimum CGPA">
            <Input type="number" step="0.1" value={form.min_cgpa} onChange={(e) => setForm({ ...form, min_cgpa: e.target.value })} />
          </Field>
          <Field label="Max backlogs">
            <Input type="number" value={form.max_backlogs} onChange={(e) => setForm({ ...form, max_backlogs: e.target.value })} />
          </Field>
        </div>
        <Field label="Allowed branches (comma-separated)">
          <Input value={form.branches} onChange={(e) => setForm({ ...form, branches: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Passing year">
            <Input type="number" value={form.passing_year} onChange={(e) => setForm({ ...form, passing_year: e.target.value })} />
          </Field>
          <Field label="Max age" hint="Optional.">
            <Input type="number" value={form.max_age} onChange={(e) => setForm({ ...form, max_age: e.target.value })} placeholder="—" />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit"><Check size={17} /> Save criteria</Button>
          {saved && <span className="text-sm text-teal-600 flex items-center gap-1.5"><Check size={16} /> Saved</span>}
        </div>
      </form>
    </Card>
  );
}

function Candidates({ id, rounds }) {
  const regs = useAsync(() => withFallback(api.driveRegistrations(id), demoRegistrations), [id]);
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const list = rows ?? regs.data ?? [];

  const query = q.trim().toLowerCase();
  const filtered = list.filter((r) => {
    const matchesQ = !query || [r.candidate_name, r.candidate_email, r.candidate_roll, r.candidate_id]
      .some((v) => (v || "").toLowerCase().includes(query));
    const matchesS = statusF === "all" || r.status === statusF;
    return matchesQ && matchesS;
  });
  const STATUSES = ["all", "applied", "shortlisted", "in_round", "selected", "rejected"];

  if (regs.loading) return <Loading />;

  function update(cid, patch) {
    setRows(list.map((r) => (r.candidate_id === cid ? { ...r, ...patch } : r)));
  }

  async function shortlist(cid) {
    try { await api.shortlist(id, [cid]); } catch { /* demo */ }
    update(cid, { status: "shortlisted", current_round: 1 });
  }
  async function advance(cid, cur) {
    try { await api.advance(id, cid); } catch { /* demo */ }
    const next = cur + 1;
    update(cid, next > rounds ? { status: "selected" } : { status: "in_round", current_round: next });
  }

  const statusTone = { applied: "slate", shortlisted: "brand", in_round: "amber", selected: "teal", rejected: "rose" };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
        <h2 className="font-display font-semibold text-ink-900">
          Registered candidates
          <span className="ml-2 text-sm font-normal text-slate-400">{filtered.length} of {list.length}</span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, roll…" className="h-9 pl-8 w-56" />
          </div>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
            className="h-9 px-2 rounded-md border border-slate-200 text-sm bg-white capitalize">
            {STATUSES.map((st) => <option key={st} value={st}>{st === "all" ? "All statuses" : st.replace("_", " ")}</option>)}
          </select>
          <DataSource live={regs.live} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left font-medium px-5 py-3">Candidate</th>
              <th className="text-left font-medium px-5 py-3">Eligible</th>
              <th className="text-left font-medium px-5 py-3">Status</th>
              <th className="text-left font-medium px-5 py-3">Round</th>
              <th className="text-right font-medium px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                {list.length ? "No candidates match your search." : "No candidates yet."}
              </td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.candidate_id} className="border-t border-slate-100">
                <td className="px-5 py-3 font-medium text-ink-900">
                  {r.candidate_name || r.candidate_email ? (
                    <div className="leading-tight">
                      <span>{r.candidate_name || r.candidate_email}</span>
                      {r.candidate_email && (
                        <span className="block text-xs text-slate-400">{r.candidate_email}</span>
                      )}
                      {r.candidate_roll && (
                        <span className="block text-xs text-slate-400">Roll: {r.candidate_roll}</span>
                      )}
                    </div>
                  ) : (
                    <span className="font-mono text-xs">{r.candidate_id}</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={r.eligible === "yes" ? "teal" : "rose"}>{r.eligible}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={statusTone[r.status] || "slate"}>{r.status.replace("_", " ")}</Badge>
                </td>
                <td className="px-5 py-3 text-slate-500 tabular-nums">
                  {r.current_round > 0 ? `${r.current_round}/${rounds}` : "—"}
                </td>
                <td className="px-5 py-3 text-right">
                  {r.eligible === "no" ? (
                    <span className="text-xs text-slate-400">ineligible</span>
                  ) : r.status === "applied" ? (
                    <Button size="sm" onClick={() => shortlist(r.candidate_id)}>Shortlist</Button>
                  ) : r.status === "selected" ? (
                    <Badge tone="teal"><Check size={13} /> Selected</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => advance(r.candidate_id, r.current_round)}>
                      Advance <ChevronRight size={15} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Ppo({ id }) {
  const [form, setForm] = useState({ top_pct: 15, stages: "internal_tech, hr", min_internship_score: 70 });
  const [saved, setSaved] = useState(false);
  async function save(e) {
    e.preventDefault();
    const body = {
      eligibility: { top_pct: Number(form.top_pct) },
      stages: form.stages.split(",").map((s) => s.trim()).filter(Boolean),
      conversion_criteria: { min_internship_score: Number(form.min_internship_score) },
    };
    try { await api.setPpo(id, body); } catch { /* demo */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }
  return (
    <Card className="p-6 max-w-lg">
      <div className="flex items-center gap-2 mb-1">
        <Award size={18} className="text-amber-500" />
        <h2 className="font-display font-semibold text-ink-900">PPO pipeline</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">Pre-Placement Offer track with Lare Consulting and Technologies Pvt. Ltd.</p>
      <form onSubmit={save} className="space-y-4">
        <Field label="Eligibility — top % by assessment score">
          <Input type="number" value={form.top_pct} onChange={(e) => setForm({ ...form, top_pct: e.target.value })} />
        </Field>
        <Field label="Selection stages (comma-separated)">
          <Input value={form.stages} onChange={(e) => setForm({ ...form, stages: e.target.value })} />
        </Field>
        <Field label="Conversion — min internship score">
          <Input type="number" value={form.min_internship_score} onChange={(e) => setForm({ ...form, min_internship_score: e.target.value })} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit"><Check size={17} /> Save PPO config</Button>
          {saved && <span className="text-sm text-teal-600 flex items-center gap-1.5"><Check size={16} /> Saved</span>}
        </div>
      </form>
    </Card>
  );
}
