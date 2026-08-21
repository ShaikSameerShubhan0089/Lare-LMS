import { useEffect, useState } from "react";
import {
  ChevronRight, Building2, GitBranch, Users, GraduationCap, AlertTriangle,
  BadgeCheck, TrendingUp, Home, BarChart3, Layers,
} from "lucide-react";
import { Card, Badge } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../../components/ui/states.jsx";
import { Donut } from "../../components/charts.jsx";
import { api } from "../../lib/api.js";

// World-class institution analytics — Platform → College → Branch → Section →
// Student. Every rollup is computed from the real roster and clipped to the
// caller's scope, so this one page is each role's own dashboard: Super Admin
// sees the platform, a Principal their college, a Dean their branch, Faculty
// their sections. No fabricated numbers — empty units read as empty.
const CHILD_META = {
  college: { icon: Building2, label: "Colleges", one: "college" },
  branch: { icon: GitBranch, label: "Branches", one: "branch" },
  section: { icon: Users, label: "Sections", one: "section" },
  student: { icon: GraduationCap, label: "Students", one: "student" },
};

const STATUS_COLORS = { active: "#0d9488", paused: "#f59e0b", alumni: "#6366f1", unknown: "#cbd5e1", disabled: "#94a3b8" };
const BAND_ORDER = ["9-10", "8-9", "7-8", "6-7", "<6", "unknown"];
const BAND_COLORS = { "<6": "#e11d48", "6-7": "#f59e0b", "7-8": "#0ea5e9", "8-9": "#14b8a6", "9-10": "#10b981", unknown: "#cbd5e1" };

export default function AnalyticsExplorer() {
  const [path, setPath] = useState([{ level: "platform", id: null, label: "Platform" }]);
  const [node, setNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [names, setNames] = useState({ college: {}, branch: {}, cohort: {} });

  const cur = path[path.length - 1];
  const collegeId = path.find((p) => p.level === "college")?.id;

  useEffect(() => {
    api.colleges().then((cs) =>
      setNames((n) => ({ ...n, college: Object.fromEntries((cs || []).map((c) => [c.id, c.name])) }))
    ).catch(() => {});
  }, []);

  useEffect(() => {
    if (!collegeId) return;
    api.collegeBranches(collegeId).then((bs) =>
      setNames((n) => ({ ...n, branch: { ...n.branch, ...Object.fromEntries((bs || []).map((b) => [b.id, b.name || b.code])) } }))
    ).catch(() => {});
    api.collegeCohorts(collegeId).then((cs) =>
      setNames((n) => ({ ...n, cohort: { ...n.cohort, ...Object.fromEntries((cs || []).map((c) => [c.id, `Year ${c.year_no}${c.section ? ` · ${c.section}` : ""}`])) } }))
    ).catch(() => {});
  }, [collegeId]);

  useEffect(() => {
    setLoading(true); setErr("");
    api.rosterRollup(cur.level, cur.id).then(setNode)
      .catch((e) => setErr(e.message || "Could not load analytics."))
      .finally(() => setLoading(false));
  }, [path]);

  function childLabel(child) {
    const cl = node.child_level;
    if (cl === "college") return names.college[child.id] || child.id;
    if (cl === "branch") return names.branch[child.id] || "Branch";
    if (cl === "section") return names.cohort[child.id] || "Section";
    return child.name;
  }
  function drill(child) {
    setPath((p) => [...p, { level: node.child_level, id: child.id, label: childLabel(child) }]);
  }
  const goTo = (i) => setPath((p) => p.slice(0, i + 1));

  const verifiedPct = node?.learners ? Math.round((node.verified / node.learners) * 100) : 0;
  const riskPct = node?.learners ? Math.round((node.at_risk / node.learners) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Institution Analytics"
        subtitle="Drill from the whole platform to a single student — every level respects your access scope."
      />

      {/* Breadcrumb */}
      <div className="flex items-center flex-wrap gap-0.5 mb-5 text-sm">
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
            <button onClick={() => goTo(i)}
              className={`px-2 py-1 rounded-md hover:bg-slate-100 flex items-center gap-1 transition
                ${i === path.length - 1 ? "font-semibold text-ink-900" : "text-slate-500"}`}>
              {i === 0 && <Home size={13} />}{p.label}
            </button>
          </span>
        ))}
      </div>

      {err && <div className="rounded-md bg-rose-500/10 text-rose-600 text-sm px-3.5 py-2.5 mb-4">{err}</div>}

      {loading || !node ? <Loading /> : node.learners === 0 ? (
        <EmptyState title="No learners in scope" hint="This unit has no roster records yet." />
      ) : (
        <div className="space-y-5">
          {/* KPI hero */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Users} tone="brand" label="Learners" value={node.learners}
              foot={`${Object.keys(node.status_breakdown || {}).length} status types`} />
            <Kpi icon={BadgeCheck} tone="teal" label="Verified" value={`${verifiedPct}%`}
              foot={`${node.verified} of ${node.learners}`} bar={verifiedPct} barTone="#0d9488" />
            <Kpi icon={TrendingUp} tone="violet" label="Avg CGPA" value={node.avg_cgpa ?? "—"}
              foot={node.avg_cgpa ? `${bandOf(node.avg_cgpa)} standing` : "no CGPA on record"}
              bar={node.avg_cgpa ? node.avg_cgpa * 10 : 0} barTone="#7c3aed" />
            <Kpi icon={AlertTriangle} tone={riskPct >= 20 ? "rose" : "amber"} label="At risk" value={node.at_risk}
              foot={`${riskPct}% of this unit`} bar={riskPct} barTone={riskPct >= 20 ? "#e11d48" : "#f59e0b"} />
          </div>

          {/* Distributions */}
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="p-5">
              <CardTitle icon={BarChart3}>CGPA distribution</CardTitle>
              <CgpaBars bands={node.cgpa_bands} total={node.learners} />
            </Card>
            <Card className="p-5">
              <CardTitle icon={Layers}>Enrolment status</CardTitle>
              <div className="mt-2">
                <Donut
                  centerValue={node.learners} centerLabel="learners"
                  parts={Object.entries(node.status_breakdown || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => ({ label: cap(k), n, color: STATUS_COLORS[k] || "#94a3b8" }))}
                />
              </div>
            </Card>
            <Card className="p-5">
              <CardTitle icon={GraduationCap}>By year of study</CardTitle>
              <YearBars dist={node.year_distribution} total={node.learners} />
            </Card>
          </div>

          {/* Children: comparison, or the student leaf */}
          {node.child_level === "student"
            ? <StudentTable students={node.children} />
            : <UnitComparison node={node} childLabel={childLabel} onDrill={drill} />}
        </div>
      )}
    </div>
  );
}

