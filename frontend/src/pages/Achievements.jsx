import { motion } from "framer-motion";
import { Flame, Trophy, Award, Target, Code2, Star, Medal } from "lucide-react";
import { Card, Badge, XPBar, StatTile } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource } from "../components/ui/states.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { api, withFallback } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { demoGame, demoLeaderboard, demoScorecard, DEMO_LEARNER_ID } from "../lib/demo.js";

const BADGE_META = {
  streak_7: { icon: Flame, name: "7-Day Streak", tone: "amber" },
  dsa_i: { icon: Code2, name: "DSA I", tone: "teal" },
  aptitude_ace: { icon: Target, name: "Aptitude Ace", tone: "brand" },
};
const SKILL_TONE = { coding: "teal", aptitude: "amber", communication: "brand", project: "brand" };

export default function Achievements() {
  const { user } = useAuth();
  const learnerId = user?.id || DEMO_LEARNER_ID;
  const game = useAsync(() => withFallback(api.game(learnerId), demoGame), [learnerId]);
  const board = useAsync(() => withFallback(api.leaderboard(), demoLeaderboard), []);
  const scores = useAsync(() => withFallback(api.scorecard(learnerId), demoScorecard), [learnerId]);

  if (game.loading) return <Loading />;
  const g = game.data;
  const card = (scores.data || [])[0] || {};
  const dims = ["communication", "coding", "aptitude", "project"];

  return (
    <div>
      <PageHeader
        title="Achievements"
        subtitle="XP, badges, streaks & your skill scorecard"
        right={<DataSource live={game.live} />}
      />

      {/* Level hero */}
      <Card className="p-6 bg-ink-900 text-white border-0 relative overflow-hidden mb-6">
        <div className="bg-grid absolute inset-0 opacity-[0.12]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <Badge tone="amber">
              <Star size={13} /> Level {g.level}
            </Badge>
            <p className="mt-3 font-display text-2xl font-bold">{g.total_xp.toLocaleString()} XP</p>
            <div className="mt-3 max-w-sm">
              <XPBar value={g.total_xp} max={g.next_level_at} label={`Level ${g.level} → ${g.level + 1}`} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-16 w-16 rounded-2xl bg-amber-500 text-ink-950">
              <Flame size={30} />
            </span>
            <div>
              <p className="font-display text-2xl font-bold">{g.streak.current} 🔥</p>
              <p className="text-sm text-slate-300">day streak · best {g.streak.longest}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile icon={Trophy} label="Total XP" value={g.total_xp.toLocaleString()} tone="brand" />
        <StatTile icon={Flame} label="Streak" value={`${g.streak.current} days`} tone="amber" />
        <StatTile icon={Award} label="Badges" value={g.badges.length} tone="teal" />
        <StatTile icon={Star} label="Level" value={g.level} tone="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Skill scorecard */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-semibold text-ink-900">Skill scorecard</h2>
            <DataSource live={scores.live} />
          </div>
          <div className="space-y-5">
            {dims.map((d) => (
              <div key={d}>
                <div className="flex justify-between text-sm mb-1.5 capitalize">
                  <span className="font-medium text-ink-900">{d}</span>
                  <span className="tabular-nums text-slate-500">{card[d] ?? 0}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      SKILL_TONE[d] === "teal"
                        ? "bg-teal-500"
                        : SKILL_TONE[d] === "amber"
                          ? "bg-amber-500"
                          : "bg-brand-500"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${card[d] ?? 0}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>

          <h3 className="font-display font-semibold text-ink-900 mt-7 mb-3">Badges</h3>
          <div className="flex flex-wrap gap-3">
            {g.badges.map((code) => {
              const meta = BADGE_META[code] || { icon: Award, name: code, tone: "slate" };
              return (
                <div key={code} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-2">
                  <span
                    className={`grid place-items-center h-8 w-8 rounded-md ${
                      meta.tone === "teal"
                        ? "bg-teal-500/12 text-teal-600"
                        : meta.tone === "amber"
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-brand-500/10 text-brand-600"
                    }`}
                  >
                    <meta.icon size={18} />
                  </span>
                  <span className="text-sm font-medium text-ink-900">{meta.name}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Leaderboard */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-ink-900">Leaderboard</h2>
            <DataSource live={board.live} />
          </div>
          <div className="space-y-2">
            {(board.data || []).map((row) => (
              <div
                key={row.rank}
                className={`flex items-center gap-3 rounded-md p-2.5 ${
                  row.rank <= 3 ? "bg-amber-500/8" : ""
                }`}
              >
                <span
                  className={`grid place-items-center h-8 w-8 rounded-full text-sm font-semibold ${
                    row.rank === 1
                      ? "bg-amber-500 text-ink-950"
                      : row.rank <= 3
                        ? "bg-amber-500/20 text-amber-600"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {row.rank <= 3 ? <Medal size={15} /> : row.rank}
                </span>
                <span className="text-sm font-medium text-ink-900 flex-1 truncate">
                  {row.display_name || row.learner_id}
                </span>
                <span className="text-sm tabular-nums text-slate-500">{row.total_xp} XP</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
