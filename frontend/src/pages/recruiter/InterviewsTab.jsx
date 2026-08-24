import { useState } from "react";
import { CalendarPlus, Video, Star, Check, X, UserCheck } from "lucide-react";
import { Card, Badge, Button, Field, Input } from "../../components/ui/primitives.jsx";
import { Loading, DataSource } from "../../components/ui/states.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { api, withFallback } from "../../lib/api.js";
import { demoInterviews } from "../../lib/demo.js";

const DEC_TONE = { select: "teal", reject: "rose", hold: "amber", next_round: "brand" };

export default function InterviewsTab({ id }) {
  const loaded = useAsync(() => withFallback(api.driveInterviews(id), demoInterviews), [id]);
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ candidate_id: "", stage: "technical", mode: "online", link: "", slot: "" });
  const list = rows ?? loaded.data ?? [];

  if (loaded.loading) return <Loading />;

  function upsert(iv) {
    setRows((list.some((x) => x.id === iv.id) ? list.map((x) => (x.id === iv.id ? { ...x, ...iv } : x)) : [...list, iv]));
  }

  async function schedule(e) {
    e.preventDefault();
    let iv;
    try {
      iv = await api.scheduleInterview({ drive_id: id, ...form });
    } catch {
      iv = { id: `iv-${Date.now()}`, ...form, status: "scheduled" };
    }
    upsert({ id: iv.id, candidate_id: form.candidate_id, stage: form.stage, mode: form.mode, status: "scheduled", decision: null, avg_rating: null });
    setForm({ candidate_id: "", stage: "technical", mode: "online", link: "", slot: "" });
  }

  async function rate(ivId, competency, score) {
    try { await api.rateInterview(ivId, { competency, score }); } catch { /* demo */ }
    upsert({ id: ivId, avg_rating: score });
  }
  async function decide(ivId, decision) {
    try { await api.decideInterview(ivId, { decision }); } catch { /* demo */ }
    upsert({ id: ivId, decision, status: "completed" });
  }

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-6">
      {/* Schedule form */}
      <Card className="p-6 h-fit">
        <h2 className="font-display font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <CalendarPlus size={18} className="text-brand-500" /> Schedule interview
        </h2>
        <form onSubmit={schedule} className="space-y-3">
          <Field label="Candidate">
            <Input required value={form.candidate_id} onChange={(e) => setForm({ ...form, candidate_id: e.target.value })} placeholder="20CSE022 · Sita M." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Stage</label>
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className="w-full h-11 px-3 rounded-md border border-slate-200 bg-surface text-ink-900">
                {["technical", "hr", "ppo"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Mode</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
                className="w-full h-11 px-3 rounded-md border border-slate-200 bg-surface text-ink-900">
                {["online", "in_person"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <Field label="Date & time">
            <Input value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} placeholder="2027-01-10 10:00" />
          </Field>
          <Field label="Meeting link">
            <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://meet.google.com/… or Zoom link" />
          </Field>
          {form.link.trim() && (
            <p className="-mt-2 text-xs text-teal-600 flex items-center gap-1">
              <Check size={12} /> This link will be emailed to the candidate on Schedule.
            </p>
          )}
          <Button type="submit" className="w-full"><CalendarPlus size={16} /> Schedule</Button>
        </form>
      </Card>

      {/* Interview list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-ink-900">Interviews</h2>
          <DataSource live={loaded.live} />
        </div>
        {list.length === 0 && <Card className="p-6"><p className="text-sm text-slate-400">No interviews scheduled.</p></Card>}
        {list.map((iv) => (
          <Card key={iv.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-ink-900">{iv.candidate_id}</p>
                <p className="text-sm text-slate-500 capitalize flex items-center gap-2 mt-0.5">
                  {iv.mode === "online" && <Video size={14} />} {iv.stage} · {iv.mode.replace("_", " ")}
                </p>
              </div>
              {iv.decision ? (
                <Badge tone={DEC_TONE[iv.decision] || "slate"}>{iv.decision.replace("_", " ")}</Badge>
              ) : (
                <Badge tone="slate">{iv.status}</Badge>
              )}
            </div>

            {iv.avg_rating != null && (
              <p className="mt-3 text-sm text-slate-600 flex items-center gap-1.5">
                <Star size={15} className="text-amber-500" /> Avg rating {iv.avg_rating}/5
              </p>
            )}

            {!iv.decision && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <span className="text-xs text-slate-400 mr-1">Rate:</span>
                {[3, 4, 5].map((s) => (
                  <button key={s} onClick={() => rate(iv.id, "technical", s)}
                    className="grid place-items-center h-8 w-8 rounded-md bg-slate-100 hover:bg-amber-500/15 text-slate-600 text-sm font-semibold">
                    {s}
                  </button>
                ))}
                <div className="flex-1" />
                <Button size="sm" variant="secondary" onClick={() => decide(iv.id, "reject")}>
                  <X size={14} /> Reject
                </Button>
                <Button size="sm" onClick={() => decide(iv.id, "select")}>
                  <Check size={14} /> Select
                </Button>
              </div>
            )}
            {iv.decision === "select" && (
              <p className="mt-3 text-sm text-teal-600 flex items-center gap-1.5">
                <UserCheck size={15} /> Recommended for offer
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
