import { motion } from "framer-motion";
import { Flame, Trophy, Award, Target, Code2, Star, Medal } from "lucide-react";
import { Card, Badge, XPBar, StatTile } from "../components/ui/primitives.jsx";
import { Orbs } from "../components/ui/Decor.jsx";
import { PageHeader, Loading, DataSource } from "../components/ui/states.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { api, withFallback } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { emptyGame, emptyScorecard, DEMO_LEARNER_ID } from "../lib/demo.js";

const BADGE_META = {
  streak_7: { icon: Flame, name: "7-Day Streak", tone: "amber" },
  dsa_i: { icon: Code2, name: "DSA I", tone: "teal" },
  aptitude_ace: { icon: Target, name: "Aptitude Ace", tone: "brand" },
};
const SKILL_TONE = { coding: "teal", aptitude: "amber", communication: "brand", project: "brand" };
// 3D coin gradients per tone (medallion look).
const COIN = {
  amber: { g: "linear-gradient(145deg,#fcd34d,#d97706)", s: "245,158,11" },
  teal: { g: "linear-gradient(145deg,#5eead4,#0d9488)", s: "13,148,136" },
  brand: { g: "linear-gradient(145deg,#93c5fd,#1d4ed8)", s: "37,99,235" },
  slate: { g: "linear-gradient(145deg,#cbd5e1,#475569)", s: "100,116,139" },
};

export default function Achievements() {
  const { user } = useAuth();
  const learnerId = user?.id || DEMO_LEARNER_ID;
  const game = useAsync(() => withFallback(api.game(learnerId), emptyGame), [learnerId]);
  const board = useAsync(() => withFallback(api.leaderboard(), []), []);
  const scores = useAsync(() => withFallback(api.scorecard(learnerId), emptyScorecard), [learnerId]);

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
      <Card className="p-6 bg-invert-900 text-white border-0 relative overflow-hidden mb-6">
        <div className="bg-grid absolute inset-0 opacity-[0.12]" />
        <Orbs tone="warm" className="opacity-70" />
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

          <h3 className="font-display font-semibold text-ink-900 mt-7 mb-4">Badges</h3>
          <div className="flex flex-wrap gap-5">
            {g.badges.map((code) => {
              const meta = BADGE_META[code] || { icon: Award, name: code, tone: "slate" };
              const c = COIN[meta.tone] || COIN.slate;
              return (
                <motion.div key={code} whileHover={{ y: -3, scale: 1.05 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="flex flex-col items-center gap-2 w-[78px]">
                  <span className="relative grid place-items-center h-14 w-14 rounded-full text-white"
                    style={{ background: c.g, boxShadow: `0 10px 22px -6px rgba(${c.s},.55), inset 0 2px 3px rgba(255,255,255,.55), inset 0 -4px 6px rgba(0,0,0,.28)` }}>
                    <meta.icon size={22} strokeWidth={1.9} />
                    <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 34% 24%, rgba(255,255,255,.55), transparent 46%)" }} />
                  </span>
                  <span className="text-[11px] font-medium text-ink-900 text-center leading-tight">{meta.name}</span>
                </motion.div>
              );
            })}
            {g.badges.length === 0 && <p className="text-sm text-slate-400">No badges yet — complete lessons and assessments to earn them.</p>}
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
