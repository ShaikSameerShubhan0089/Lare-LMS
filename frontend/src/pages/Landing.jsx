import { useRef, useState } from "react";
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
  Users,
  Briefcase,
  Award,
  TrendingUp,
  Quote,
} from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { Button, Badge, Card, XPBar } from "../components/ui/primitives.jsx";

const YEARS = [
  { n: 1, t: "Foundation & Personality", c: "brand" },
  { n: 2, t: "Technical & Stream Discovery", c: "teal" },
  { n: 3, t: "Placement Readiness", c: "amber" },
  { n: 4, t: "Industry & Capstone", c: "brand" },
];

const STATS = [
  { icon: Users, value: 52000, suffix: "+", label: "Learners on the platform" },
  { icon: Building2, value: 480, suffix: "+", label: "Partner colleges" },
  { icon: Briefcase, value: 2400, suffix: "+", label: "Drives conducted" },
  { icon: Award, value: 19500, suffix: "+", label: "Offers generated" },
];

const STORIES = [
  { name: "Sneha Reddy", role: "Placed · SDE", company: "Product company", quote: "The four-year track meant I was interview-ready by year three. LARE Drive put my evidence in front of recruiters, not just my resume." },
  { name: "Arjun Mehta", role: "Placed · Data Analyst", company: "Fintech", quote: "Adaptive drills and the skill map showed me exactly what to fix. I walked into the drive knowing I'd earned the shortlist." },
  { name: "T. Ananya", role: "Placement Officer", company: "Partner college", quote: "One drive used to be weeks of spreadsheets. With LARE we ran screening to offers in days, with a full audit trail." },
];

function CountUp({ to, suffix = "", dur = 1.6 }) {
  const [n, setN] = useState(0);
  const started = useRef(false);
  const run = () => {
    if (started.current) return;
    started.current = true;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / (dur * 1000));
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  return (
    <motion.span onViewportEnter={run} viewport={{ once: true, amount: 0.5 }}>
      {n.toLocaleString()}{suffix}
    </motion.span>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Nav */}
      <header className="h-24 border-b border-slate-100">
        <div className="mx-auto max-w-6xl h-full px-5 flex items-center justify-between">
          <Logo size={84} />
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

      {/* Success by the numbers */}
      <section className="relative overflow-hidden bg-invert-950">
        <div className="absolute inset-0 opacity-[0.12] bg-grid" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[42rem] rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 py-16">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-amber-400">Proven at scale</p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-display font-bold text-white">Careers built. Drives run. Offers made.</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="text-center"
              >
                <span className="inline-grid place-items-center h-12 w-12 rounded-2xl bg-white/10 text-amber-300 mb-3"><s.icon size={24} /></span>
                <div className="font-display text-4xl sm:text-5xl font-bold text-white tabular-nums tracking-tight"><CountUp to={s.value} suffix={s.suffix} /></div>
                <p className="mt-1.5 text-sm text-slate-300">{s.label}</p>
              </motion.div>
            ))}
          </div>
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
                  <span className="grid place-items-center h-8 w-8 rounded-md bg-invert-900 text-white font-display font-semibold text-sm">
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

      {/* Success stories */}
      <section className="bg-slate-50/60 border-y border-slate-100">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-brand-500">Success stories</p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-display font-bold text-ink-900">Where preparation meets opportunity</h2>
            <p className="mt-2 text-slate-500 max-w-xl mx-auto">Students, recruiters, and colleges — one platform, three wins.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {STORIES.map((st, i) => (
              <motion.div
                key={st.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <Card className="p-6 h-full flex flex-col">
                  <Quote size={22} className="text-brand-500/40" />
                  <p className="mt-3 text-[15px] text-slate-600 leading-relaxed flex-1">“{st.quote}”</p>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="grid place-items-center h-11 w-11 rounded-full bg-invert-900 text-white font-display font-semibold">
                      {st.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </span>
                    <div>
                      <p className="font-display font-semibold text-ink-900 leading-tight">{st.name}</p>
                      <p className="text-[12.5px] text-slate-500">{st.role} · {st.company}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
            <span className="flex items-center gap-2"><TrendingUp size={16} className="text-teal-500" /> 94% placement readiness</span>
            <span className="flex items-center gap-2"><ShieldCheck size={16} className="text-brand-500" /> Proctored &amp; audited</span>
            <span className="flex items-center gap-2"><Trophy size={16} className="text-amber-500" /> Evidence-backed hiring</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-5 text-sm text-slate-400">
          <div className="flex items-center gap-3">
            <Logo size={72} />
            <div className="leading-tight">
              <p className="font-display font-semibold text-ink-900">LARE Cloud Solutions</p>
              <p className="text-xs text-slate-400">© {new Date().getFullYear()} · All rights reserved.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-center sm:text-right">
            <img
              src="/brand/lare-parent.png"
              alt="LARE Consulting & Technology Pvt. Ltd."
              className="h-16 w-16 object-contain rounded-lg"
            />
            <p className="text-sm leading-tight text-slate-500">
              A unit of
              <span className="block font-semibold text-ink-900">LARE Consulting &amp; Technology Pvt. Ltd.</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
