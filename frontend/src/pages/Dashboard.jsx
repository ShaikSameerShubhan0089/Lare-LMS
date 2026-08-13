import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Flame, Trophy, Award, Star, ArrowRight, Code2, Target } from "lucide-react";
import { Button, Badge, Card, XPBar, StatTile } from "../components/ui/primitives.jsx";
import { Orbs } from "../components/ui/Decor.jsx";
import { Loading } from "../components/ui/states.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { api, withFallback } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { emptyGame, emptyScorecard } from "../lib/demo.js";

// Known badge codes → display. Unknown codes still render with a generic medal.
const BADGE_META = {
  streak_7: { icon: Flame, name: "7-Day Streak", tone: "amber" },
  dsa_i: { icon: Code2, name: "DSA I", tone: "teal" },
  aptitude_ace: { icon: Target, name: "Aptitude Ace", tone: "brand" },
};
const DIMS = [
  { key: "communication", label: "Communication", tone: "brand" },
  { key: "coding", label: "Coding", tone: "teal" },
  { key: "aptitude", label: "Aptitude", tone: "amber" },
  { key: "project", label: "Project", tone: "brand" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const learnerId = user?.id;
  const first = (user?.full_name || "there").split(" ")[0];

  // Real per-user data. If the call fails (e.g. a brand-new learner with no
  // record yet), fall back to honest zeros — never demo numbers.
  const game = useAsync(
    () => (learnerId ? withFallback(api.game(learnerId), emptyGame) : Promise.resolve({ data: emptyGame, live: false })),
    [learnerId],
  );
  const scores = useAsync(
    () => (learnerId ? withFallback(api.scorecard(learnerId), emptyScorecard) : Promise.resolve({ data: emptyScorecard, live: false })),
    [learnerId],
  );

  if (game.loading) return <Loading />;
  const g = game.data || emptyGame;
  const card = (scores.data || [])[0] || {};
  const badges = g.badges || [];
  const started = (g.total_xp || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="p-6 bg-invert-900 text-white border-0 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-[0.12]" />
        <Orbs tone="warm" className="opacity-70" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <Badge tone="amber"><Star size={13} /> Level {g.level}</Badge>
            <h1 className="text-2xl font-display font-bold text-white mt-3">
              {started ? `Keep it up, ${first} 👏` : `Welcome, ${first} 👋`}
            </h1>
            <div className="mt-4 max-w-md">
              <XPBar value={g.total_xp || 0} max={g.next_level_at || 1000} label={`Level ${g.level} → ${g.level + 1}`} />
            </div>
          </div>
          <Button as={Link} to="/lms/learning" variant="amber" size="lg" className="shrink-0">
            {started ? "Continue learning" : "Start learning"} <ArrowRight size={18} />
          </Button>
        </div>
      </Card>

      {/* Stat tiles — all from the learner's real gamification record */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Flame} label="Current streak" value={`${g.streak?.current ?? 0} days`} tone="amber" sub={`Best: ${g.streak?.longest ?? 0}`} />
        <StatTile icon={Trophy} label="Total XP" value={(g.total_xp || 0).toLocaleString()} tone="brand" />
        <StatTile icon={Award} label="Badges" value={badges.length} tone="teal" />
        <StatTile icon={Star} label="Level" value={g.level} tone="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Skill scorecard */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-semibold text-ink-900">Skill scorecard</h2>
              <p className="text-sm text-slate-500">Your readiness across the four dimensions.</p>
            </div>
          </div>
          <div className="space-y-5">
            {DIMS.map((d) => {
              const val = Math.max(0, Math.min(100, Math.round(card[d.key] ?? 0)));
              return (
                <div key={d.key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-ink-900">{d.label}</span>
                    <span className="tabular-nums text-slate-500">{val}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        d.tone === "teal" ? "bg-teal-500" : d.tone === "amber" ? "bg-amber-500" : "bg-brand-500"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${val}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {!started && (
            <p className="text-sm text-slate-400 mt-5">
              Your scorecard fills in as you take assessments and practice — start a lesson to see it grow.
            </p>
          )}
        </Card>

        {/* Badges + next up */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display font-semibold text-ink-900 mb-4">Recent badges</h2>
            {badges.length > 0 ? (
              <div className="space-y-3">
                {badges.map((code) => {
                  const meta = BADGE_META[code] || { icon: Award, name: code, tone: "brand" };
                  return (
                    <div key={code} className="flex items-center gap-3">
                      <span
                        className={`grid place-items-center h-10 w-10 rounded-md ${
                          meta.tone === "teal"
                            ? "bg-teal-500/12 text-teal-600"
                            : meta.tone === "amber"
                              ? "bg-amber-500/15 text-amber-600"
                              : "bg-brand-500/10 text-brand-600"
                        }`}
                      >
                        <meta.icon size={20} strokeWidth={1.75} />
                      </span>
                      <span className="text-sm font-medium text-ink-900">{meta.name}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                No badges yet — complete lessons and assessments to start earning them.
              </p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-display font-semibold text-ink-900 mb-3">Up next</h2>
            <p className="text-sm text-slate-500 mb-3">Jump back into your learning path.</p>
            <Button as={Link} to="/lms/learning" variant="secondary" className="w-full">
              Go to My Learning
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
