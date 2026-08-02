import { useEffect, useRef, useState } from "react";
import { FileCheck2, CheckCircle2, Timer, Trophy, RotateCcw, ShieldAlert } from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, DataSource } from "../components/ui/states.jsx";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import { attachProctoring, SIGNAL_LABEL } from "../lib/proctor.js";
import { demoAssessment, DEMO_LEARNER_ID } from "../lib/demo.js";

const VIOLATION_LIMIT = 5;

// Student LMS assessment take-flow: start attempt -> answer -> submit -> score.
// Proctored assessments enforce fullscreen + tab-switch/copy-paste rules and
// auto-submit at 5 warnings — the same anti-cheat used in LARE Hire exams.
export default function Assessments() {
  const { user } = useAuth();
  const learnerId = user?.id || DEMO_LEARNER_ID;
  const [phase, setPhase] = useState("intro"); // intro | taking | done
  const [assessment, setAssessment] = useState(demoAssessment);
  const [attemptId, setAttemptId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [live, setLive] = useState(false);
  const [violations, setViolations] = useState(0);
  const [lastSignal, setLastSignal] = useState("");
  const [list, setList] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const rows = await api.listAssessments();
        if (rows?.length) setList(rows);
      } catch { /* offline / demo */ }
    })();
  }, []);

  const vRef = useRef(0);
  const submittedRef = useRef(false);
  const submitRef = useRef(() => {});

  const proctored = !!assessment?.proctored;

  async function start(chosen) {
    const target = chosen || assessment || demoAssessment;
    let a = target;
    let att = null;
    try {
      a = await api.getAssessment(target.id);
      att = await api.startAttempt(a.id, learnerId);
      setLive(true);
    } catch {
      setLive(false);
    }
    setAssessment(a);
    setAttemptId(att?.attempt_id || `att-demo`);
    setAnswers({});
    setResult(null);
    vRef.current = 0;
    submittedRef.current = false;
    setViolations(0);
    setLastSignal("");
    setPhase("taking");
    if (a?.proctored) {
      try { await document.documentElement.requestFullscreen?.(); } catch { /* user can decline */ }
    }
  }

  async function submit(reason) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* ignore */ } }
    const payload = Object.fromEntries(
      Object.entries(answers).map(([qid, option]) => [qid, { option }])
    );
    let res;
    try {
      res = await api.submitAttempt(attemptId, payload);
    } catch {
      const correct = { i1: "b", i2: "b", i3: "b" };
      const got = assessment.items.filter((it) => answers[it.id] === correct[it.id]).length;
      const pct = Math.round((got / assessment.items.length) * 100);
      res = { percentage: pct, passed: pct >= (assessment.pass_pct || 60), score: got, max_score: assessment.items.length, demo: true };
    }
    if (reason === "proctor") res = { ...res, auto_submitted: true };
    setResult(res);
    setPhase("done");
  }
  submitRef.current = submit;

  // Proctoring: attach the anti-cheat listeners only while taking a proctored
  // assessment; each violation counts toward the 5-flag auto-submit.
  useEffect(() => {
    if (phase !== "taking" || !proctored) return;
    const detach = attachProctoring({
      onViolation: (type) => {
        if (submittedRef.current) return;
        const next = Math.min(vRef.current + 1, VIOLATION_LIMIT);
        vRef.current = next;
        setViolations(next);
        setLastSignal(SIGNAL_LABEL[type] || type);
        if (next >= VIOLATION_LIMIT) submitRef.current("proctor");
      },
    });
    return detach;
  }, [phase, proctored]);

  if (phase === "intro") {
    const cards = list.length ? list : [{
      id: demoAssessment.id, title: demoAssessment.title,
      item_count: demoAssessment.items.length, passing_pct: demoAssessment.pass_pct,
      time_limit_min: demoAssessment.duration_min, proctored: false,
    }];
    return (
      <div>
        <PageHeader title="Assessments" subtitle="Pick an assessment to build your skill scorecard" />
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((a) => (
            <Card key={a.id} className="p-6 flex flex-col">
              <div className="flex items-start justify-between">
                <span className="grid place-items-center h-11 w-11 rounded-md bg-brand-500/10 text-brand-600">
                  <FileCheck2 size={22} />
                </span>
                {a.proctored && (
                  <Badge tone="amber"><ShieldAlert size={13} /> Proctored</Badge>
                )}
              </div>
              <h2 className="mt-4 font-display font-semibold text-ink-900">{a.title}</h2>
              <p className="text-sm text-slate-500">{a.item_count} questions · pass {a.passing_pct}%</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                {a.time_limit_min > 0 && <span className="flex items-center gap-1.5"><Timer size={14} /> {a.time_limit_min} min</span>}
                <span className="flex items-center gap-1.5"><Trophy size={14} /> +XP on pass</span>
              </div>
              <Button className="mt-5" onClick={() => start(a)}>Start assessment</Button>
            </Card>
          ))}
        </div>
        {!list.length && (
          <p className="mt-4 text-sm text-slate-400">Showing a sample assessment — your trainer's published assessments will appear here.</p>
        )}
      </div>
    );
  }

  if (phase === "taking") {
    const answered = Object.keys(answers).length;
    return (
      <div>
        <PageHeader
          title={assessment.title}
          subtitle={`${answered}/${assessment.items.length} answered`}
          right={<DataSource live={live} />}
        />
        {proctored && (
          <div className={`max-w-2xl mb-4 rounded-lg p-3.5 flex items-center gap-3 text-sm ${
            violations >= 3 ? "bg-rose-500/10 text-rose-700" : "bg-amber-500/10 text-amber-700"}`}>
            <ShieldAlert size={18} className="shrink-0" />
            <div>
              <span className="font-semibold">Proctored assessment · {violations}/{VIOLATION_LIMIT} warnings.</span>{" "}
              Stay in fullscreen — switching tabs, copying, or exiting fullscreen is flagged. At {VIOLATION_LIMIT} it auto-submits.
              {lastSignal && <span className="block text-xs mt-0.5 opacity-80">Last flag: {lastSignal}</span>}
            </div>
          </div>
        )}
        <div className="space-y-4 max-w-2xl">
          {assessment.items.map((it, i) => (
            <Card key={it.id} className="p-5">
              <p className="font-medium text-ink-900 mb-3">
                <span className="text-slate-400 mr-2">{i + 1}.</span>{it.prompt || it.stem}
              </p>
              <div className="space-y-2">
                {it.options.map((o) => (
                  <label
                    key={o.id}
                    className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                      answers[it.id] === o.id ? "border-brand-400 bg-brand-500/5" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={it.id}
                      checked={answers[it.id] === o.id}
                      onChange={() => setAnswers({ ...answers, [it.id]: o.id })}
                      className="accent-brand-500"
                    />
                    <span className="text-sm text-ink-900">{o.text}</span>
                  </label>
                ))}
              </div>
            </Card>
          ))}
          <Button onClick={() => submit()} disabled={answered === 0} size="lg">
            <CheckCircle2 size={18} /> Submit assessment
          </Button>
        </div>
      </div>
    );
  }

  // done
  return (
    <div>
      <PageHeader title="Result" subtitle={assessment.title} right={<DataSource live={live} />} />
      <Card className="p-8 max-w-md text-center">
        <div className={`mx-auto grid place-items-center h-20 w-20 rounded-full mb-4 ${result.passed ? "bg-teal-500/10 text-teal-600" : "bg-rose-500/10 text-rose-600"}`}>
          {result.passed ? <Trophy size={36} /> : <RotateCcw size={36} />}
        </div>
        <p className="text-4xl font-display font-bold text-ink-900 tabular-nums">{result.percentage}%</p>
        <Badge tone={result.passed ? "teal" : "rose"} className="mt-2">
          {result.passed ? "Passed" : "Keep practising"}
        </Badge>
        <p className="text-sm text-slate-500 mt-3">
          {result.score}/{result.max_score} correct{result.pending_grading?.length ? ` · ${result.pending_grading.length} pending manual grade` : ""}
        </p>
        {result.auto_submitted && (
          <p className="text-xs text-rose-600 mt-2 flex items-center justify-center gap-1.5">
            <ShieldAlert size={13} /> Auto-submitted after reaching the warning limit.
          </p>
        )}
        <div className="flex gap-2 justify-center mt-6">
          <Button variant="secondary" onClick={() => setPhase("intro")}>Back</Button>
          <Button onClick={() => start(assessment)}><RotateCcw size={16} /> Retake</Button>
        </div>
      </Card>
    </div>
  );
}
