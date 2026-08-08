import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Compass, Target, ArrowRight, CheckCircle2, TrendingUp, Brain, Code2,
} from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../components/ui/states.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

// LARE Learn — Skills-to-Opportunity (Learn domain only). Shows how ready a
// student is for each career-role target, from their skill twin. Independent of
// LARE Hire: no live drives are shown here.
export default function CareerReadiness({ candidateId }) {
  const { user } = useAuth();
  const id = candidateId || user?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try { setData(await api.careerReadiness(id)); }
      catch { setData({ readiness: [], has_data: false }); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <Loading />;

  const roles = data?.readiness || [];
  const noData = !data?.has_data;

  return (
    <div>
      <PageHeader
        title="Career Readiness"
        subtitle="How close are you to the roles you want? This maps your skills to what each career needs — and shows exactly what to learn next."
        right={
          <Button as={Link} to="/lms/skill-map" variant="secondary">
            <Brain size={16} /> My Skill Map
          </Button>
        }
      />

      {noData ? (
        <Card className="p-10 text-center">
          <span className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-brand-500/10 text-brand-600">
            <Compass size={28} />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-ink-900">Let's find your direction</h2>
          <p className="mt-1 text-slate-500 max-w-md mx-auto">
            Take an assessment or solve a coding problem, and we'll show which careers your skills are unlocking.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button as={Link} to="/lms/practice"><Code2 size={16} /> Coding Practice</Button>
            <Button as={Link} to="/lms/assessments" variant="secondary">Take an assessment</Button>
          </div>
        </Card>
      ) : roles.length === 0 ? (
        <EmptyState title="No career roles yet"
          hint="Your trainer hasn't set up career targets. Check back soon." />
      ) : (
        <div className="space-y-5">
          {roles.map((r) => <RoleCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

function bandTone(pct) {
  return pct >= 80 ? "teal" : pct >= 50 ? "amber" : "rose";
}
function bandBar(pct) {
  return pct >= 80 ? "bg-teal-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
}

function RoleCard({ r }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-ink-900">{r.title}</h3>
          {r.description && <p className="text-sm text-slate-500 mt-0.5">{r.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className={`font-display text-3xl font-bold tabular-nums ${
            r.match_pct >= 80 ? "text-teal-600" : r.match_pct >= 50 ? "text-amber-600" : "text-rose-600"
          }`}>{r.match_pct}%</p>
          <p className="text-xs text-slate-400">ready</p>
        </div>
      </div>

      <div className="mt-3 h-2.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${bandBar(r.match_pct)} transition-all`} style={{ width: `${r.match_pct}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone="teal"><CheckCircle2 size={13} className="inline -mt-0.5 mr-1" />{r.matched.length} skills ready</Badge>
        {r.learn_next.length > 0 && (
          <Badge tone="amber"><Target size={13} className="inline -mt-0.5 mr-1" />{r.learn_next.length} to learn</Badge>
        )}
        <button onClick={() => setOpen((o) => !o)} className="text-sm text-brand-600 hover:underline ml-auto">
          {open ? "Hide details" : "See what to learn"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid sm:grid-cols-2 gap-5 border-t border-slate-100 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 mb-2">Skills you have</p>
            {r.matched.length ? (
              <div className="space-y-1.5">
                {r.matched.map((sk) => (
                  <div key={sk.name} className="flex items-center justify-between text-sm">
                    <span className="text-ink-900">{sk.name}</span>
                    <span className="tabular-nums text-teal-600 font-medium">{sk.mastery}%</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">None yet — start with the list on the right.</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Learn next (biggest impact first)</p>
            {r.learn_next.length ? (
              <div className="space-y-1.5">
                {r.learn_next.map((sk) => (
                  <div key={sk.name} className="flex items-center justify-between text-sm">
                    <span className="text-ink-900">{sk.name} <span className="text-slate-400">· weight {sk.weight}</span></span>
                    <span className="tabular-nums text-slate-500">{sk.mastery}%</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-teal-600">You're ready on every required skill! 🎉</p>}
            {r.learn_next.length > 0 && (
              <div className="mt-3 flex gap-2">
                <Button as={Link} to="/lms/practice" size="sm"><Code2 size={14} /> Practice</Button>
                <Button as={Link} to="/lms/skill-map" size="sm" variant="secondary"><TrendingUp size={14} /> Plan</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
