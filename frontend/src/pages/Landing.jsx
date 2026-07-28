import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Trophy,
  Code2,
  ShieldCheck,
  GraduationCap,
  Building2,
} from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { Button, Badge, Card, XPBar } from "../components/ui/primitives.jsx";

const YEARS = [
  { n: 1, t: "Foundation & Personality", c: "brand" },
  { n: 2, t: "Technical & Stream Discovery", c: "teal" },
  { n: 3, t: "Placement Readiness", c: "amber" },
  { n: 4, t: "Industry & Capstone", c: "brand" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="h-16 border-b border-slate-100">
        <div className="mx-auto max-w-6xl h-full px-5 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-2">
            <Button as={Link} to="/login" variant="ghost" size="sm">
              Sign in
            </Button>
            <Button as={Link} to="/register" size="sm">
              Get started
            </Button>
          </nav>
        </div>
      </header>

      {/* Editorial split hero (not a center-hero clone) */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge tone="amber">
              <Sparkles size={13} /> AI-integrated · Gamified · 4-Year Journey
            </Badge>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-ink-900 leading-[1.05]">
              Elevating ideas.
              <br />
              <span className="text-brand-500">Empowering futures.</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 max-w-md">
              One platform for the full journey — a four-year, branch-wise training programme
              with an AI tutor and a real campus-recruitment pipeline. Learn, level up, get placed.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as={Link} to="/drive/attend" size="lg" variant="amber">
                Attend Drive <ArrowRight size={18} />
              </Button>
              <Button as={Link} to="/register" size="lg">
                Start learning
              </Button>
              <Button as={Link} to="/login" variant="secondary" size="lg">
                College / TPO login
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-teal-500" /> Proctored assessments
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 size={16} className="text-brand-500" /> PPO pipeline
              </span>
            </div>
          </div>

          {/* Floating gamified preview card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative"
          >
            <Card className="p-6 shadow-lift">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Your progress</p>
                  <p className="font-display text-xl font-semibold text-ink-900">Year 2 · Coding</p>
                </div>
                <Badge tone="amber">
                  <Trophy size={13} /> Level 4
                </Badge>
              </div>
              <div className="mt-5 space-y-4">
                <XPBar value={720} max={1000} label="XP to next level" />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { k: "Streak", v: "12🔥", c: "text-amber-600" },
                    { k: "Coding", v: "84%", c: "text-teal-600" },
                    { k: "Aptitude", v: "78%", c: "text-brand-600" },
                  ].map((s) => (
                    <div key={s.k} className="rounded-md bg-slate-50 p-3 text-center">
                      <p className={`font-display text-lg font-semibold ${s.c}`}>{s.v}</p>
                      <p className="text-xs text-slate-400">{s.k}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border border-slate-100 p-3 flex items-center gap-3">
                  <span className="grid place-items-center h-9 w-9 rounded-md bg-brand-500/10 text-brand-600">
                    <Code2 size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">
                      Next: DSA — Recursion challenge
                    </p>
                    <p className="text-xs text-slate-400">Earn 120 XP · unlocks a badge</p>
                  </div>
                </div>
              </div>
            </Card>
            <div className="absolute -z-10 -top-6 -right-6 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl animate-float" />
          </motion.div>
        </div>
      </section>

      {/* Four-year journey */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-brand-500">The programme</p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-900">
              A four-year journey, built progressively
            </h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {YEARS.map((y, i) => (
            <motion.div
              key={y.n}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <Card className="p-5 h-full">
                <div className="flex items-center gap-2">
                  <span className="grid place-items-center h-8 w-8 rounded-md bg-ink-900 text-white font-display font-semibold text-sm">
                    {y.n}
                  </span>
                  <GraduationCap size={18} className="text-slate-300" />
                </div>
                <p className="mt-3 font-display font-semibold text-ink-900">{y.t}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Year {y.n} of the LARE structured training & placement programme.
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <Logo />
          <p>© {new Date().getFullYear()} LARE IT Cloud Solutions. Confidential.</p>
        </div>
      </footer>
    </div>
  );
}
