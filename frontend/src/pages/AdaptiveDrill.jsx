import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Gauge, Zap, CheckCircle2, XCircle, ArrowRight, RotateCcw, Trophy, Brain,
} from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, Loading } from "../components/ui/states.jsx";
import ProctorBanner from "../components/ProctorBanner.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

// LARE Learn — Flow layer. An adaptive drill that raises difficulty when you're
// confident and correct, and eases off when you struggle, keeping you in flow.
const LEVEL_TONE = { easy: "teal", medium: "amber", hard: "rose" };

export default function AdaptiveDrill() {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [phase, setPhase] = useState("pick"); // pick | play | done
  const [topic, setTopic] = useState("");
  const [drill, setDrill] = useState(null); // {drill_id, item, level, progress}
  const [chosen, setChosen] = useState(null);
  const [feedback, setFeedback] = useState(null); // {correct, correct_option}
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const startedAt = useRef(0);

  useEffect(() => {
    if (!user?.id) return;
    api.skillTwin(user.id)
      .then((t) => setTopics((t?.focus_areas || []).map((f) => f.name)))
      .catch(() => {});
  }, [user?.id]);

  async function start(t) {
    setBusy(true); setErr("");
    try {
      const res = await api.drillStart(t || null, 8);
      if (!res.item) { setErr(res.message || "No questions available yet."); setBusy(false); return; }
      setTopic(t || "Mixed");
      setDrill(res); setChosen(null); setFeedback(null); setSummary(null);
      setPhase("play");
      startedAt.current = Date.now();
    } catch { setErr("Couldn't start the drill."); }
    finally { setBusy(false); }
  }

  async function answer(optId) {
    if (chosen || busy) return;
    setChosen(optId);
    setBusy(true);
    const elapsed = Date.now() - startedAt.current;
    try {
      const res = await api.drillAnswer(drill.drill_id, drill.item.id, optId, elapsed);
      setFeedback({ correct: res.correct, correct_option: res.correct_option, level: res.level, explain: res.explain });
      setDrill((d) => ({ ...d, level: res.level, progress: res.progress, _next: res.next_item, _done: res.done, _summary: res.summary }));
    } catch { setErr("Couldn't record that answer."); }
    finally { setBusy(false); }
  }

  function next() {
    if (drill._done) { setSummary(drill._summary); setPhase("done"); return; }
    setDrill((d) => ({ ...d, item: d._next }));
    setChosen(null); setFeedback(null);
    startedAt.current = Date.now();
  }

  if (!user) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Adaptive Drill"
        subtitle="Questions that meet you where you are — they get harder when you're flying and gentler when you stumble, so you stay in the zone."
        right={<Button as={Link} to="/lms/skill-map" variant="secondary"><Brain size={16} /> Skill Map</Button>}
      />

      {err && <Card className="p-4 mb-4 text-sm text-amber-600">{err}</Card>}

      {phase === "pick" && (
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="grid place-items-center h-11 w-11 rounded-lg bg-brand-500/10 text-brand-600"><Gauge size={22} /></span>
            <div>
              <h2 className="font-display font-semibold text-ink-900">Pick a focus</h2>
              <p className="text-sm text-slate-500">Drill a weak topic, or take a mixed set.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <Button key={t} variant="secondary" disabled={busy} onClick={() => start(t)}>{t}</Button>
            ))}
            <Button disabled={busy} onClick={() => start(null)}>{busy ? "Starting…" : "Mixed set"} <ArrowRight size={15} /></Button>
          </div>
          {topics.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">Take an assessment first to unlock topic suggestions — or start a mixed set now.</p>
          )}
        </Card>
      )}

      {phase === "play" && drill?.item && (
        <div className="max-w-2xl">
          <ProctorBanner active />
          <div className="flex items-center justify-between mb-4">
            <Badge tone={LEVEL_TONE[drill.level] || "slate"}>
              <Gauge size={13} className="inline -mt-0.5 mr-1" /> {drill.level}
            </Badge>
            <span className="text-sm text-slate-500 tabular-nums">
              {drill.progress.answered} / {drill.progress.target}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden mb-5">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(drill.progress.answered / drill.progress.target) * 100}%` }} />
          </div>

          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{topic}</p>
            <p className="font-display text-lg font-semibold text-ink-900 mb-5">{drill.item.prompt}</p>
            <div className="space-y-2.5">
              {(drill.item.options || []).map((o) => {
                const isChosen = chosen === o.id;
                const isCorrect = feedback && o.id === feedback.correct_option;
                const isWrongPick = feedback && isChosen && !feedback.correct;
                return (
                  <button
                    key={o.id}
                    disabled={!!chosen}
                    onClick={() => answer(o.id)}
                    className={`w-full text-left rounded-lg border p-3.5 flex items-center gap-3 transition ${
                      isCorrect ? "border-teal-300 bg-teal-500/10"
                      : isWrongPick ? "border-rose-300 bg-rose-500/10"
                      : isChosen ? "border-brand-300 bg-brand-500/5"
                      : "border-slate-200 hover:border-brand-300"
                    } ${chosen ? "cursor-default" : ""}`}
                  >
                    <span className="grid place-items-center h-6 w-6 rounded-full border border-slate-300 text-xs font-semibold text-slate-500 shrink-0 uppercase">{o.id}</span>
                    <span className="text-sm text-ink-900 flex-1">{o.text}</span>
                    {isCorrect && <CheckCircle2 size={18} className="text-teal-500" />}
                    {isWrongPick && <XCircle size={18} className="text-rose-500" />}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className="mt-5">
                {feedback.explain && <p className="text-sm text-slate-500 mb-3">{feedback.explain}</p>}
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium flex items-center gap-1.5 ${feedback.correct ? "text-teal-600" : "text-rose-600"}`}>
                    {feedback.correct ? <><Zap size={15} /> Nice — leveling up</> : <>Not quite — easing off</>}
                  </span>
                  <Button onClick={next}>{drill._done ? "See results" : "Next"} <ArrowRight size={15} /></Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {phase === "done" && summary && (
        <Card className="p-8 text-center max-w-lg mx-auto">
          <span className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-brand-500/10 text-brand-600"><Trophy size={28} /></span>
          <h2 className="mt-4 font-display text-2xl font-bold text-ink-900">{summary.accuracy}% accuracy</h2>
          <p className="mt-1 text-slate-500">
            {summary.correct}/{summary.answered} correct · reached <b className="capitalize">{summary.final_level}</b> level
            {summary.topic ? ` on ${summary.topic}` : ""}.
          </p>
          <p className="mt-2 text-xs text-slate-400">Your skill map and review schedule have been updated.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => setPhase("pick")}><RotateCcw size={15} /> Drill again</Button>
            <Button as={Link} to="/lms/keep-sharp" variant="secondary">Keep Sharp</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
