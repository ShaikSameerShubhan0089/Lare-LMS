import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
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
  { icon: Users, value: 60000, suffix: "+", label: "Learners trained" },
  { icon: Building2, value: 500, suffix: "+", label: "Campus partners" },
  { icon: Briefcase, value: 3000, suffix: "+", label: "Drives conducted" },
  { icon: Award, value: 22000, suffix: "+", label: "Offers generated" },
];

// Placeholder "trusted by" wordmarks (generic brands — swap for real partners).
const TRUSTED = ["NovaByte", "Trigon Labs", "Cloudspan", "Finlytics", "Vaultise", "Northgate"];

const STORIES = [
  { name: "Sneha Reddy", role: "Placed · Software Engineer", company: "Product company", quote: "By third year I was interview-ready, not just exam-ready. LARE put my proven skills in front of recruiters — I got shortlisted on evidence, not a resume keyword." },
  { name: "Arjun Mehta", role: "Placed · Data Analyst", company: "Fintech", quote: "The skill map showed me exactly what to fix, and the adaptive drills closed the gap. I walked into the drive knowing I'd earned the offer." },
  { name: "T. Ananya", role: "Placement Officer", company: "Partner college", quote: "A drive used to be weeks of spreadsheets and follow-ups. With LARE we run screening to signed offers in days — with a full audit trail our management trusts." },
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
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, -64]);
  const heroGlow = useTransform(scrollY, [0, 500], [0, 40]);
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
              <Sparkles size={13} /> AI-native · Learn → Hire · Evidence-driven
            </Badge>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-ink-900 leading-[1.03] tracking-[-0.01em]">
              Where careers are built
              <br />
              <span className="bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">— and proven.</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 max-w-md">
              One platform for the whole arc: a four-year, AI-guided journey that makes students
              genuinely job-ready — and an evidence-driven hiring engine that places them.
              <span className="text-ink-900 font-medium"> Learn. Prove it. Get hired.</span>
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

          {/* Product preview — parallax, framed like a real app screenshot */}
          <motion.div style={{ y: heroY }} className="relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative"
            >
              <div className="rounded-2xl border border-slate-200 bg-surface shadow-lift overflow-hidden">
                {/* window chrome */}
                <div className="flex items-center gap-1.5 px-4 h-10 border-b border-slate-100 bg-slate-50/70">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-400/70" />
                  <span className="ml-3 text-[11px] text-slate-400 font-medium truncate">lareitcloudsolutions.com · dashboard</span>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Your progress</p>
                      <p className="font-display text-xl font-semibold text-ink-900">Year 2 · Coding</p>
                    </div>
                    <Badge tone="amber"><Trophy size={13} /> Level 4</Badge>
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
                      <span className="grid place-items-center h-9 w-9 rounded-md bg-brand-500/10 text-brand-600"><Code2 size={18} /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900 truncate">Next: DSA — Recursion challenge</p>
                        <p className="text-xs text-slate-400">Earn 120 XP · unlocks a badge</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* floating "offer received" chip — depth */}
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.4 }}
                className="absolute -bottom-5 -left-5 rounded-xl border border-slate-200 bg-surface shadow-card px-3.5 py-2.5 flex items-center gap-2.5">
                <span className="grid place-items-center h-8 w-8 rounded-lg bg-teal-500/10 text-teal-600"><Award size={16} /></span>
                <div><p className="text-[12px] font-semibold text-ink-900 leading-none">Offer received</p><p className="text-[10.5px] text-slate-400 mt-0.5">94% skill match</p></div>
              </motion.div>
            </motion.div>
            <motion.div style={{ y: heroGlow }} className="absolute -z-10 -top-6 -right-6 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl animate-float" />
          </motion.div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="border-y border-slate-100 bg-slate-50/40">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-5">Trusted by colleges &amp; recruiters</p>
          <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-5">
            {TRUSTED.map((name) => (
              <span key={name} className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                <span className="grid place-items-center h-7 w-7 rounded-md bg-invert-900 text-white text-[12px] font-display font-bold">{name[0]}</span>
                <span className="font-display font-semibold text-[15px] tracking-tight">{name}</span>
              </span>
            ))}
          </div>
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

      {/* Two products, one journey */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold text-brand-500">One platform · two products</p>
          <h2 className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-ink-900">From first-year foundation to signed offer</h2>
          <p className="mt-3 text-slate-500 max-w-2xl mx-auto">LARE Learn grows the talent. LARE Hire proves it and places it — on the same evidence, end to end.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5 relative">
          <div className="hidden md:grid absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-surface border border-slate-200 shadow-card place-items-center text-slate-400"><ArrowRight size={20} /></div>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-500/[0.06] via-surface to-surface p-7">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center h-12 w-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm"><GraduationCap size={24} /></span>
              <div><p className="font-display text-xl font-bold text-ink-900">LARE Learn</p><p className="text-[12.5px] text-slate-500">Four years. One platform. Career-ready.</p></div>
            </div>
            <ul className="mt-5 space-y-2.5">
              {[[Code2, "Branch-wise curriculum + adaptive coding drills"], [Sparkles, "AI tutor, skill map & micro-lessons"], [Trophy, "Gamified XP, badges & leaderboards"], [ShieldCheck, "Proctored assessments with a verifiable wallet"]].map(([Ic, t]) => (
                <li key={t} className="flex items-start gap-2.5 text-[13.5px] text-slate-600"><Ic size={16} className="text-brand-500 mt-0.5 shrink-0" />{t}</li>
              ))}
            </ul>
            <Button as={Link} to="/register" variant="secondary" className="mt-6 w-full justify-center">Start learning <ArrowRight size={16} /></Button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.08 }}
            className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-500/[0.07] via-surface to-surface p-7">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm"><Briefcase size={24} /></span>
              <div><p className="font-display text-xl font-bold text-ink-900">LARE Hire</p><p className="text-[12.5px] text-slate-500">Find the right talent, faster.</p></div>
            </div>
            <ul className="mt-5 space-y-2.5">
              {[[Building2, "Campus drives, eligibility & multi-round pipelines"], [Award, "Evidence-backed candidate intelligence"], [TrendingUp, "Decision confidence, not gut feel"], [Users, "Interviewer workspace & calibration"]].map(([Ic, t]) => (
                <li key={t} className="flex items-start gap-2.5 text-[13.5px] text-slate-600"><Ic size={16} className="text-amber-600 mt-0.5 shrink-0" />{t}</li>
              ))}
            </ul>
            <Button as={Link} to="/drive/attend" variant="amber" className="mt-6 w-full justify-center">Attend a drive <ArrowRight size={16} /></Button>
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

      {/* Closing CTA */}
      <section className="relative overflow-hidden bg-invert-950">
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 h-64 w-[42rem] rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.10] bg-grid" />
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white leading-[1.1]">
            Build career-ready talent.<br /><span className="text-amber-400">Hire it with confidence.</span>
          </h2>
          <p className="mt-4 text-slate-300 max-w-xl mx-auto">One evidence-driven platform for students, colleges and recruiters — from first-year foundation to signed offer.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button as={Link} to="/register" size="lg" variant="amber">Get started <ArrowRight size={18} /></Button>
            <Link to="/login" className="inline-flex items-center gap-2 h-12 px-6 rounded-lg border border-white/25 text-white font-semibold hover:bg-white/10 transition-colors">College / TPO login</Link>
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
