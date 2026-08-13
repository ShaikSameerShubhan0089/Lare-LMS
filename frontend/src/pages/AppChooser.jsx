import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Briefcase, ArrowRight, LogOut } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { Sphere, useTilt } from "../components/ui/Decor.jsx";
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
    c1: "#3B82F6", c2: "#1D4ED8", glow: "rgba(37,99,235,.22)",
  },
  {
    to: "/drive",
    icon: Briefcase,
    name: "LARE Hire",
    tagline: "Find the right talent, faster.",
    desc: "Online recruitment & assessment — drives, proctored exams, coding rounds, interviews, results, and offers.",
    c1: "#F59E0B", c2: "#D97706", glow: "rgba(245,158,11,.26)",
  },
];

function ProductTile({ a, onClick }) {
  const { rotX, rotY, onTilt, resetTilt } = useTilt(10);
  return (
    <motion.button
      onClick={onClick}
      onMouseMove={onTilt}
      onMouseLeave={resetTilt}
      style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 1000, transformStyle: "preserve-3d" }}
      className="relative text-left group rounded-2xl border border-slate-200 bg-surface p-7 shadow-card hover:shadow-lift transition-shadow overflow-hidden will-change-transform"
    >
      <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl opacity-70" style={{ background: a.glow }} />
      <div style={{ z: 28 }} className="relative">
        <span className="grid place-items-center h-14 w-14 rounded-2xl text-white" style={{ background: `linear-gradient(135deg, ${a.c1}, ${a.c2})`, boxShadow: `0 12px 26px -8px ${a.c1}, inset 0 1px 0 rgba(255,255,255,.35)` }}>
          <a.icon size={28} />
        </span>
        <div className="mt-5 flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-ink-900">{a.name}</h2>
          <ArrowRight size={18} className="text-slate-300 group-hover:text-ink-900 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5">{a.tagline}</p>
        <p className="text-sm text-slate-500 mt-3 leading-relaxed">{a.desc}</p>
      </div>
    </motion.button>
  );
}

export default function AppChooser() {
  const nav = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-24 flex items-center justify-between px-6 lg:px-10 border-b border-slate-200 bg-surface">
        <Logo size={84} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 hidden sm:block">{user?.full_name || user?.email}</span>
          <button onClick={async () => { await logout(); nav("/login"); }} className="text-sm text-slate-500 hover:text-ink-900 flex items-center gap-1.5">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <main className="relative flex-1 grid place-items-center p-6 overflow-hidden">
        {/* ambient 3D spheres */}
        <Sphere color="brand" size={70} className="absolute top-16 left-[12%] opacity-30" delay={0.4} />
        <Sphere color="amber" size={90} className="absolute bottom-16 right-[10%] opacity-30" delay={1.2} />
        <div className="relative w-full max-w-3xl">
          <div className="text-center mb-9">
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-ink-900">Choose your app</h1>
            <p className="text-slate-500 mt-1">Two applications, one LARE platform. Pick where you're headed.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {APPS.map((a) => <ProductTile key={a.to} a={a} onClick={() => nav(a.to)} />)}
          </div>
        </div>
      </main>
    </div>
  );
}
