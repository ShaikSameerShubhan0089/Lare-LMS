import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Boxes, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Terminal, Code2,
  Table2, Trophy, Brain, Briefcase,
} from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../components/ui/states.jsx";
import ProctorBanner from "../components/ProctorBanner.jsx";
import { api } from "../lib/api.js";

// LARE Learn — Embodied Practice Worlds. Work a realistic on-the-job scenario
// step by step; competence is scored from your decisions and fed to your twin.
const DIFF = { easy: "teal", medium: "amber", hard: "rose" };

export default function PracticeWorlds() {
  const [worlds, setWorlds] = useState(null);
  const [active, setActive] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try { setWorlds(await api.listWorlds()); }
    catch { setWorlds([]); setErr("Couldn't load scenarios."); }
  }
  useEffect(() => { load(); }, []);

  if (worlds === null) return <Loading />;
  if (active) return <Player card={active} onExit={() => { setActive(null); load(); }} />;

  return (
    <div>
      <PageHeader
        title="Practice Worlds"
        subtitle="Step into the real job — an on-call incident, a data investigation, a code review. Your decisions are scored like the workplace would, and feed your skill map."
        right={<Button as={Link} to="/lms/skill-map" variant="secondary"><Brain size={16} /> Skill Map</Button>}
      />
      {err && <Card className="p-4 mb-4 text-sm text-amber-600">{err}</Card>}
      {worlds.length === 0 ? (
        <EmptyState title="No scenarios yet" hint="Your trainer hasn't published Practice Worlds. Check back soon." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {worlds.map((w) => (
            <button key={w.id} onClick={() => setActive(w)}
              className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-brand-300 hover:shadow-sm transition group">
              <div className="flex items-start justify-between gap-2">
                <span className="grid place-items-center h-10 w-10 rounded-lg bg-brand-500/10 text-brand-600"><Boxes size={20} /></span>
                <Badge tone={DIFF[w.difficulty] || "slate"}>{w.difficulty}</Badge>
              </div>
              <h3 className="mt-3 font-medium text-ink-900 group-hover:text-brand-700">{w.title}</h3>
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">{w.summary}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Briefcase size={12} /> {w.role}</span>
                <span>· {w.steps} steps</span>
                {w.skill && <span>· {w.skill}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Artifact({ artifact }) {
  if (!artifact?.content) return null;
  const { type, content } = artifact;
  const meta = {
    logs: { icon: Terminal, label: "Logs", cls: "text-emerald-200" },
    code: { icon: Code2, label: "Code", cls: "text-sky-200" },
    table: { icon: Table2, label: "Data", cls: "text-slate-100" },
  }[type] || { icon: Terminal, label: "Detail", cls: "text-slate-100" };
  const Icon = meta.icon;
  return (
    <div className="rounded-lg overflow-hidden border border-slate-800">
      <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 text-xs text-slate-300"><Icon size={13} /> {meta.label}</div>
      <pre className={`bg-slate-900 ${meta.cls} p-3.5 text-xs overflow-x-auto whitespace-pre`}>{content}</pre>
    </div>
  );
}

function Player({ card, onExit }) {
  const [run, setRun] = useState(null); // {run_id, step, total_steps, step_index}
  const [step, setStep] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [feedback, setFeedback] = useState(null); // {correct, feedback, correct_choice}
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ answered: 0, total: card.steps });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.startWorld(card.id);
        setRun(res); setStep(res.step);
        setProgress({ answered: res.step_index, total: res.total_steps });
      } catch { /* handled by empty state */ }
    })();
  }, [card.id]);

  async function answer(optId) {
    if (chosen || busy) return;
    setChosen(optId); setBusy(true);
    try {
      const res = await api.answerWorld(run.run_id, step.id, optId);
      setFeedback(res);
      setProgress(res.progress);
      // stash next/summary; reveal on "Continue" so the last feedback is seen
      setRun((r) => ({ ...r, _next: res.next_step, _summary: res.summary }));
    } catch { /* ignore */ }
    finally { setBusy(false); }
  }

  function next() {
    if (feedback?.done) { setSummary(run._summary); return; }
    setStep(run._next); setChosen(null); setFeedback(null);
  }

  if (!run && !summary) return <Loading />;

  const passed = summary && summary.passed;

  return (
    <div>
      <PageHeader
        title={card.title}
        subtitle={`${card.role} · ${card.skill}`}
        right={<Button variant="secondary" onClick={onExit}><ArrowLeft size={16} /> Exit</Button>}
      />

      {!summary && step && (
        <div className="max-w-2xl">
          <ProctorBanner active />
          <div className="flex items-center justify-between mb-2 text-sm text-slate-500">
            <span>Step {Math.min(progress.answered + 1, progress.total)} of {progress.total}</span>
            <Badge tone={DIFF[card.difficulty]}>{card.difficulty}</Badge>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden mb-5">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(progress.answered / progress.total) * 100}%` }} />
          </div>

          <Card className="p-6 space-y-4">
            <p className="text-ink-900 leading-relaxed whitespace-pre-wrap">{step.situation}</p>
            <Artifact artifact={step.artifact} />
            <p className="font-display font-semibold text-ink-900">{step.prompt}</p>
            <div className="space-y-2.5">
              {(step.options || []).map((o) => {
                const isChosen = chosen === o.id;
                const isRight = feedback && o.id === feedback.correct_choice;
                const isWrongPick = feedback && isChosen && !feedback.correct;
                return (
                  <button key={o.id} disabled={!!chosen} onClick={() => answer(o.id)}
                    className={`w-full text-left rounded-lg border p-3.5 flex items-start gap-3 transition ${
                      isRight ? "border-teal-300 bg-teal-500/10"
                      : isWrongPick ? "border-rose-300 bg-rose-500/10"
                      : isChosen ? "border-brand-300 bg-brand-500/5"
                      : "border-slate-200 hover:border-brand-300"} ${chosen ? "cursor-default" : ""}`}>
                    <span className="grid place-items-center h-6 w-6 rounded-full border border-slate-300 text-xs font-semibold text-slate-500 shrink-0 uppercase">{o.id}</span>
                    <span className="text-sm text-ink-900 flex-1">{o.text}</span>
                    {isRight && <CheckCircle2 size={18} className="text-teal-500 shrink-0" />}
                    {isWrongPick && <XCircle size={18} className="text-rose-500 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className={`rounded-lg p-3.5 text-sm ${feedback.correct ? "bg-teal-500/10 text-teal-800" : "bg-amber-500/10 text-amber-800"}`}>
                {feedback.feedback}
                <div className="mt-3 flex justify-end">
                  <Button onClick={next}>{feedback.done ? "See results" : "Continue"} <ArrowRight size={15} /></Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {summary && (
        <Card className="p-8 text-center max-w-lg mx-auto">
          <span className={`mx-auto grid place-items-center h-14 w-14 rounded-full ${passed ? "bg-teal-500/10 text-teal-600" : "bg-amber-500/10 text-amber-600"}`}>
            <Trophy size={28} />
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold text-ink-900">{summary.score}% — {passed ? "handled well" : "keep practising"}</h2>
          <p className="mt-1 text-slate-500">{summary.correct}/{summary.total} good calls as a {summary.role}.</p>
          <p className="mt-2 text-xs text-slate-400">Your {summary.skill} skill and review schedule have been updated.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={onExit}><ArrowLeft size={15} /> Back to worlds</Button>
            <Button as={Link} to="/lms/skill-map" variant="secondary"><Brain size={15} /> Skill Map</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
