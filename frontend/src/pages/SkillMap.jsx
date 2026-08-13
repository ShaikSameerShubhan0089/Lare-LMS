import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Target, TrendingUp, Sparkles, AlertCircle, CalendarDays, Lightbulb, WandSparkles, Code2, Repeat } from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { RadialGauge, RadarChart } from "../components/drive/charts.jsx";
import { PageHeader, Loading } from "../components/ui/states.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

// Cognitive Twin v0.1 — a learner's skill map, computed from their exam history.
// A student sees their own; a recruiter/admin can pass a candidateId to view any.
export default function SkillMap({ candidateId }) {
  const { user } = useAuth();
  const id = candidateId || user?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [dueReviews, setDueReviews] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try { setData(await api.skillTwin(id)); }
      catch { setErr("Could not load your skill map yet."); }
      finally { setLoading(false); }
    })();
    api.reviewQueue(id).then((r) => setDueReviews(r?.due_count || 0)).catch(() => {});
  }, [id]);

  if (loading) return <Loading />;

  const o = data?.overall || { attempted: 0, correct: 0, mastery: 0 };
  const cats = data?.by_category || [];
  const topics = data?.topics || [];
  const strengths = data?.strengths || [];
  const focus = data?.focus_areas || [];
  const languages = data?.languages || [];
  const codingSolved = data?.coding_solved || 0;
  const codingAttempted = data?.coding_attempted || 0;
  const codingVerified = data?.coding_verified || 0;
  const noData = !data || o.attempted === 0;

  return (
    <div>
      <PageHeader
        title="My Skill Map"
        subtitle="Your evolving profile — built from every test you take and every problem you solve."
        right={
          <Button as={Link} to="/lms/practice" variant="secondary">
            <Code2 size={16} /> Coding Practice
          </Button>
        }
      />

      {noData ? (
        <Card className="p-10 text-center">
          <span className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-brand-500/10 text-brand-600">
            <Brain size={28} />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-ink-900">Your skill map is waking up</h2>
          <p className="mt-1 text-slate-500 max-w-md mx-auto">
            Take a written test or solve a coding problem and your strengths and focus areas will appear here automatically.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button as={Link} to="/lms/practice"><Code2 size={16} /> Start coding practice</Button>
            <Button as={Link} to="/lms/assessments" variant="secondary">Take an assessment</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Mastery hero */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-500/[0.05] via-surface to-teal-500/[0.04] p-6 flex flex-col sm:flex-row items-center gap-6">
            <RadialGauge value={o.mastery} label="Mastery" color="#2563EB" size={132} />
            <div className="text-center sm:text-left">
              <h2 className="font-display text-xl font-bold text-ink-900">Your skill map</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md">Overall competence across {topics.length} mapped topics — {o.correct} of {o.attempted} questions correct across {data.exams_taken} tests.</p>
            </div>
          </div>
          {/* Overall */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat icon={Brain} tone="brand" label="Overall mastery" value={`${o.mastery}%`} />
            <Stat icon={Target} tone="teal" label="Questions correct" value={`${o.correct} / ${o.attempted}`} />
            <Stat icon={TrendingUp} tone="amber" label="Tests taken" value={data.exams_taken} />
            <Stat icon={Sparkles} tone="brand" label="Topics mapped" value={topics.length} />
          </div>

          {/* Reviews due — Lifelong Reinforcement */}
          {dueReviews > 0 && (
            <Link to="/lms/keep-sharp" className="block">
              <Card className="p-4 flex items-center gap-3 border-amber-200 bg-amber-500/5 hover:bg-amber-500/10 transition">
                <span className="grid place-items-center h-10 w-10 rounded-lg bg-amber-500/15 text-amber-600 shrink-0">
                  <Repeat size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{dueReviews} skill{dueReviews > 1 ? "s are" : " is"} fading</p>
                  <p className="text-sm text-slate-500">A quick review keeps them sharp — open Keep Sharp.</p>
                </div>
                <span className="text-amber-600 text-sm font-medium shrink-0">Review →</span>
              </Card>
            </Link>
          )}

          {/* AI Coach */}
          <Coach learnerId={id} />

          {/* Strengths + focus */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-teal-500" /> Your strengths
              </h3>
              {strengths.length ? (
                <div className="flex flex-wrap gap-2">
                  {strengths.map((t) => (
                    <span key={t.name} className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 text-teal-700 px-3 py-1.5 text-sm font-medium">
                      {t.name} <span className="tabular-nums text-teal-600/70">{t.mastery}%</span>
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">Keep practising — strengths appear as you master topics.</p>}
            </Card>
            <Card className="p-6">
              <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2 mb-3">
                <AlertCircle size={18} className="text-amber-500" /> Focus next on
              </h3>
              {focus.length ? (
                <div className="flex flex-wrap gap-2">
                  {focus.map((t) => (
                    <span key={t.name} className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 px-3 py-1.5 text-sm font-medium">
                      {t.name} <span className="tabular-nums text-amber-600/70">{t.mastery}%</span>
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">Nothing weak right now — great work!</p>}
            </Card>
          </div>

          {/* Skill profile — radar across every topic */}
          {topics.length > 0 && (
            <Card className="p-6">
              <h3 className="font-display font-semibold text-ink-900 mb-1">Your skill profile</h3>
              <p className="text-xs text-slate-400 mb-2">Mastery across every mapped topic — the bigger the shape, the more well-rounded.</p>
              {topics.length >= 3 ? (
                <RadarChart data={topics.map((t) => ({ label: t.name, value: t.mastery }))} color="#2563EB" />
              ) : (
                <div className="flex flex-wrap gap-x-8 gap-y-4 justify-center py-2">
                  {topics.map((t) => <GaugeCell key={t.name} name={t.name} pct={t.mastery} sub={`${t.correct}/${t.attempted}`} />)}
                </div>
              )}
            </Card>
          )}

          {/* Every topic — as gauge rings */}
          {topics.length > 0 && (
            <Card className="p-6">
              <h3 className="font-display font-semibold text-ink-900 mb-1">Every topic</h3>
              <p className="text-xs text-slate-400 mb-5">Ranked strongest first — each ring is your mastery of that topic.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7 justify-items-center">
                {topics.map((t) => (
                  <GaugeCell key={t.name} name={t.name} pct={t.mastery} sub={`${t.correct}/${t.attempted}`} size={104} />
                ))}
              </div>
            </Card>
          )}

          {/* By category */}
          {cats.length > 0 && (
            <Card className="p-6">
              <h3 className="font-display font-semibold text-ink-900 mb-4">Mastery by area</h3>
              <div className="flex flex-wrap gap-x-8 gap-y-5 justify-center sm:justify-start">
                {cats.map((c) => (
                  <GaugeCell key={c.name} name={c.name} pct={c.mastery} sub={`${c.correct}/${c.attempted}`} size={118} />
                ))}
              </div>
            </Card>
          )}

          {/* Coding languages */}
          {languages.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
                  <Code2 size={18} className="text-brand-500" /> Coding by language
                </h3>
                <div className="flex items-center gap-2">
                  <Badge tone="brand">{codingSolved}/{codingAttempted} solved</Badge>
                  {codingVerified > 0 && <Badge tone="teal">{codingVerified} verified ✓</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-5 justify-center sm:justify-start">
                {languages.map((l) => (
                  <GaugeCell key={l.name} name={l.name} pct={l.mastery} sub={`${l.solved}/${l.attempted}`} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Coach({ learnerId }) {
  const [plan, setPlan] = useState(null);
  const [doneDays, setDoneDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [nudged, setNudged] = useState("");

  // Auto-load the persistent plan on mount (cheap — reuses the stored plan).
  useEffect(() => {
    if (!learnerId) return;
    (async () => {
      try {
        const res = await api.skillCoach(learnerId);
        if (res?.plan) { setPlan(res.plan); setDoneDays(res.completed_days || []); }
      } catch { /* first-time users have no plan yet — that's fine */ }
      finally { setLoaded(true); }
    })();
  }, [learnerId]);

  async function generate(force = false) {
    setLoading(true); setErr("");
    try {
      const res = await api.skillCoach(learnerId, force);
      if (res?.plan) { setPlan(res.plan); setDoneDays(res.completed_days || []); }
      else setErr(res?.message || "Take an assessment or solve a problem first to get a plan.");
    } catch {
      setErr("Couldn't generate your plan right now — try again in a moment.");
    } finally { setLoading(false); }
  }

  async function toggleDay(day) {
    const done = !doneDays.includes(day);
    setDoneDays((d) => done ? [...d, day] : d.filter((x) => x !== day));
    try { await api.coachProgress(learnerId, day, done); }
    catch { /* optimistic — revert on failure */ setDoneDays((d) => done ? d.filter((x) => x !== day) : [...d, day]); }
  }

  async function nudge() {
    setNudged("sending");
    try {
      const res = await api.nudgePlan(learnerId);
      setNudged(res?.sent ? (res.emailed ? "Sent to your inbox + notifications ✓" : "Added to your notifications ✓") : "Take an assessment first.");
    } catch {
      setNudged("Couldn't send right now — try again.");
    }
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-brand-500/5 to-transparent border-brand-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
          <WandSparkles size={18} className="text-brand-500" /> Your AI study coach
        </h3>
        {loaded && !plan && (
          <Button onClick={() => generate()} disabled={loading}>
            <Sparkles size={16} /> {loading ? "Thinking…" : "Get my plan"}
          </Button>
        )}
        {plan && (
          <Badge tone={plan.generated ? "brand" : "slate"}>{plan.generated ? "AI-generated" : "Smart plan"}</Badge>
        )}
      </div>

      {err && <p className="mt-3 text-sm text-amber-600">{err}</p>}
      {!loaded && <p className="mt-2 text-sm text-slate-400">Loading your plan…</p>}
      {loaded && !plan && !err && !loading && (
        <p className="mt-2 text-sm text-slate-500">
          Get a personalised, week-long plan focused on exactly where you'll improve the most. It's saved, so it's here every time you come back.
        </p>
      )}

      {plan && (
        <div className="mt-4 space-y-5">
          <p className="font-display text-lg font-semibold text-ink-900">{plan.headline}</p>

          {plan.explainer && (
            <div className="rounded-lg border border-brand-200 bg-brand-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1.5 flex items-center gap-1.5">
                <Brain size={13} /> 2-minute explainer — your #1 gap
              </p>
              <p className="text-sm text-ink-900 leading-relaxed">{plan.explainer}</p>
            </div>
          )}

          {plan.quick_win && (
            <div className="rounded-lg bg-amber-500/10 text-amber-800 p-3.5 flex items-start gap-2.5 text-sm">
              <Lightbulb size={17} className="shrink-0 mt-0.5 text-amber-500" />
              <span><b>Quick win:</b> {plan.quick_win}</span>
            </div>
          )}

          {Array.isArray(plan.focus) && plan.focus.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Why these topics</p>
              <div className="space-y-2">
                {plan.focus.map((f, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-semibold text-ink-900">{f.topic}</span>
                    <span className="text-slate-500"> — {f.why}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(plan.plan) && plan.plan.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                  <CalendarDays size={13} /> Your week — tick off each day
                </p>
                <span className="text-xs font-semibold text-teal-600 tabular-nums">
                  {doneDays.length}/{plan.plan.length} done
                </span>
              </div>
              <div className="space-y-2">
                {plan.plan.map((d, i) => {
                  const done = doneDays.includes(d.day);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleDay(d.day)}
                      className={`w-full text-left flex gap-3 items-start rounded-md border p-3 transition ${
                        done ? "border-teal-200 bg-teal-500/5" : "border-slate-100 hover:border-brand-200"
                      }`}
                    >
                      <span className={`shrink-0 grid place-items-center h-5 w-5 rounded mt-0.5 border ${
                        done ? "bg-teal-500 border-teal-500 text-white" : "border-slate-300 text-transparent"
                      }`}>✓</span>
                      <span className="shrink-0 text-xs font-semibold text-brand-600 bg-brand-500/10 rounded px-2 py-1">{d.day}</span>
                      <span className={`text-sm ${done ? "text-slate-400 line-through" : "text-ink-900"}`}>{d.activity}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {Array.isArray(plan.practice) && plan.practice.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                <Target size={13} /> Practice problems
              </p>
              <div className="space-y-2">
                {plan.practice.map((p, i) => (
                  <div key={i} className="flex gap-3 items-start rounded-md bg-slate-50 p-3">
                    <span className="shrink-0 grid place-items-center h-6 w-6 rounded-full bg-teal-500/15 text-teal-700 text-xs font-bold mt-0.5">{i + 1}</span>
                    <span className="text-sm text-ink-900">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => generate(true)} disabled={loading}>
              <Sparkles size={15} /> {loading ? "Refreshing…" : "Refresh plan"}
            </Button>
            <Button variant="secondary" onClick={nudge} disabled={nudged === "sending"}>
              <Sparkles size={15} /> {nudged === "sending" ? "Sending…" : "Email me my plan"}
            </Button>
            {nudged && nudged !== "sending" && <span className="text-sm text-teal-600">{nudged}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function GaugeCell({ name, pct, sub, size = 108 }) {
  const color = pct >= 80 ? "#0D9488" : pct >= 50 ? "#D97706" : "#E11D48";
  return (
    <div className="text-center">
      <RadialGauge value={pct} color={color} size={size} />
      <p className="mt-1.5 text-sm font-medium text-ink-900 capitalize">{name}</p>
      {sub && <p className="text-[11px] text-slate-400 tabular-nums">{sub}</p>}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  const tones = {
    brand: "text-brand-600 bg-brand-500/10",
    teal: "text-teal-600 bg-teal-500/10",
    amber: "text-amber-600 bg-amber-500/10",
  };
  return (
    <Card className="p-5">
      <span className={`grid place-items-center h-10 w-10 rounded-lg ${tones[tone]}`}><Icon size={20} /></span>
      <p className="mt-3 text-sm text-slate-500">{label}</p>
      <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
    </Card>
  );
}

