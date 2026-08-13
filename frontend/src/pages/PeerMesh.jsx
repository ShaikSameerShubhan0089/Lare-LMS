import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, HandHelping, GraduationCap, Check, X, Sparkles, ArrowRight, Brain,
} from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, Loading } from "../components/ui/states.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

// LARE Learn — Human Knowledge Mesh. The twin knows who just mastered a topic
// and who is a step behind, and pairs them for peer teach-back (learning by
// teaching — the strongest known effect). The seeker always initiates.
export default function PeerMesh() {
  const { user } = useAuth();
  const id = user?.id;
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState({ as_mentor: [], as_learner: [] });
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [ov, ss] = await Promise.all([api.meshOverview(id), api.meshSessions(id)]);
      setOverview(ov); setSessions(ss);
    } catch { setOverview({ get_help: [], can_teach: [] }); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (id) load(); /* eslint-disable-next-line */ }, [id]);

  async function requestHelp(topic, mentorId) {
    setBusy(topic + mentorId);
    try { await api.meshRequest(topic, mentorId, null); setFlash("Request sent — your mentor will be notified."); await load(); }
    catch { setFlash("Couldn't send the request."); }
    finally { setBusy(""); setTimeout(() => setFlash(""), 3000); }
  }
  async function respond(sid, accept) {
    setBusy(sid);
    try { await api.meshRespond(sid, accept); await load(); }
    catch { setFlash("Couldn't respond."); }
    finally { setBusy(""); }
  }
  async function complete(sid) {
    setBusy(sid);
    try { await api.meshComplete(sid); setFlash("Marked complete — nice teamwork!"); await load(); }
    catch { setFlash("Couldn't update."); }
    finally { setBusy(""); setTimeout(() => setFlash(""), 3000); }
  }

  if (loading) return <Loading />;

  const getHelp = overview?.get_help || [];
  const canTeach = (overview?.can_teach || []).filter((c) => c.seekers > 0);
  const incoming = (sessions.as_mentor || []).filter((s) => s.status === "requested");
  const activeMentor = (sessions.as_mentor || []).filter((s) => s.status === "accepted");
  const outgoing = sessions.as_learner || [];

  return (
    <div>
      <PageHeader
        title="Peer Mesh"
        subtitle="Learn from a classmate who just nailed it — and teach one who's a step behind. Teaching is the fastest way to master something yourself."
        right={<Button as={Link} to="/lms/skill-map" variant="secondary"><Brain size={16} /> Skill Map</Button>}
      />

      {flash && <div className="mb-5 rounded-md bg-teal-500/10 text-teal-700 p-3 text-sm flex items-center gap-2"><Check size={15} /> {flash}</div>}

      {/* Incoming requests to mentor */}
      {incoming.length > 0 && (
        <Card className="p-6 mb-6 border-brand-200">
          <h3 className="font-display font-semibold text-ink-900 mb-3 flex items-center gap-2">
            <HandHelping size={18} className="text-brand-500" /> A peer asked for your help
          </h3>
          <div className="space-y-2">
            {incoming.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                <span className="text-sm text-ink-900"><b>{s.learner_name}</b> would like help with <b>{s.topic}</b></span>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === s.id} onClick={() => respond(s.id, true)}><Check size={14} /> Accept</Button>
                  <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => respond(s.id, false)}><X size={14} /> Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Active pairings */}
      {(activeMentor.length > 0 || outgoing.some((s) => s.status === "accepted")) && (
        <Card className="p-6 mb-6 border-teal-200 bg-teal-500/5">
          <h3 className="font-display font-semibold text-ink-900 mb-3 flex items-center gap-2">
            <Users size={18} className="text-teal-600" /> Active teach-backs
          </h3>
          <div className="space-y-2">
            {[...activeMentor, ...outgoing.filter((s) => s.status === "accepted")].map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface border border-slate-100 p-3">
                <span className="text-sm text-ink-900">
                  <b>{s.topic}</b> · {s.teacher_id === id ? `you're mentoring ${s.learner_name}` : `${s.teacher_name} is mentoring you`}
                </span>
                <Button size="sm" variant="secondary" disabled={busy === s.id} onClick={() => complete(s.id)}>Mark done</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Get help */}
        <Card className="p-6">
          <h3 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2">
            <GraduationCap size={18} className="text-amber-500" /> Get help from a peer
          </h3>
          <p className="text-xs text-slate-400 mb-4">Classmates who are strong where you're still building.</p>
          {getHelp.length === 0 ? (
            <p className="text-sm text-slate-400">No matches yet — take a few assessments and we'll find mentors for your weak spots.</p>
          ) : (
            <div className="space-y-4">
              {getHelp.map((g) => (
                  <div key={g.topic} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-ink-900">{g.topic}</span>
                      <Badge tone="amber">you: {g.my_mastery}%</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {g.mentors.map((m) => {
                        const pending = outgoing.find(
                          (s) => s.topic === g.topic && s.teacher_id === m.id && s.status === "requested",
                        );
                        return (
                          <div key={m.id} className="flex items-center justify-between text-sm">
                            <span className="text-ink-900">{m.name} <span className="text-teal-600 tabular-nums">{m.mastery}%</span></span>
                            {pending ? (
                              <Badge tone="slate">requested</Badge>
                            ) : (
                              <Button size="sm" variant="secondary" disabled={busy === g.topic + m.id} onClick={() => requestHelp(g.topic, m.id)}>
                                <HandHelping size={13} /> Ask
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
              ))}
            </div>
          )}
        </Card>

        {/* You can teach */}
        <Card className="p-6">
          <h3 className="font-display font-semibold text-ink-900 mb-1 flex items-center gap-2">
            <Sparkles size={18} className="text-brand-500" /> You could teach
          </h3>
          <p className="text-xs text-slate-400 mb-4">Topics you've mastered where classmates need a hand. Accept requests above to help.</p>
          {canTeach.length === 0 ? (
            <p className="text-sm text-slate-400">Master a topic and you'll be able to mentor peers here.</p>
          ) : (
            <div className="space-y-2">
              {canTeach.map((c) => (
                <div key={c.topic} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <span className="font-medium text-ink-900">{c.topic} <Badge tone="teal">you: {c.my_mastery}%</Badge></span>
                  <span className="text-sm text-slate-500">{c.seekers} peer{c.seekers > 1 ? "s" : ""} could use help</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
