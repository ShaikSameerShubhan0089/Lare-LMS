import { motion } from "framer-motion";
import {
  Flame,
  Trophy,
  Code2,
  Target,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Award,
} from "lucide-react";
import { Button, Badge, Card, XPBar, StatTile } from "../components/ui/primitives.jsx";
import { useAuth } from "../lib/auth.jsx";

const SKILLS = [
  { label: "Communication", value: 72, tone: "brand" },
  { label: "Coding", value: 84, tone: "teal" },
  { label: "Aptitude", value: 78, tone: "amber" },
  { label: "Project", value: 65, tone: "brand" },
];

const BADGES = [
  { icon: Flame, label: "12-day streak", tone: "amber" },
  { icon: Code2, label: "DSA I", tone: "teal" },
  { icon: Target, label: "Aptitude Ace", tone: "brand" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const first = (user?.full_name || "there").split(" ")[0];

  return (
    <div className="space-y-6">
      {/* Hero strip */}
      <Card className="p-6 bg-ink-900 text-white border-0 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-[0.12]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <p className="text-slate-300 text-sm">Year 2 · Technical Foundation</p>
            <h1 className="text-2xl font-display font-bold text-white mt-0.5">
              Keep it up, {first} 👏
            </h1>
            <div className="mt-4 max-w-md">
              <XPBar value={720} max={1000} label="Level 4 → Level 5" />
            </div>
          </div>
          <Button variant="amber" size="lg" className="shrink-0">
            Resume: Recursion <ArrowRight size={18} />
          </Button>
        </div>
      </Card>

      {/* Stat tiles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Flame} label="Current streak" value="12 days" tone="amber" sub="Best: 21" />
        <StatTile icon={Trophy} label="Total XP" value="4,720" tone="brand" sub="Rank #6 in cohort" />
        <StatTile icon={CheckCircle2} label="Modules done" value="38 / 52" tone="teal" />
        <StatTile icon={Award} label="Badges" value="9" tone="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Skill scorecard */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-semibold text-ink-900">Skill scorecard</h2>
              <p className="text-sm text-slate-500">Your readiness across the four dimensions.</p>
            </div>
            <Badge tone="teal">Placement track</Badge>
          </div>
          <div className="space-y-5">
            {SKILLS.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-ink-900">{s.label}</span>
                  <span className="tabular-nums text-slate-500">{s.value}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      s.tone === "teal"
                        ? "bg-teal-500"
                        : s.tone === "amber"
                          ? "bg-amber-500"
                          : "bg-brand-500"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.value}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Achievements + next up */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display font-semibold text-ink-900 mb-4">Recent badges</h2>
            <div className="space-y-3">
              {BADGES.map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span
                    className={`grid place-items-center h-10 w-10 rounded-md ${
                      b.tone === "teal"
                        ? "bg-teal-500/12 text-teal-600"
                        : b.tone === "amber"
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-brand-500/10 text-brand-600"
                    }`}
                  >
                    <b.icon size={20} strokeWidth={1.75} />
                  </span>
                  <span className="text-sm font-medium text-ink-900">{b.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display font-semibold text-ink-900 mb-3">Up next</h2>
            <div className="flex items-center gap-3 rounded-md border border-slate-100 p-3">
              <span className="grid place-items-center h-9 w-9 rounded-md bg-brand-500/10 text-brand-600">
                <BookOpen size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">SQL — Joins & Normalisation</p>
                <p className="text-xs text-slate-400">~25 min · 90 XP</p>
              </div>
            </div>
            <Button variant="secondary" className="w-full mt-3">
              Go to My Learning
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
