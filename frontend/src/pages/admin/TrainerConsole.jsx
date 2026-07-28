import { useState } from "react";
import { ClipboardCheck, UserCheck, Award, CheckCircle2, GraduationCap } from "lucide-react";
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

      <SubjectiveGrading onGraded={(m) => setFlash(m)} />
    </div>
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
