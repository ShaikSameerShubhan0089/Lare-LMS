import { Link } from "react-router-dom";
import { Mail, Star, Flame, Trophy, Award, Brain, Compass, Wallet as WalletIcon, ArrowRight } from "lucide-react";
import { Card, Badge, Button, XPBar } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource } from "../components/ui/states.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../lib/auth.jsx";
import { api, withFallback } from "../lib/api.js";

// LARE Learn — the learner's own profile. Identity comes from the shared platform
// (auth), progress from LMS gamification. This page NEVER calls a LARE Hire
// (/drive/*) endpoint — the two products stay fully isolated; the recruitment
// profile lives only on the Hire side.
const EMPTY_GAME = { level: 1, total_xp: 0, next_level_at: 1000, streak: { current: 0, longest: 0 }, badges: [] };

const ROLE_LABEL = {
  student: "Student", trainer: "Trainer", content_manager: "Content Manager",
  college_admin: "College Admin", super_admin: "Super Admin",
};

export default function LearnProfile() {
  const { user } = useAuth();
  const id = user?.id;
  const game = useAsync(
    () => (id ? withFallback(api.game(id), EMPTY_GAME) : Promise.resolve({ data: EMPTY_GAME, live: false })),
    [id],
  );

  if (game.loading) return <Loading />;
  const g = game.data || EMPTY_GAME;
  const badges = g.badges || [];
  const roles = user?.roles || [];
  const initials = (user?.full_name || user?.email || "?")
    .split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Your learner identity & progress"
        right={<DataSource live={game.live} />}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Identity */}
        <Card className="p-6 text-center">
          <span className="grid place-items-center h-24 w-24 rounded-full bg-invert-900 text-white text-3xl font-display font-bold mx-auto mb-4">
            {initials}
          </span>
          <p className="font-display text-lg font-bold text-ink-900">{user?.full_name || "Learner"}</p>
          <p className="text-sm text-slate-500 flex items-center justify-center gap-1.5 mt-1">
            <Mail size={14} /> {user?.email}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {roles.map((r) => <Badge key={r} tone="brand">{ROLE_LABEL[r] || r}</Badge>)}
          </div>
        </Card>

        {/* Progress snapshot */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-ink-900 flex items-center gap-2">
              <Star size={18} className="text-amber-500" /> Learning progress
            </h2>
            <Badge tone="amber"><Star size={13} /> Level {g.level}</Badge>
          </div>
          <XPBar value={g.total_xp || 0} max={g.next_level_at || 1000} label={`Level ${g.level} → ${g.level + 1}`} />

          <div className="grid grid-cols-3 gap-4 mt-6">
            <Snap icon={Flame} tone="amber" label="Streak" value={`${g.streak?.current ?? 0}d`} sub={`Best ${g.streak?.longest ?? 0}`} />
            <Snap icon={Trophy} tone="brand" label="Total XP" value={(g.total_xp || 0).toLocaleString()} />
            <Snap icon={Award} tone="teal" label="Badges" value={badges.length} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button as={Link} to="/lms/skill-map" variant="secondary" size="sm"><Brain size={15} /> Skill Map</Button>
            <Button as={Link} to="/lms/careers" variant="secondary" size="sm"><Compass size={15} /> Career Readiness</Button>
            <Button as={Link} to="/lms/achievements" variant="secondary" size="sm"><Trophy size={15} /> Achievements</Button>
            <Button as={Link} to="/lms/wallet" variant="secondary" size="sm"><WalletIcon size={15} /> My Wallet</Button>
            <Button as={Link} to="/lms/certificates" size="sm">Certificates <ArrowRight size={15} /></Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Snap({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    brand: "text-brand-600 bg-brand-500/10",
    teal: "text-teal-600 bg-teal-500/10",
    amber: "text-amber-600 bg-amber-500/10",
  };
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <span className={`grid place-items-center h-9 w-9 rounded-lg ${tones[tone]}`}><Icon size={18} /></span>
      <p className="mt-2.5 font-display text-xl font-bold text-ink-900 tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-400">{label}{sub ? ` · ${sub}` : ""}</p>
    </div>
  );
}
