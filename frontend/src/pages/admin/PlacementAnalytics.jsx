import { useEffect, useState } from "react";
import {
  ChevronRight, Home, Building2, GitBranch, Users, GraduationCap,
  Briefcase, CheckCircle2, Target, TrendingUp,
} from "lucide-react";
import { Card, Badge } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../../components/ui/states.jsx";
import { MasteryBar } from "../../components/charts.jsx";
import { api } from "../../lib/api.js";

// Placement readiness across the hierarchy — Platform → College → Branch →
// Section → Student. Eligible = CGPA ≥ 6.0; placement-ready = readiness ≥ 60.
// Scope-clipped: a TPO sees their college, a Dean their branch, etc.
const CHILD_META = {
  college: { icon: Building2, label: "Colleges" },
  branch: { icon: GitBranch, label: "Branches" },
  section: { icon: Users, label: "Sections" },
  student: { icon: GraduationCap, label: "Students" },
};
const CAT_LABEL = { aptitude: "Aptitude", coding: "Coding", communication: "Communication", technical: "Technical Interview", hr: "HR Interview" };

export default function PlacementAnalytics() {
  const [path, setPath] = useState([{ level: "platform", id: null, label: "Platform" }]);
  const [node, setNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [names, setNames] = useState({ college: {}, branch: {}, cohort: {} });

  const cur = path[path.length - 1];
  const collegeId = path.find((p) => p.level === "college")?.id;

  useEffect(() => {
    api.colleges().then((cs) =>
      setNames((n) => ({ ...n, college: Object.fromEntries((cs || []).map((c) => [c.id, c.name])) }))).catch(() => {});
  }, []);
  useEffect(() => {
    if (!collegeId) return;
    api.collegeBranches(collegeId).then((bs) =>
      setNames((n) => ({ ...n, branch: { ...n.branch, ...Object.fromEntries((bs || []).map((b) => [b.id, b.name || b.code])) } }))).catch(() => {});
    api.collegeCohorts(collegeId).then((cs) =>
      setNames((n) => ({ ...n, cohort: { ...n.cohort, ...Object.fromEntries((cs || []).map((c) => [c.id, `Year ${c.year_no}${c.section ? ` · ${c.section}` : ""}`])) } }))).catch(() => {});
  }, [collegeId]);

  useEffect(() => {
    setLoading(true); setErr("");
    api.placementRollup(cur.level, cur.id).then(setNode)
      .catch((e) => setErr(e.message || "Could not load placement analytics."))
      .finally(() => setLoading(false));
  }, [path]);

  function childLabel(c) {
    const cl = node.child_level;
    if (cl === "college") return names.college[c.id] || c.id;
    if (cl === "branch") return names.branch[c.id] || "Branch";
    if (cl === "section") return names.cohort[c.id] || "Section";
    return c.name;
  }
  const drill = (c) => setPath((p) => [...p, { level: node.child_level, id: c.id, label: childLabel(c) }]);
  const goTo = (i) => setPath((p) => p.slice(0, i + 1));

  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  return (
    <div>
      <PageHeader title="Placement Readiness"
        subtitle="Who's eligible and placement-ready across your scope — drill from the platform to a single student." />

      <div className="flex items-center flex-wrap gap-0.5 mb-5 text-sm">
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
            <button onClick={() => goTo(i)} className={`px-2 py-1 rounded-md hover:bg-slate-100 flex items-center gap-1
              ${i === path.length - 1 ? "font-semibold text-ink-900" : "text-slate-500"}`}>
              {i === 0 && <Home size={13} />}{p.label}
            </button>
          </span>
        ))}
      </div>

      {err && <div className="rounded-md bg-rose-500/10 text-rose-600 text-sm px-3.5 py-2.5 mb-4">{err}</div>}

      {loading || !node ? <Loading /> : node.learners === 0 ? (
        <EmptyState title="No learners in scope" hint="Nothing to report for this unit." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Users} tone="brand" label="Learners" value={node.learners.toLocaleString()} />
            <Kpi icon={CheckCircle2} tone="teal" label="Eligible (CGPA ≥ 6)"
              value={`${pct(node.eligible, node.learners)}%`} foot={`${node.eligible.toLocaleString()} students`} bar={pct(node.eligible, node.learners)} barTone="#0d9488" />
            <Kpi icon={Briefcase} tone="amber" label="Placement-ready"
              value={`${pct(node.ready, node.learners)}%`} foot={`${node.ready.toLocaleString()} students`} bar={pct(node.ready, node.learners)} barTone="#f59e0b" />
            <Kpi icon={TrendingUp} tone="violet" label="Avg readiness" value={`${node.avg_readiness}%`} bar={node.avg_readiness} barTone="#7c3aed" />
          </div>

          <div className="grid lg:grid-cols-[1fr_1.3fr] gap-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2 mb-4">
                <Target size={15} className="text-amber-500" /> Readiness by area
              </h3>
              <div className="space-y-3.5">
                {Object.entries(node.categories).map(([k, v]) => (
                  <MasteryBar key={k} label={CAT_LABEL[k] || k} pct={v} small />
                ))}
              </div>
            </Card>

            {node.child_level === "student"
              ? <StudentTable students={node.children} />
              : <UnitComparison node={node} childLabel={childLabel} onDrill={drill} />}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, foot, tone, bar, barTone }) {
  const toneCls = { brand: "bg-brand-500/10 text-brand-600", teal: "bg-teal-500/10 text-teal-600",
    amber: "bg-amber-500/10 text-amber-600", violet: "bg-violet-500/10 text-violet-600" }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`grid place-items-center h-7 w-7 rounded-md ${toneCls}`}><Icon size={15} /></span>
      </div>
      <p className="mt-2 text-3xl font-display font-semibold text-ink-900 tabular-nums leading-none">{value}</p>
      {bar != null && (
        <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, bar)}%`, background: barTone }} />
        </div>
      )}
      {foot && <p className="mt-1.5 text-xs text-slate-400">{foot}</p>}
    </Card>
  );
}

function UnitComparison({ node, childLabel, onDrill }) {
  const meta = CHILD_META[node.child_level] || CHILD_META.college;
  const Icon = meta.icon;
  const kids = [...node.children].sort((a, b) => (b.ready / (b.learners || 1)) - (a.ready / (a.learners || 1)));
  if (!kids.length) return <EmptyState title={`No ${meta.label.toLowerCase()}`} hint="Nothing in scope." />;
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2 mb-3">
        <Icon size={15} className="text-brand-500" /> {meta.label} — ranked by placement-ready %
      </h3>
      <div className="space-y-1">
        {kids.map((c, i) => {
          const readyPct = c.learners ? Math.round((c.ready / c.learners) * 100) : 0;
          return (
            <button key={c.id} onClick={() => onDrill(c)}
              className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-slate-50 group flex items-center gap-3">
              <span className="shrink-0 grid place-items-center h-6 w-6 rounded-md text-[11px] font-bold tabular-nums text-slate-500 bg-slate-100">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-ink-900 truncate group-hover:text-brand-700">{childLabel(c)}</span>
                  <span className="flex items-center gap-2 shrink-0 text-xs tabular-nums">
                    <span className="text-slate-400">{c.learners} learners</span>
                    <span className="font-bold w-10 text-right text-amber-600">{readyPct}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${readyPct}%` }} />
                </div>
              </div>
              <ChevronRight size={15} className="text-slate-300 group-hover:text-brand-500 shrink-0" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function StudentTable({ students }) {
  if (!students.length) return <EmptyState title="No students" hint="Nothing in scope." />;
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-ink-900">Students — by readiness</div>
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">Student</th>
              <th className="px-5 py-3 font-medium">Roll</th>
              <th className="px-5 py-3 font-medium tabular-nums">CGPA</th>
              <th className="px-5 py-3 font-medium tabular-nums">Readiness</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-2.5 font-medium text-ink-900">{s.name}</td>
                <td className="px-5 py-2.5 text-slate-500">{s.roll_no}</td>
                <td className="px-5 py-2.5 tabular-nums text-slate-600">{s.cgpa ?? "—"}</td>
                <td className="px-5 py-2.5 tabular-nums font-semibold text-amber-600">{s.readiness}%</td>
                <td className="px-5 py-2.5">
                  {s.ready ? <Badge tone="teal">ready</Badge>
                    : s.eligible ? <Badge tone="amber">eligible</Badge>
                    : <Badge tone="slate">building</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
