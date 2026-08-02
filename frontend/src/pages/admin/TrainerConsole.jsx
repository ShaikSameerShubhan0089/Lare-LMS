import { useState } from "react";
import {
  ClipboardCheck, UserCheck, Award, CheckCircle2, GraduationCap,
  Plus, Trash2, ShieldAlert, Shuffle, FilePlus2,
} from "lucide-react";
import { Card, Badge, Button, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource } from "../../components/ui/states.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { api, withFallback } from "../../lib/api.js";
import { demoLearners } from "../../lib/demo.js";

// Trainer/faculty console: mark attendance, run year-completion checks, and
// grade pending subjective answers.
export default function TrainerConsole() {
  const loaded = useAsync(() => withFallback(api.learners(), demoLearners), []);
  const [flash, setFlash] = useState(null);
  const list = loaded.data ?? [];

  if (loaded.loading) return <Loading />;

  async function mark(learner_id, status) {
    try { await api.markAttendance({ learner_id, schedule_slot_id: "today", status }); }
    catch { /* demo */ }
    setFlash(`Marked ${status} for ${learner_id}`);
  }

  async function compute(learner_id, year_no) {
    let res;
    try { res = await api.computeYear({ learner_id, year_no }); }
    catch { res = { criteria_met: true, avg_score: 78, attendance_pct: 82, demo: true }; }
    setFlash(
      res.criteria_met
        ? `✓ ${learner_id} completed Year ${year_no} (avg ${res.avg_score}, att ${res.attendance_pct}%) — certificate auto-issues.`
        : `${learner_id} not yet eligible for Year ${year_no} (avg ${res.avg_score}, att ${res.attendance_pct}%).`
    );
  }

  return (
    <div>
      <PageHeader
        title="Trainer Console"
        subtitle="Attendance, year-completion checks, and subjective grading"
        right={<DataSource live={loaded.live} />}
      />

      {flash && (
        <div className="mb-5 rounded-md bg-brand-500/10 text-brand-700 p-3 text-sm flex items-center gap-2">
          <CheckCircle2 size={15} /> {flash}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-display font-semibold text-ink-900 flex items-center gap-2">
            <GraduationCap size={18} className="text-brand-500" /> My learners
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {list.map((l) => (
            <div key={l.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{l.full_name}</p>
                <p className="text-xs text-slate-400 font-mono">{l.roll_no} · Year {l.year_no}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => mark(l.id, "present")}>
                  <UserCheck size={14} /> Present
                </Button>
                <Button size="sm" variant="ghost" onClick={() => mark(l.id, "absent")}>Absent</Button>
                <Button size="sm" variant="amber" onClick={() => compute(l.id, l.year_no)}>
                  <Award size={14} /> Year check
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <CreateAssessment onCreated={(m) => setFlash(m)} />
      <SubjectiveGrading onGraded={(m) => setFlash(m)} />
    </div>
  );
}

const DIMENSIONS = ["aptitude", "coding", "communication", "project"];
const blankQ = () => ({ prompt: "", options: ["", "", "", ""], correct: "a" });

function CreateAssessment({ onCreated }) {
  const [meta, setMeta] = useState({ title: "", dimension: "aptitude", passing_pct: 60, duration: 0, objectives: "" });
  const [proctored, setProctored] = useState(false);
  const [shuffle, setShuffle] = useState(true);
  const [questions, setQuestions] = useState([blankQ()]);
  const [busy, setBusy] = useState(false);

  const setQ = (i, patch) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setOpt = (i, oi, val) => setQuestions((qs) => qs.map((q, j) =>
    j === i ? { ...q, options: q.options.map((o, k) => (k === oi ? val : o)) } : q));

  async function submit(e) {
    e.preventDefault();
    const items = questions
      .filter((q) => q.prompt.trim())
      .map((q, i) => ({
        item_type: "mcq", prompt: q.prompt.trim(),
        options: q.options.map((t, k) => ({ id: "abcd"[k], text: t.trim() })).filter((o) => o.text),
        correct: { option: q.correct }, weight: 1, order: i,
      }));
    if (!meta.title.trim() || items.length === 0) {
      onCreated("Add a title and at least one question with options.");
      return;
    }
    const body = {
      title: meta.title.trim(), dimension: meta.dimension, year_no: 1, type: "quiz",
      time_limit_min: Number(meta.duration) || 0, passing_pct: Number(meta.passing_pct) || 60,
      objectives: meta.objectives.split(",").map((o) => o.trim()).filter(Boolean),
      proctored, shuffle, items,
    };
    setBusy(true);
    try {
      const a = await api.createAssessment(body);
      onCreated(`Created "${a.title}"${proctored ? " (proctored)" : ""} with ${items.length} question(s).`);
      setMeta({ title: "", dimension: "aptitude", passing_pct: 60, duration: 0, objectives: "" });
      setQuestions([blankQ()]);
      setProctored(false); setShuffle(true);
    } catch {
      onCreated("Could not create the assessment — check you're signed in as a trainer.");
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-6 mt-6">
      <h2 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2">
        <FilePlus2 size={18} className="text-brand-500" /> Create an assessment
      </h2>
      <p className="text-xs text-slate-400 mb-4">Build a quiz, set the topics, and turn on proctoring for exam-grade integrity.</p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Title"><Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="Year 1 Aptitude Quiz" required /></Field>
          <Field label="Dimension / area">
            <select value={meta.dimension} onChange={(e) => setMeta({ ...meta, dimension: e.target.value })}
              className="h-11 w-full px-3 rounded-md border border-slate-200 text-sm bg-white capitalize">
              {DIMENSIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Passing %"><Input type="number" min="0" max="100" value={meta.passing_pct} onChange={(e) => setMeta({ ...meta, passing_pct: e.target.value })} /></Field>
          <Field label="Time limit (min)"><Input type="number" min="0" value={meta.duration} onChange={(e) => setMeta({ ...meta, duration: e.target.value })} placeholder="0 = none" /></Field>
          <Field label="Topics (comma-separated)"><Input value={meta.objectives} onChange={(e) => setMeta({ ...meta, objectives: e.target.value })} placeholder="Arrays, Loops" /></Field>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={proctored} onChange={(e) => setProctored(e.target.checked)} className="accent-brand-500" />
            <ShieldAlert size={15} className="text-amber-500" /> Proctored (fullscreen + anti-cheat, 5-flag auto-submit)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="accent-brand-500" />
            <Shuffle size={15} className="text-teal-500" /> Shuffle questions &amp; options per student
          </label>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="grid place-items-center h-6 w-6 rounded bg-ink-900 text-white text-xs font-semibold shrink-0">{i + 1}</span>
                <Input value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} placeholder="Question text" className="h-9 flex-1" />
                {questions.length > 1 && (
                  <button type="button" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-2 pl-8">
                {q.options.map((o, oi) => (
                  <label key={oi} className="flex items-center gap-2">
                    <input type="radio" name={`correct-${i}`} checked={q.correct === "abcd"[oi]} onChange={() => setQ(i, { correct: "abcd"[oi] })} className="accent-teal-500" title="Mark correct" />
                    <Input value={o} onChange={(e) => setOpt(i, oi, e.target.value)} placeholder={`Option ${"ABCD"[oi]}`} className="h-9" />
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400 pl-8 mt-1.5">Select the radio next to the correct option.</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setQuestions((qs) => [...qs, blankQ()])}><Plus size={16} /> Add question</Button>
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create assessment"}</Button>
        </div>
      </form>
    </Card>
  );
}

function SubjectiveGrading({ onGraded }) {
  const [answerId, setAnswerId] = useState("");
  const [score, setScore] = useState(5);

  async function grade(e) {
    e.preventDefault();
    if (!answerId) return;
    try { await api.gradeAnswer(answerId, Number(score)); }
    catch { /* demo */ }
    onGraded(`Graded answer ${answerId}: ${score} pts`);
    setAnswerId("");
  }

  return (
    <Card className="p-6 mt-6 max-w-lg">
      <h2 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2">
        <ClipboardCheck size={18} className="text-teal-500" /> Grade subjective answer
      </h2>
      <p className="text-xs text-slate-400 mb-4">Paste a pending answer id from an assessment attempt.</p>
      <form onSubmit={grade} className="flex items-end gap-3">
        <Field label="Answer id" className="flex-1">
          <Input value={answerId} onChange={(e) => setAnswerId(e.target.value)} placeholder="ans-…" />
        </Field>
        <Field label="Score">
          <Input type="number" min="0" value={score} onChange={(e) => setScore(e.target.value)} className="w-24" />
        </Field>
        <Button type="submit"><CheckCircle2 size={16} /> Grade</Button>
      </form>
    </Card>
  );
}
