import { useNavigate } from "react-router-dom";
import { GraduationCap, Briefcase, ArrowRight, LogOut } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { useAuth } from "../lib/auth.jsx";

// Post-login chooser: two standalone apps on one platform. Pick one to enter its
// own dedicated experience — they never mix on screen.
const APPS = [
  {
    to: "/lms",
    icon: GraduationCap,
    name: "LARE Learn",
    tagline: "Four years. One platform. Career-ready.",
    desc: "The 4-year structured training programme — curriculum, assessments, gamified progress, certificates, and the AI tutor.",
    accent: "from-brand-500/15 to-brand-500/0 text-brand-600",
    ring: "hover:border-brand-300",
  },
  {
    to: "/drive",
    icon: Briefcase,
    name: "LARE Hire",
    tagline: "Find the right talent, faster.",
    desc: "Online recruitment & assessment — drives, proctored exams, coding rounds, interviews, results, and offers.",
    accent: "from-amber-500/15 to-amber-500/0 text-amber-600",
    ring: "hover:border-amber-300",
  },
];

export default function AppChooser() {
  const nav = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-24 flex items-center justify-between px-6 lg:px-10 border-b border-slate-200 bg-surface">
        <Logo size={84} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 hidden sm:block">{user?.full_name || user?.email}</span>
          <button
            onClick={async () => { await logout(); nav("/login"); }}
            className="text-sm text-slate-500 hover:text-ink-900 flex items-center gap-1.5"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-ink-900">Choose your app</h1>
            <p className="text-slate-500 mt-1">Two applications, one LARE platform. Pick where you're headed.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {APPS.map((a) => (
              <button
                key={a.to}
                onClick={() => nav(a.to)}
                className={`text-left group rounded-xl border border-slate-200 bg-surface p-6 shadow-card transition-colors ${a.ring}`}
              >
                <div className={`grid place-items-center h-14 w-14 rounded-xl bg-gradient-to-br ${a.accent}`}>
                  <a.icon size={28} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <h2 className="font-display font-semibold text-lg text-ink-900">{a.name}</h2>
                  <ArrowRight size={18} className="text-slate-300 group-hover:text-ink-900 transition-colors" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-0.5">{a.tagline}</p>
                <p className="text-sm text-slate-500 mt-3 leading-relaxed">{a.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