/* ---------- pieces ---------- */
function bandOf(cgpa) {
  if (cgpa >= 9) return "excellent"; if (cgpa >= 8) return "strong";
  if (cgpa >= 7) return "good"; if (cgpa >= 6) return "fair"; return "at-risk";
}
const cap = (s) => (s || "").charAt(0).toUpperCase() + (s || "").slice(1);

function CardTitle({ icon: Icon, children }) {
  return (
    <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2 mb-1">
      <Icon size={15} className="text-brand-500" /> {children}
    </h3>
  );
}

function Kpi({ icon: Icon, label, value, foot, tone, bar, barTone }) {
  const toneCls = {
    brand: "bg-brand-500/10 text-brand-600", teal: "bg-teal-500/10 text-teal-600",
    violet: "bg-violet-500/10 text-violet-600", amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`grid place-items-center h-7 w-7 rounded-md ${toneCls}`}><Icon size={15} /></span>
      </div>
      <p className="mt-2 text-3xl font-display font-semibold text-ink-900 tabular-nums leading-none">{value}</p>
      {bar != null && (
        <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, bar)}%`, background: barTone }} />
        </div>
      )}
      {foot && <p className="mt-1.5 text-xs text-slate-400">{foot}</p>}
    </Card>
  );
}

function CgpaBars({ bands, total }) {
  const rows = BAND_ORDER.filter((b) => (bands || {})[b]).map((b) => [b, bands[b]]);
  if (!rows.length) return <p className="text-sm text-slate-400 py-6 text-center">No CGPA on record.</p>;
  const max = Math.max(...rows.map(([, n]) => n));
  return (
    <div className="mt-3 space-y-2.5">
      {rows.map(([b, n]) => (
        <div key={b} className="flex items-center gap-3">
          <span className="w-12 text-xs font-medium text-slate-500 tabular-nums shrink-0">{b}</span>
          <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden relative">
            <div className="h-full rounded transition-all" style={{ width: `${(n / max) * 100}%`, background: BAND_COLORS[b] }} />
          </div>
          <span className="w-16 text-right text-xs tabular-nums text-slate-500 shrink-0">
            {n} · {total ? Math.round((n / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

function YearBars({ dist, total }) {
  const rows = Object.entries(dist || {}).filter(([, n]) => n)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  if (!rows.length) return <p className="text-sm text-slate-400 py-6 text-center">No year data.</p>;
  const max = Math.max(...rows.map(([, n]) => n));
  return (
    <div className="mt-3 flex items-end justify-around gap-3 h-[168px]">
      {rows.map(([y, n]) => (
        <div key={y} className="flex flex-col items-center gap-1.5 flex-1">
          <span className="text-xs font-semibold tabular-nums text-ink-800">{n}</span>
          <div className="w-full max-w-[42px] rounded-t bg-gradient-to-t from-brand-600 to-brand-400 transition-all"
            style={{ height: `${Math.max(6, (n / max) * 120)}px` }} />
          <span className="text-[11px] text-slate-400">Yr {y === "0" ? "?" : y}</span>
          <span className="text-[10px] text-slate-400 tabular-nums">{total ? Math.round((n / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  );
}

function UnitComparison({ node, childLabel, onDrill }) {
  const meta = CHILD_META[node.child_level] || CHILD_META.college;
  const Icon = meta.icon;
  const kids = [...node.children].sort((a, b) => (b.avg_cgpa ?? -1) - (a.avg_cgpa ?? -1));
  if (!kids.length) return <EmptyState title={`No ${meta.label.toLowerCase()}`} hint="Nothing in scope here." />;
  const maxLearners = Math.max(...kids.map((k) => k.learners || 0), 1);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <CardTitle icon={Icon}>{meta.label} — ranked by academic standing</CardTitle>
        <span className="text-xs text-slate-400">{kids.length} units · click to drill in</span>
      </div>
      <div className="space-y-1">
        {kids.map((c, i) => {
          const cgpa = c.avg_cgpa;
          const riskPct = c.learners ? Math.round((c.at_risk / c.learners) * 100) : 0;
          return (
            <button key={c.id} onClick={() => onDrill(c)}
              className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-slate-50 transition group flex items-center gap-3">
              <span className="shrink-0 grid place-items-center h-6 w-6 rounded-md text-[11px] font-bold tabular-nums text-slate-500 bg-slate-100">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-ink-900 truncate group-hover:text-brand-700">{childLabel(c)}</span>
                  <span className="flex items-center gap-2 shrink-0 text-xs">
                    {c.at_risk > 0 && <Badge tone={riskPct >= 25 ? "rose" : "amber"}>{c.at_risk} risk</Badge>}
                    <span className="tabular-nums text-slate-400">{c.learners} learners</span>
                    <span className="tabular-nums font-bold w-10 text-right" style={{ color: cgpa == null ? "#94a3b8" : BAND_COLORS[cgpaBand(cgpa)] }}>
                      {cgpa == null ? "—" : cgpa}
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${cgpa == null ? 0 : cgpa * 10}%`, background: cgpa == null ? "#cbd5e1" : BAND_COLORS[cgpaBand(cgpa)] }} />
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

