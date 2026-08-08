import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Repeat, Brain, Code2, CheckCircle2, AlertTriangle, Clock, Sparkles,
} from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, Loading } from "../components/ui/states.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

// LARE Learn — Lifelong Reinforcement (Sustain). Surfaces skills whose retention
// is decaying and lets the learner do a quick self-check that reschedules them
// on a forgetting curve. Knowledge kept as a living state, not certified-and-lost.
export default function KeepSharp() {
  const { user } = useAuth();
  const id = user?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [flash, setFlash] = useState("");

  async function load() {
    setLoading(true);
    try { setData(await api.reviewQueue(id)); }
    catch { setData({ due: [], upcoming: [], due_count: 0 }); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (id) load(); /* eslint-disable-next-line */ }, [id]);

  async function review(skill, outcome) {
    setBusy(skill + outcome);
    try {
      const res = await api.submitReview(id, skill, outcome);
      setFlash(outcome === "good"
        ? `Nice — “${skill}” won't resurface for ~${res.next_due_in_days} day(s).`
        : `No worries — we'll bring “${skill}” back tomorrow.`);
      setData((d) => ({
        ...d,
        due: (d.due || []).filter((x) => x.skill !== skill),
        due_count: Math.max(0, (d.due_count || 1) - 1),
      }));
      setTimeout(() => setFlash(""), 3500);
    } catch {
      setFlash("Couldn't save that — try again.");
    } finally { setBusy(""); }
  }

  if (loading) return <Loading />;

  const due = data?.due || [];
  const upcoming = data?.upcoming || [];

  return (
    <div>
      <PageHeader
        title="Keep Sharp"
        subtitle="What you learn fades unless you revisit it. These are the skills slipping the most — a 20-second check keeps each one alive."
        right={<Button as={Link} to="/lms/skill-map" variant="secondary"><Brain size={16} /> My Skill Map</Button>}
      />

      {flash && (
        <div className="mb-5 rounded-md bg-teal-500/10 text-teal-700 p-3 text-sm flex items-center gap-2">
          <CheckCircle2 size={15} /> {flash}
        </div>
      )}

      {due.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-teal-500/10 text-teal-600">
            <CheckCircle2 size={28} />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-ink-900">You're all caught up</h2>
          <p className="mt-1 text-slate-500 max-w-md mx-auto">
            Nothing needs review right now. Keep practising and we'll resurface concepts just before you'd forget them.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" />
            {due.length} skill{due.length > 1 ? "s" : ""} due for review — weakest memory first.
          </p>
          {due.map((r) => (
            <ReviewRow key={r.skill} r={r} busy={busy} onReview={review} />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Coming up</h3>
          <Card className="p-5">
            <div className="space-y-2.5">
              {upcoming.map((u) => (
                <div key={u.skill} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink-900">
                    {u.source === "coding" ? <Code2 size={14} className="text-slate-400" /> : <Brain size={14} className="text-slate-400" />}
                    {u.skill}
                  </span>
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Clock size={13} /> in {Math.max(0, Math.ceil(u.days_to_due))} day{Math.ceil(u.days_to_due) === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function retColor(pct) {
  return pct >= 70 ? "bg-teal-500" : pct >= 45 ? "bg-amber-500" : "bg-rose-500";
}

function ReviewRow({ r, busy, onReview }) {
  const practiceTo = r.source === "coding" ? "/lms/practice" : "/lms/assessments";
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {r.source === "coding" ? <Code2 size={16} className="text-brand-500" /> : <Brain size={16} className="text-brand-500" />}
            <span className="font-medium text-ink-900">{r.skill}</span>
            <Badge tone={r.retention >= 70 ? "teal" : r.retention >= 45 ? "amber" : "rose"}>{r.retention}% recall</Badge>
            {r.review_count > 0 && <span className="text-xs text-slate-400">· reviewed {r.review_count}×</span>}
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden max-w-xs">
            <div className={`h-full rounded-full ${retColor(r.retention)}`} style={{ width: `${r.retention}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Can you still recall this well? Be honest — it tunes your schedule.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => onReview(r.skill, "rusty")}>
            Rusty
          </Button>
          <Button size="sm" disabled={!!busy} onClick={() => onReview(r.skill, "good")}>
            <CheckCircle2 size={14} /> Got it
          </Button>
          <Button as={Link} to={practiceTo} size="sm" variant="ghost">
            <Sparkles size={14} /> Practise
          </Button>
        </div>
      </div>
    </Card>
  );
}
