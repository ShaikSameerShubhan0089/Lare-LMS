import { useEffect, useState } from "react";
import { Trophy, Plus, Trash2, CheckCircle2, Rocket, Users, Download, Search, BadgeCheck, X } from "lucide-react";
import { Card, Badge, Button, Input } from "../../components/ui/primitives.jsx";
import { api } from "../../lib/api.js";

// Round-by-round marks sheet. Round 1 (written) is auto-seeded from applicants and
// admin-editable; later rounds (JAM/GD/Interview) are scored by the panel. Cleared
// candidates advance on publish; admins can add referred candidates or remove any.
export default function RoundsTab({ id }) {
  const [rounds, setRounds] = useState([]);
  const [order, setOrder] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addId, setAddId] = useState("");
  const [flash, setFlash] = useState(null);
  const [dl, setDl] = useState("");
  const [sq, setSq] = useState("");
  const [filterC, setFilterC] = useState("all");
  const [skillsFor, setSkillsFor] = useState(null);

  async function download(cleared) {
    setDl(cleared ? "cleared" : "all");
    try { await api.downloadRoundXlsx(id, order, cleared); }
    catch (e) { setFlash(e?.message || "Export failed."); }
    finally { setDl(""); }
  }

  async function deleteRound() {
    const label = data?.round?.label || `Round ${order}`;
    if (!window.confirm(
      `Delete "${label}"?\n\nLater rounds move up one step and any candidates in this round advance straight to the next round. This can't be undone.`
    )) return;
    const wasOrder = order;
    try { await api.deleteRound(id, order); }
    catch (e) { setFlash(e?.message || "Could not delete the round."); return; }
    const wf = await api.getWorkflow(id).catch(() => []);
    setRounds(wf || []);
    setFlash(`Deleted "${label}" — pipeline updated.`);
    setOrder(1);
    if (wasOrder === 1) load();
  }

  useEffect(() => {
    (async () => {
      const wf = await api.getWorkflow(id).catch(() => []);
      setRounds(wf || []);
    })();
  }, [id]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, order]);

  async function load() {
    setLoading(true);
    const d = await api.roundScores(id, order).catch(() => ({ scores: [], round: { label: `Round ${order}` } }));
    setData(d);
    setLoading(false);
  }

  function patchLocal(cid, patch) {
    setData((d) => ({ ...d, scores: d.scores.map((s) => (s.candidate_id === cid ? { ...s, ...patch } : s)) }));
  }

  async function save(cid, body) {
    try { await api.setRoundScore(id, order, { candidate_id: cid, ...body }); }
    catch { /* keep optimistic */ }
  }

  async function add() {
    const cid = addId.trim();
    if (!cid) return;
    try { await api.addRoundCandidate(id, order, cid); } catch { /* demo */ }
    setAddId("");
    setFlash(`Added ${cid}`);
    load();
  }

  async function remove(cid) {
    try { await api.removeRoundCandidate(id, order, cid); } catch { /* demo */ }
    patchLocalRemove(cid);
  }
  function patchLocalRemove(cid) {
    setData((d) => ({ ...d, scores: d.scores.filter((s) => s.candidate_id !== cid) }));
  }

  async function publish() {
    const cleared = (data?.scores || []).filter((s) => s.cleared).length;
    if (!window.confirm(`Publish this round? ${cleared} cleared candidate(s) will advance to the next round; the rest will be marked rejected.`)) return;
    let res;
    try { res = await api.publishRound(id, order); } catch { res = { advanced: cleared }; }
    setFlash(res.final_round
      ? `Final round published — ${res.advanced} selected.`
      : `Published — ${res.advanced} advanced to round ${res.next_round}.`);
    load();
  }

  const scores = data?.scores || [];
  const sQuery = sq.trim().toLowerCase();
  const shown = scores.filter((s) => {
    const matchQ = !sQuery || [s.candidate_name, s.candidate_email, s.candidate_roll, s.candidate_id]
      .some((v) => (v || "").toLowerCase().includes(sQuery));
    const matchC = filterC === "all" || (filterC === "cleared" ? s.cleared : !s.cleared);
    return matchQ && matchC;
  });
  const roundLabel = data?.round?.label || `Round ${order}`;
  const isWritten = ["aptitude", "coding", "verbal", "technical", "sql"].includes(data?.round?.type);

  return (
    <div>
      {/* Round selector from the pipeline */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(rounds.length ? rounds : [{ order: 1, label: "Round 1" }]).map((r) => (
          <button
            key={r.order}
            onClick={() => setOrder(r.order)}
            className={`h-9 px-4 rounded-md text-sm font-medium transition-colors ${
              order === r.order ? "bg-invert-900 text-white" : "bg-surface border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {r.order}. {r.label || r.type}{r.optional ? " (opt)" : ""}
          </button>
        ))}
      </div>

      {flash && (
        <div className="mb-4 rounded-md bg-teal-500/10 text-teal-700 p-3 text-sm flex items-center gap-2">
          <CheckCircle2 size={15} /> {flash}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-ink-900 flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" /> {roundLabel} — marks sheet
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isWritten
                ? "Written round — auto-analysed from the portal; edit marks, clear/reject, add referred candidates."
                : "Panel round — enter each candidate's marks and remarks, then publish."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => download(false)} disabled={!scores.length || !!dl}>
              <Download size={16} /> {dl === "all" ? "Preparing…" : "Export all"}
            </Button>
            <Button variant="secondary" onClick={() => download(true)} disabled={!scores.length || !!dl}>
              <Download size={16} /> {dl === "cleared" ? "Preparing…" : "Export cleared"}
            </Button>
            <Button variant="ghost" onClick={deleteRound} disabled={rounds.length <= 1}
              className="text-rose-600 hover:bg-rose-50" title="Remove this round; later rounds shift up">
              <Trash2 size={16} /> Delete round
            </Button>
            <Button variant="amber" onClick={publish} disabled={!scores.length}>
              <Rocket size={16} /> Publish round
            </Button>
          </div>
        </div>

        {scores.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <div className="relative max-w-xs w-full sm:w-auto">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={sq} onChange={(e) => setSq(e.target.value)}
                placeholder="Search this round by name, email, roll…" className="h-9 pl-8 sm:w-72" />
            </div>
            <select value={filterC} onChange={(e) => setFilterC(e.target.value)}
              className="h-9 px-2 rounded-md border border-slate-200 text-sm bg-surface">
              <option value="all">All candidates</option>
              <option value="cleared">Cleared only</option>
              <option value="not_cleared">Not cleared</option>
            </select>
            <span className="text-xs text-slate-400 whitespace-nowrap">{shown.length} of {scores.length}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400 border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-4 font-medium">Candidate</th>
                <th className="py-2.5 px-4 font-medium w-28">Marks</th>
                <th className="py-2.5 px-4 font-medium w-24">Out of</th>
                <th className="py-2.5 px-4 font-medium">Remarks</th>
                <th className="py-2.5 px-4 font-medium w-24">Cleared</th>
                <th className="py-2.5 px-4 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>
              ) : scores.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">
                  No candidates in this round yet{order > 1 ? " — publish the previous round to advance candidates" : ""}.
                </td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">No candidates match your search.</td></tr>
              ) : shown.map((s) => (
                <tr key={s.candidate_id} className={s.cleared ? "bg-teal-500/5" : ""}>
                  <td className="py-2 px-4 font-medium text-ink-900">
                    {s.candidate_name || s.candidate_email ? (
                      <div className="leading-tight">
                        <span>{s.candidate_name || s.candidate_email}</span>
                        {s.candidate_email && (
                          <span className="block text-xs text-slate-400">{s.candidate_email}</span>
                        )}
                        {s.candidate_roll && (
                          <span className="block text-xs text-slate-400">Roll: {s.candidate_roll}</span>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-xs">{s.candidate_id}</span>
                    )}
                    {s.coding_total > 0 && (
                      <Badge tone={s.coding_attempted > 0 ? "teal" : "slate"} className="ml-2"
                        title={`Coding: ${s.coding_correct || 0} correct of ${s.coding_attempted || 0} attempted (${s.coding_total} total)`}>
                        {s.coding_attempted > 0
                          ? `coding ${s.coding_correct || 0} correct / ${s.coding_attempted} attempted of ${s.coding_total}`
                          : "no coding attempted"}
                      </Badge>
                    )}
                    {s.referred && <Badge tone="amber" className="ml-2">referred</Badge>}
                    <button onClick={() => setSkillsFor(s)}
                      className="ml-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline align-middle">
                      <BadgeCheck size={13} /> Verified skills
                    </button>
                  </td>
                  <td className="py-2 px-4">
                    <Input type="number" defaultValue={s.marks} className="h-9"
                      onBlur={(e) => { const v = Number(e.target.value); patchLocal(s.candidate_id, { marks: v }); save(s.candidate_id, { marks: v }); }} />
                  </td>
                  <td className="py-2 px-4">
                    <Input type="number" defaultValue={s.max_marks} className="h-9"
                      onBlur={(e) => { const v = Number(e.target.value); patchLocal(s.candidate_id, { max_marks: v }); save(s.candidate_id, { max_marks: v }); }} />
                  </td>
                  <td className="py-2 px-4">
                    <Input defaultValue={s.remarks || ""} placeholder="—" className="h-9"
                      onBlur={(e) => save(s.candidate_id, { remarks: e.target.value })} />
                  </td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => { const v = !s.cleared; patchLocal(s.candidate_id, { cleared: v }); save(s.candidate_id, { cleared: v }); }}
                      className={`h-8 px-3 rounded-md text-xs font-semibold ${s.cleared ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500"}`}
                    >
                      {s.cleared ? "Cleared" : "Mark"}
                    </button>
                  </td>
                  <td className="py-2 px-4">
                    <button onClick={() => remove(s.candidate_id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add referred candidate */}
        <div className="p-4 border-t border-slate-100 flex items-end gap-2">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Users size={12} /> Add a referred candidate</label>
            <Input value={addId} onChange={(e) => setAddId(e.target.value)} placeholder="candidate id / email" className="h-9" />
          </div>
          <Button variant="secondary" onClick={add} disabled={!addId.trim()}><Plus size={16} /> Add</Button>
        </div>
      </Card>

      {skillsFor && <SkillsModal candidate={skillsFor} onClose={() => setSkillsFor(null)} />}
    </div>
  );
}

// Recruiter proof-of-competence: a candidate's verified skill tags, straight from
// their real drive-exam performance (the Drive evaluation twin).
function SkillsModal({ candidate, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const name = candidate.candidate_name || candidate.candidate_email || candidate.candidate_id;

  useEffect(() => {
    (async () => {
      try { setData(await api.candidateSkills(candidate.candidate_id)); }
      catch { setData({ error: true }); }
      finally { setLoading(false); }
    })();
  }, [candidate.candidate_id]);

  const tone = { strong: "teal", developing: "amber", weak: "rose" };
  const topics = data?.topics || [];
  const cats = data?.by_category || [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-invert-950/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900 flex items-center gap-2">
              <BadgeCheck size={18} className="text-brand-500" /> Verified skills
            </h2>
            <p className="text-sm text-slate-500">{name}{candidate.candidate_roll ? ` · ${candidate.candidate_roll}` : ""}</p>
          </div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-md hover:bg-slate-100"><X size={18} /></button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 py-6 text-center">Loading proof…</p>
        ) : !data || data.error || data.exams_taken === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No verified exam performance yet for this candidate.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3.5">
              <span className="font-display text-2xl font-bold text-ink-900 tabular-nums">{data.overall?.mastery ?? 0}%</span>
              <div className="text-sm text-slate-500">
                overall · {data.overall?.correct}/{data.overall?.attempted} correct across {data.exams_taken} exam(s)
                {candidate.coding_total > 0 && <span className="block">coding: {candidate.coding_correct || 0}/{candidate.coding_attempted || 0} of {candidate.coding_total}</span>}
              </div>
            </div>

            {cats.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">By area</p>
                <div className="flex flex-wrap gap-2">
                  {cats.map((c) => (
                    <Badge key={c.name} tone={tone[c.band] || "slate"} className="capitalize">
                      {c.name} {c.band} · {c.mastery}%
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {topics.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Verified topics</p>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t) => (
                    <span key={t.name} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                      t.band === "strong" ? "bg-teal-500/10 text-teal-700"
                        : t.band === "weak" ? "bg-rose-500/10 text-rose-700" : "bg-amber-500/10 text-amber-700"}`}>
                      {t.band === "strong" && <BadgeCheck size={13} />}
                      {t.name} · {t.mastery}%
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400">Evidence-backed — computed from this candidate's actual answers, not a self-reported claim.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