function cgpaBand(c) {
  if (c == null) return "unknown"; if (c < 6) return "<6"; if (c < 7) return "6-7";
  if (c < 8) return "7-8"; if (c < 9) return "8-9"; return "9-10";
}

function StudentTable({ students }) {
  if (!students.length) return <EmptyState title="No students" hint="Nothing in scope for this section." />;
  const rows = [...students].sort((a, b) => (b.at_risk === a.at_risk ? (a.cgpa ?? 99) - (b.cgpa ?? 99) : b.at_risk - a.at_risk));
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <CardTitle icon={GraduationCap}>Students ({students.length})</CardTitle>
        <span className="text-xs text-slate-400">at-risk first</span>
      </div>
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
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-ink-900">{s.name}</td>
                <td className="px-5 py-3 text-slate-500">{s.roll_no}</td>
                <td className="px-5 py-3 tabular-nums font-semibold"
                  style={{ color: s.cgpa == null ? "#94a3b8" : BAND_COLORS[cgpaBand(s.cgpa)] }}>{s.cgpa ?? "—"}</td>
                <td className="px-5 py-3">{s.verified ? <Badge tone="teal">verified</Badge> : <Badge tone="slate">pending</Badge>}</td>
                <td className="px-5 py-3">{s.at_risk ? <Badge tone="rose">at risk</Badge> : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
