import { useState } from "react";
import { FileCheck2, CheckCircle2, Timer, Trophy, RotateCcw } from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, DataSource } from "../components/ui/states.jsx";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import { demoAssessment, DEMO_LEARNER_ID } from "../lib/demo.js";

// Student LMS assessment take-flow: start attempt -> answer -> submit -> score.
export default function Assessments() {
  const { user } = useAuth();
  const learnerId = user?.id || DEMO_LEARNER_ID;
  const [phase, setPhase] = useState("intro"); // intro | taking | done
  const [assessment, setAssessment] = useState(demoAssessment);
  const [attemptId, setAttemptId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [live, setLive] = useState(false);

  async function start() {
    let a = demoAssessment;
    let att = null;
    try {
      a = await api.getAssessment(demoAssessment.id);
      att = await api.startAttempt(a.id, learnerId);
      setLive(true);
    } catch {
      setLive(false);
    }
    setAssessment(a);
    setAttemptId(att?.attempt_id || `att-demo`);
    setAnswers({});
    setResult(null);
    setPhase("taking");
  }

  async function submit() {
    const payload = Object.fromEntries(
      Object.entries(answers).map(([qid, option]) => [qid, { option }])
    );
    let res;
    try {
      res = await api.submitAttempt(attemptId, payload);
    } catch {
      // demo grading: award for chosen "b" on the seeded questions
      const correct = { i1: "b", i2: "b", i3: "b" };
      const got = assessment.items.filter((it) => answers[it.id] === correct[it.id]).length;
      const pct = Math.round((got / assessment.items.length) * 100);
      res = { percentage: pct, passed: pct >= (assessment.pass_pct || 60), score: got, max_score: assessment.items.length, demo: true };
    }
    setResult(res);
    setPhase("done");
  }

  if (phase === "intro") {
    return (
      <div>
        <PageHeader title="Assessments" subtitle="Weekly quizzes build your skill scorecard" />
        <Card className="p-6 max-w-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="grid place-items-center h-11 w-11 rounded-md bg-brand-500/10 text-brand-600">
              <FileCheck2 size={22} />
            </span>
            <div>
              <h2 className="font-display font-semibold text-ink-900">{assessment.title}</h2>
              <p className="text-sm text-slate-500">{assessment.items.length} questions · pass {assessment.pass_pct}%</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 mb-5">
            <span className="flex items-center gap-1.5"><Timer size={15} /> {assessment.duration_min} min</span>
            <span className="flex items-center gap-1.5"><Trophy size={15} /> +XP on pass</span>
          </div>
          <Button onClick={start}>Start assessment</Button>
        </Card>
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
        <div className="space-y-4 max-w-2xl">
          {assessment.items.map((it, i) => (
            <Card key={it.id} className="p-5">
              <p className="font-medium text-ink-900 mb-3">
                <span className="text-slate-400 mr-2">{i + 1}.</span>{it.stem}
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
          <Button onClick={submit} disabled={answered === 0} size="lg">
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
        <div className="flex gap-2 justify-center mt-6">
          <Button variant="secondary" onClick={() => setPhase("intro")}>Back</Button>
          <Button onClick={start}><RotateCcw size={16} /> Retake</Button>
        </div>
      </Card>
    </div>
  );
}
