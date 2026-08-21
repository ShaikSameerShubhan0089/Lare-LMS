import { useEffect, useState } from "react";
import {
  GraduationCap, CheckCircle2, ArrowRight, Lock, Target, Sparkles,
  TrendingUp, BadgeCheck, Layers, Trophy,
} from "lucide-react";
import { Video, FileText, Presentation, BookOpen, Code2, Link2 } from "lucide-react";
import { Card, Badge } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../components/ui/states.jsx";
import { RadialGauge, MasteryBar } from "../components/charts.jsx";
import { api } from "../lib/api.js";

const RES_ICON = { video: Video, slide: Presentation, pdf: FileText, reading: BookOpen, interactive: Code2, link: Link2 };

// A student's personal home: academic / skill / placement readiness at a glance,
// their year-wise roadmap with what's done and what's next, a placement-readiness
// breakdown, and the next recommended actions. Data is scoped to the caller.
const RING = {
  academic: { label: "Academic Progress", color: "#7c3aed", icon: TrendingUp },
  skill: { label: "Skill Development", color: "#0ea5e9", icon: Sparkles },
  placement: { label: "Placement Readiness", color: "#f59e0b", icon: Target },
  course_completion: { label: "Course Completion", color: "#0d9488", icon: Layers },
};

export default function StudentHome() {
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.studentHome()
      .then(setHome)
      .catch((e) => setErr(e.message || "Could not load your dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (err) return <EmptyState title="Dashboard unavailable" hint={err} />;
  if (!home) return null;

  const { profile: p, progress, roadmap, placement_readiness, recommendations } = home;

  return (
    <div>
      <PageHeader
        title={p.name || "My Dashboard"}
        subtitle={`${p.program}${p.branch_code ? ` · ${p.branch_code}` : ""} · ${p.college} · Year ${p.year_no} of ${p.n_years}`}
        right={p.verified
          ? <Badge tone="teal"><BadgeCheck size={13} /> Verified</Badge>
          : <Badge tone="slate">Profile pending</Badge>}
      />

      {/* Progress rings */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {["academic", "skill", "placement", "course_completion"].map((k) => {
          const meta = RING[k]; const Icon = meta.icon;
          return (
            <Card key={k} className="p-4 flex items-center gap-4">
              <RadialGauge value={progress[k] || 0} max={100} color={meta.color} size={92} label="" />
              <div className="min-w-0">
                <span className="grid place-items-center h-7 w-7 rounded-md mb-1"
                  style={{ background: `${meta.color}1a`, color: meta.color }}><Icon size={15} /></span>
                <p className="text-xs font-medium text-slate-500 leading-tight">{meta.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        {/* Roadmap */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
              <GraduationCap size={18} className="text-brand-500" /> Your Learning Roadmap
            </h3>
            {roadmap.curriculum && <Badge tone="violet">{roadmap.curriculum}</Badge>}
          </div>
          {(!roadmap.years || roadmap.years.length === 0) ? (
            <EmptyState title="Roadmap not assigned yet" hint="Your placement cell will assign your roadmap soon." />
          ) : (
            <div className="space-y-3">
              {roadmap.years.map((y) => <YearBlock key={y.year_no} y={y} />)}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          {/* Placement readiness */}
          <Card className="p-5">
            <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2 mb-4">
              <Target size={18} className="text-amber-500" /> Placement Readiness
            </h3>
            <div className="space-y-3.5">
              {placement_readiness.map((x) => (
                <MasteryBar key={x.label} label={x.label} pct={x.pct} small />
              ))}
            </div>
          </Card>

          {/* Next recommended */}
          <Card className="p-5">
            <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2 mb-3">
              <Trophy size={18} className="text-teal-500" /> Next Recommended
            </h3>
            <ul className="space-y-2">
              {recommendations.map((r, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-ink-800 rounded-lg border border-slate-100 px-3 py-2.5">
                  <ArrowRight size={15} className="text-brand-500 shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function YearBlock({ y }) {
  const state = y.current ? "current" : y.past ? "past" : "future";
  const tone = { current: "border-brand-300 bg-brand-500/5", past: "border-teal-200 bg-teal-500/5", future: "border-slate-100" }[state];
  const [openMid, setOpenMid] = useState(null);
  const [res, setRes] = useState(null);
  const [loadingRes, setLoadingRes] = useState(false);

  async function toggle(m) {
    if (openMid === m.id) { setOpenMid(null); return; }
    setOpenMid(m.id); setRes(null); setLoadingRes(true);
    try { setRes(await api.moduleResources(m.id)); } catch { setRes({ topics: [] }); }
    finally { setLoadingRes(false); }
  }

  return (
    <div className={`rounded-xl border ${tone} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`grid place-items-center h-7 w-7 rounded-md text-white text-xs font-bold
            ${y.current ? "bg-brand-600" : y.past ? "bg-teal-600" : "bg-slate-400"}`}>Y{y.year_no}</span>
          <div>
            <p className="font-semibold text-ink-900 text-sm leading-tight">{y.theme || `Year ${y.year_no}`}</p>
            {y.goal && <p className="text-xs text-slate-400">{y.goal}</p>}
          </div>
        </div>
        {y.current && <Badge tone="teal">In progress</Badge>}
        {y.past && <Badge tone="slate"><CheckCircle2 size={12} /> Done</Badge>}
        {state === "future" && <Badge tone="slate"><Lock size={11} /> Upcoming</Badge>}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {y.modules.map((m) => (
          <button key={m.id} onClick={() => toggle(m)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition
              ${openMid === m.id ? "ring-1 ring-brand-400 " : ""}
              ${m.done ? "bg-teal-500/10 text-teal-700 hover:bg-teal-500/20"
                : y.current ? "bg-white border border-brand-200 text-ink-800 hover:border-brand-400"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>
            {m.done && <CheckCircle2 size={11} />}
            {m.title}
            {m.scope !== "all" && <span className="text-[9px] uppercase opacity-60">·{m.scope.replace("cse_allied", "cse")}</span>}
          </button>
        ))}
        {y.modules.length === 0 && <span className="text-xs text-slate-400">Modules coming soon</span>}
      </div>

      {openMid && (
        <div className="mt-3 rounded-lg bg-white/70 border border-slate-100 p-3">
          {loadingRes ? (
            <p className="text-xs text-slate-400">Loading materials…</p>
          ) : !res?.topics?.length || res.topics.every((t) => !t.resources.length) ? (
            <p className="text-xs text-slate-400">No materials uploaded for this module yet.</p>
          ) : (
            <div className="space-y-3">
              {res.topics.filter((t) => t.resources.length).map((t, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">{t.topic}</p>
                  <div className="space-y-1.5">
                    {t.resources.map((r) => {
                      const Icon = RES_ICON[r.type] || Link2;
                      const body = (
                        <span className="flex items-center gap-2 text-sm">
                          <Icon size={14} className="text-brand-500 shrink-0" />
                          <span className="text-ink-800 truncate">{r.title}</span>
                        </span>
                      );
                      return r.url ? (
                        <a key={r.id} href={r.url} target="_blank" rel="noreferrer"
                          className="block rounded-md px-2 py-1.5 hover:bg-brand-500/5">{body}</a>
                      ) : <div key={r.id} className="px-2 py-1.5">{body}</div>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
