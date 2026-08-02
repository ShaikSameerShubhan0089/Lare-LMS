import { useEffect, useState } from "react";
import { Brain, Target, TrendingUp, Sparkles, AlertCircle } from "lucide-react";
import { Card, Badge } from "../components/ui/primitives.jsx";
import { PageHeader, Loading } from "../components/ui/states.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

// Cognitive Twin v0.1 — a learner's skill map, computed from their exam history.
// A student sees their own; a recruiter/admin can pass a candidateId to view any.
export default function SkillMap({ candidateId }) {
  const { user } = useAuth();
  const id = candidateId || user?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try { setData(await api.skillTwin(id)); }
      catch { setErr("Could not load your skill map yet."); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <Loading />;

  const o = data?.overall || { attempted: 0, correct: 0, mastery: 0 };
  const cats = data?.by_category || [];
  const topics = data?.topics || [];
  const strengths = data?.strengths || [];
  const focus = data?.focus_areas || [];
  const noData = !data || o.attempted === 0;

  return (
    <div>
      <PageHeader
        title="My Skill Map"
        subtitle="Your evolving profile — built from every test you take. The more you practise, the sharper it gets."
      />

      {noData ? (
        <Card className="p-10 text-center">
          <span className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-brand-500/10 text-brand-600">
            <Brain size={28} />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-ink-900">Your skill map is waking up</h2>
          <p className="mt-1 text-slate-500 max-w-md mx-auto">
            Take a written test or coding round and your strengths and focus areas will appear here automatically.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Overall */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat icon={Brain} tone="brand" label="Overall mastery" value={`${o.mastery}%`} />
            <Stat icon={Target} tone="teal" label="Questions correct" value={`${o.correct} / ${o.attempted}`} />
            <Stat icon={TrendingUp} tone="amber" label="Tests taken" value={data.exams_taken} />
            <Stat icon={Sparkles} tone="brand" label="Topics mapped" value={topics.length} />
          </div>

          {/* Strengths + focus */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-teal-500" /> Your strengths
              </h3>
              {strengths.length ? (
                <div className="flex flex-wrap gap-2">
                  {strengths.map((t) => (
                    <span key={t.name} className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 text-teal-700 px-3 py-1.5 text-sm font-medium">
                      {t.name} <span className="tabular-nums text-teal-600/70">{t.mastery}%</span>
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">Keep practising — strengths appear as you master topics.</p>}
            </Card>
            <Card className="p-6">
              <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2 mb-3">
                <AlertCircle size={18} className="text-amber-500" /> Focus next on
              </h3>
              {focus.length ? (
                <div className="flex flex-wrap gap-2">
                  {focus.map((t) => (
                    <span key={t.name} className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 px-3 py-1.5 text-sm font-medium">
                      {t.name} <span className="tabular-nums text-amber-600/70">{t.mastery}%</span>
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">Nothing weak right now — great work!</p>}
            </Card>
          </div>

          {/* By category */}
          {cats.length > 0 && (
            <Card className="p-6">
              <h3 className="font-display font-semibold text-ink-900 mb-4">Mastery by area</h3>
              <div className="space-y-4">
                {cats.map((c) => <Bar key={c.name} row={c} />)}
              </div>
            </Card>
          )}

          {/* All topics */}
          {topics.length > 0 && (
            <Card className="p-6">
              <h3 className="font-display font-semibold text-ink-900 mb-4">Every topic, ranked</h3>
              <div className="space-y-3">
                {topics.map((t) => <Bar key={t.name} row={t} small />)}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  const tones = {
    brand: "text-brand-600 bg-brand-500/10",
    teal: "text-teal-600 bg-teal-500/10",
    amber: "text-amber-600 bg-amber-500/10",
  };
  return (
    <Card className="p-5">
      <span className={`grid place-items-center h-10 w-10 rounded-lg ${tones[tone]}`}><Icon size={20} /></span>
      <p className="mt-3 text-sm text-slate-500">{label}</p>
      <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
    </Card>
  );
}

const BAND = {
  strong: { bar: "bg-teal-500", text: "text-teal-700", chip: "teal" },
  developing: { bar: "bg-amber-500", text: "text-amber-700", chip: "amber" },
  weak: { bar: "bg-rose-500", text: "text-rose-700", chip: "rose" },
};

function Bar({ row, small }) {
  const b = BAND[row.band] || BAND.developing;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`${small ? "text-sm" : "font-medium"} text-ink-900 capitalize`}>{row.name}</span>
        <span className="flex items-center gap-2 text-sm">
          <span className="tabular-nums text-slate-500">{row.correct}/{row.attempted}</span>
          <span className={`tabular-nums font-semibold ${b.text}`}>{row.mastery}%</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${b.bar} transition-all`} style={{ width: `${row.mastery}%` }} />
      </div>
    </div>
  );
}
