import { useEffect, useState } from "react";
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
  const emptyForm = { candidate_id: "", stage: "technical", mode: "online", link: "", slot: "", interviewers: [{ name: "", email: "" }] };
  const [form, setForm] = useState(emptyForm);
  // Candidates who cleared the most recent round — those eligible to interview.
  const [eligible, setEligible] = useState([]);
  const [names, setNames] = useState({});   // candidate_id -> { name, roll, email }
  const [rounds, setRounds] = useState([]); // drive workflow rounds
  const list = rows ?? loaded.data ?? [];

  // Map an interview stage to its round in the pipeline, by matching keywords in
  // the round label/type (technical → the technical-interview round, hr → HR).
  const STAGE_KW = { technical: ["technical", "tech", "face to face", "f2f"], hr: ["hr", "human"], ppo: ["ppo", "hr"] };
  function roundForStage(stage) {
    const kws = STAGE_KW[stage] || [stage];
    const r = rounds.find((rd) => kws.some((k) => `${rd.label || ""} ${rd.type || ""}`.toLowerCase().includes(k)));
    return r?.order;
  }

  useEffect(() => {
    (async () => {
      try {
        const wf = await api.getWorkflow(id).catch(() => []);
        setRounds(wf || []);
        let orders = (wf || []).map((r) => r.order).filter((o) => o != null);
        if (!orders.length) orders = [1, 2, 3, 4, 5];   // fallback if no workflow defined
        orders = [...new Set(orders)].sort((a, b) => b - a);   // newest round first
        let cleared = [];
        let anyCandidates = [];
        for (const order of orders) {
          const resp = await api.roundScores(id, order).catch(() => null);
          const scores = resp?.scores || [];                  // { scores, round } shape
          if (!scores.length) continue;
          if (!anyCandidates.length) anyCandidates = scores;   // latest round with candidates
          const c = scores.filter((s) => s.cleared);
          if (c.length) { cleared = c; break; }               // prefer cleared/selected
        }
        // Prefer the cleared/selected shortlist; otherwise show everyone in the drive.
        setEligible(cleared.length ? cleared : anyCandidates);
      } catch { setEligible([]); }
    })();
  }, [id]);

  // Resolve candidate names/rolls for the eligible list + every scheduled
  // interview, so the list shows people instead of raw UUIDs.
  const idsKey = list.map((iv) => iv.candidate_id).join(",");
  useEffect(() => {
    const map = {};
    eligible.forEach((c) => {
      map[c.candidate_id] = { name: c.candidate_name, roll: c.candidate_roll, email: c.candidate_email };
    });
    const missing = [...new Set(list.map((iv) => iv.candidate_id).filter((cid) => cid && !map[cid]))];
    (async () => {
      if (missing.length) {
        try {
          const r = await api.resolveCandidates(missing);
          Object.entries(r || {}).forEach(([cid, info]) => {
            map[cid] = { name: info.full_name || info.name, roll: info.roll_number || info.roll, email: info.email };
          });
        } catch { /* fall back to the id */ }
      }
      setNames(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, idsKey]);

  if (loaded.loading) return <Loading />;

  function upsert(iv) {
    setRows((list.some((x) => x.id === iv.id) ? list.map((x) => (x.id === iv.id ? { ...x, ...iv } : x)) : [...list, iv]));
  }

  async function schedule(e) {
    e.preventDefault();
    const interviewers = form.interviewers.filter((iw) => iw.email.trim());
    let iv;
    try {
      iv = await api.scheduleInterview({ drive_id: id, ...form, interviewers, slot: form.slot.replace("T", " ") });
    } catch {
      iv = { id: `iv-${Date.now()}`, ...form, status: "scheduled" };
    }
    upsert({ id: iv.id, candidate_id: form.candidate_id, stage: form.stage, mode: form.mode, status: "scheduled", decision: null, avg_rating: null });
    setForm(emptyForm);
  }

  function addInterviewer() {
    setForm((f) => ({ ...f, interviewers: [...f.interviewers, { name: "", email: "" }] }));
  }
  function removeInterviewer(i) {
    setForm((f) => ({ ...f, interviewers: f.interviewers.filter((_, j) => j !== i) }));
  }
  function updateInterviewer(i, field, value) {
    setForm((f) => ({ ...f, interviewers: f.interviewers.map((iw, j) => (j === i ? { ...iw, [field]: value } : iw)) }));
  }

  // Push an interview action into the candidate's matching round marks sheet, so
  // technical/HR interview results show up (and clear) in Rounds & Marks.
  function syncRound(iv, patch) {
    const order = iv && roundForStage(iv.stage);
    if (order != null && iv.candidate_id) {
      api.setRoundScore(id, order, { candidate_id: iv.candidate_id, ...patch }).catch(() => {});
    }
  }

  async function rate(ivId, competency, score) {
    try { await api.rateInterview(ivId, { competency, score }); } catch { /* demo */ }
    upsert({ id: ivId, avg_rating: score });
    // rating (out of 5) → the round's marks sheet
    syncRound(list.find((x) => x.id === ivId), { marks: score, max_marks: 5 });
  }
  async function decide(ivId, decision) {
    try { await api.decideInterview(ivId, { decision }); } catch { /* demo */ }
    upsert({ id: ivId, decision, status: "completed" });
    // Select → mark cleared in that round; Reject → not cleared.
    syncRound(list.find((x) => x.id === ivId), { cleared: decision === "select" });
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
            {eligible.length > 0 ? (
              <select required value={form.candidate_id}
                onChange={(e) => setForm({ ...form, candidate_id: e.target.value })}
                className="w-full h-11 px-3 rounded-md border border-slate-200 bg-surface text-ink-900">
                <option value="">Select a candidate…</option>
                {eligible.map((c) => (
                  <option key={c.candidate_id} value={c.candidate_id}>
                    {c.candidate_roll ? `${c.candidate_roll} · ` : ""}{c.candidate_name || c.candidate_id}
                    {c.cleared ? "  ✓ cleared" : ""}{c.percentage != null ? `  (${Math.round(c.percentage)}%)` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <Input required value={form.candidate_id}
                onChange={(e) => setForm({ ...form, candidate_id: e.target.value })}
                placeholder="No cleared candidates yet — enter a candidate id" />
            )}
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
            <input type="datetime-local" value={form.slot}
              onChange={(e) => setForm({ ...form, slot: e.target.value })}
              className="w-full h-11 px-3 rounded-md border border-slate-200 bg-surface text-ink-900" />
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

          <div className="pt-2 border-t border-slate-100">
            <p className="text-sm font-medium text-ink-900 mb-2 flex items-center gap-1.5">
              <UserCheck size={15} className="text-brand-500" /> Assigned to (interviewers)
            </p>
            <div className="space-y-2.5">
              {form.interviewers.map((iw, i) => (
                <div key={i} className="rounded-lg border border-slate-100 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Interviewer {i + 1}</span>
                    {form.interviewers.length > 1 && (
                      <button type="button" onClick={() => removeInterviewer(i)}
                        className="text-slate-300 hover:text-rose-500"><X size={14} /></button>
                    )}
                  </div>
                  <Input value={iw.name} placeholder="Name (e.g. Ravi Kumar)"
                    onChange={(e) => updateInterviewer(i, "name", e.target.value)} />
                  <Input type="email" value={iw.email} placeholder="interviewer@company.com"
                    onChange={(e) => updateInterviewer(i, "email", e.target.value)} />
                </div>
              ))}
              <button type="button" onClick={addInterviewer}
                className="w-full h-9 rounded-lg border border-dashed border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600 text-sm font-medium flex items-center justify-center gap-1.5">
                <UserCheck size={14} /> Add another interviewer
              </button>
              {form.interviewers.some((iw) => iw.email.trim()) && (
                <p className="text-xs text-teal-600 flex items-center gap-1">
                  <Check size={12} /> All interviewers with an email will be sent the interview details.
                </p>
              )}
            </div>
          </div>

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
              <div className="min-w-0">
                <p className="font-medium text-ink-900">
                  {names[iv.candidate_id]?.name || iv.candidate_id}
                  {names[iv.candidate_id]?.roll && (
                    <span className="ml-2 text-xs font-normal text-slate-400">· {names[iv.candidate_id].roll}</span>
                  )}
                </p>
                {names[iv.candidate_id]?.email && (
                  <p className="text-xs text-slate-400 truncate">{names[iv.candidate_id].email}</p>
                )}
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
