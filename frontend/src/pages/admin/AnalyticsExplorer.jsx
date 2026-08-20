import { useEffect, useState } from "react";
import {
  ChevronRight, Building2, GitBranch, Users, GraduationCap, AlertTriangle,
  BadgeCheck, TrendingUp, Home,
} from "lucide-react";
import { Card, Badge } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../../components/ui/states.jsx";
import { api } from "../../lib/api.js";

// Hierarchical analytics: Platform → College → Branch → Section → Student.
// The backend clips every rollup to the caller's data scope, so this same page
// is the Super Admin's platform view, a Principal's college view, a Dean's
// branch view, and a TPO's placement view — each entered at their own ceiling.
const CHILD_META = {
  college: { icon: Building2, label: "Colleges" },
  branch: { icon: GitBranch, label: "Branches" },
  section: { icon: Users, label: "Sections" },
  student: { icon: GraduationCap, label: "Students" },
};

export default function AnalyticsExplorer() {
  const [path, setPath] = useState([{ level: "platform", id: null, label: "Platform" }]);
  const [node, setNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [names, setNames] = useState({ college: {}, branch: {}, cohort: {} });

  const cur = path[path.length - 1];
  const collegeId = path.find((p) => p.level === "college")?.id;

  // college names up front
  useEffect(() => {
    api.colleges().then((cs) => {
      setNames((n) => ({ ...n, college: Object.fromEntries((cs || []).map((c) => [c.id, c.name])) }));
    }).catch(() => {});
  }, []);

  // branch + section names once we're inside a college
  useEffect(() => {
    if (!collegeId) return;
    api.collegeBranches(collegeId).then((bs) => {
      setNames((n) => ({ ...n, branch: { ...n.branch, ...Object.fromEntries((bs || []).map((b) => [b.id, b.name || b.code])) } }));
    }).catch(() => {});
    api.collegeCohorts(collegeId).then((cs) => {
      setNames((n) => ({ ...n, cohort: { ...n.cohort, ...Object.fromEntries((cs || []).map((c) => [c.id, `Year ${c.year_no}${c.section ? ` · Sec ${c.section}` : ""}`])) } }));
    }).catch(() => {});
  }, [collegeId]);

  useEffect(() => {
    setLoading(true); setErr("");
    api.rosterRollup(cur.level, cur.id)
      .then(setNode)
      .catch((e) => setErr(e.message || "Could not load analytics."))
      .finally(() => setLoading(false));
  }, [path]);

  function drill(child) {
    const childLevel = node.child_level; // college|branch|section
    const label =
      childLevel === "college" ? (names.college[child.id] || child.id)
      : childLevel === "branch" ? (names.branch[child.id] || "Branch")
      : childLevel === "section" ? (names.cohort[child.id] || "Section")
      : child.name;
    setPath((p) => [...p, { level: childLevel, id: child.id, label }]);
  }

  function goTo(i) { setPath((p) => p.slice(0, i + 1)); }

  function childLabel(child) {
    const cl = node.child_level;
    if (cl === "college") return names.college[child.id] || child.id;
    if (cl === "branch") return names.branch[child.id] || child.id;
    if (cl === "section") return names.cohort[child.id] || child.id;
    return child.name;
  }

  return (
    <div>
      <PageHeader
        title="Institution Analytics"
        subtitle="Drill from the whole platform down to a single student — every level respects your access scope."
      />

      {/* Breadcrumb */}
      <div className="flex items-center flex-wrap gap-1 mb-4 text-sm">
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
            <button onClick={() => goTo(i)}
              className={`px-2 py-1 rounded-md hover:bg-slate-100 flex items-center gap-1
                ${i === path.length - 1 ? "font-semibold text-ink-900" : "text-slate-500"}`}>
              {i === 0 && <Home size={13} />}{p.label}
            </button>
          </span>
        ))}
      </div>

      {err && <div className="rounded-md bg-rose-500/10 text-rose-600 text-sm px-3.5 py-2.5 mb-4">{err}</div>}

      {loading || !node ? <Loading /> : (
        <>
          {/* Summary tiles for the current node */}
          <div className="grid sm:grid-cols-4 gap-3 mb-5">
            <Tile icon={Users} tone="teal" label="Learners" value={node.learners} />
            <Tile icon={BadgeCheck} tone="violet" label="Verified"
              value={node.learners ? `${Math.round((node.verified / node.learners) * 100)}%` : "—"}
              hint={`${node.verified} of ${node.learners}`} />
            <Tile icon={TrendingUp} tone="amber" label="Avg CGPA"
              value={node.avg_cgpa ?? "—"} />
            <Tile icon={AlertTriangle} tone={node.at_risk ? "rose" : "slate"} label="At risk"
              value={node.at_risk} hint={node.learners ? `${Math.round((node.at_risk / node.learners) * 100)}% of cohort` : ""} />
          </div>

          {/* Children */}
          {node.child_level === "student"
            ? <StudentList students={node.children} />
            : <ChildGrid node={node} names={names} onDrill={drill} childLabel={childLabel} />}
        </>
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, hint, tone }) {
  const toneCls = {
    teal: "bg-teal-500/10 text-teal-600", violet: "bg-violet-500/10 text-violet-600",
    amber: "bg-amber-500/10 text-amber-600", rose: "bg-rose-500/10 text-rose-600",
    slate: "bg-slate-500/10 text-slate-500",
  }[tone] || "bg-slate-500/10 text-slate-500";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className={`grid place-items-center h-8 w-8 rounded-md ${toneCls}`}><Icon size={16} /></span>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-display font-semibold text-ink-900 tabular-nums">{value ?? "—"}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

function ChildGrid({ node, onDrill, childLabel }) {
  const meta = CHILD_META[node.child_level] || CHILD_META.college;
  const Icon = meta.icon;
  if (!node.children.length)
    return <EmptyState title={`No ${meta.label.toLowerCase()} yet`} hint="Nothing in scope at this level." />;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{meta.label}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {node.children.map((c) => {
          const riskPct = c.learners ? Math.round((c.at_risk / c.learners) * 100) : 0;
          return (
            <button key={c.id} onClick={() => onDrill(c)}
              className="text-left rounded-xl border border-slate-100 hover:border-brand-300 hover:shadow-sm bg-surface p-4 transition group">
              <div className="flex items-start justify-between">
                <span className="grid place-items-center h-9 w-9 rounded-md bg-slate-900 text-white"><Icon size={17} /></span>
                {c.at_risk > 0 && <Badge tone={riskPct >= 25 ? "rose" : "amber"}>{c.at_risk} at risk</Badge>}
              </div>
              <p className="mt-3 font-medium text-ink-900 truncate group-hover:text-brand-700">{childLabel(c)}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                <span className="tabular-nums">{c.learners} learners</span>
                {c.avg_cgpa != null && <span className="tabular-nums">CGPA {c.avg_cgpa}</span>}
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-brand-600 opacity-0 group-hover:opacity-100 transition">
                Drill in <ChevronRight size={13} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StudentList({ students }) {
  if (!students.length) return <EmptyState title="No students" hint="Nothing in scope for this section." />;
  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">Student</th>
              <th className="px-5 py-3 font-medium">Roll</th>
              <th className="px-5 py-3 font-medium tabular-nums">CGPA</th>
              <th className="px-5 py-3 font-medium">Verified</th>
              <th className="px-5 py-3 font-medium">Flag</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-ink-900">{s.name}</td>
                <td className="px-5 py-3 text-slate-500">{s.roll_no}</td>
                <td className="px-5 py-3 tabular-nums text-slate-600">{s.cgpa ?? "—"}</td>
                <td className="px-5 py-3">{s.verified
                  ? <Badge tone="teal">verified</Badge> : <Badge tone="slate">pending</Badge>}</td>
                <td className="px-5 py-3">{s.at_risk
                  ? <Badge tone="rose">at risk</Badge> : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
