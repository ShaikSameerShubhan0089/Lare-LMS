import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, Trophy } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { Orbs } from "../components/ui/Decor.jsx";

// Per-product brand for the auth rail. Learn and Hire are separate apps with
// separate accounts, so each login wears its own identity.
const BRAND = {
  learn: {
    name: "LARE Learn", tagline: "Learning platform",
    heading: ["Learn. Level up.", "Get placed."],
    blurb: "An AI-integrated, gamified path from your first year to a real Pre-Placement Offer.",
    points: [
      [Sparkles, "text-amber-400", "AI tutor & personalized study plans"],
      [Trophy, "text-amber-400", "XP, badges, streaks & leaderboards"],
      [ShieldCheck, "text-teal-400", "Certificates & a verifiable skill wallet"],
    ],
  },
  hire: {
    name: "LARE Hire", tagline: "Recruitment platform",
    heading: ["Assess. Decide.", "Hire with proof."],
    blurb: "Run drives end-to-end — proctored exams, coding rounds, interviews, and evidence-based decisions.",
    points: [
      [ShieldCheck, "text-teal-400", "Proctored exams & coding rounds"],
      [Trophy, "text-amber-400", "Structured interviews & scorecards"],
      [Sparkles, "text-amber-400", "AI insights & decision intelligence"],
    ],
  },
};

// Focused single-panel auth with a branded rail (distinct from landing/dashboard).
export function AuthLayout({ title, subtitle, children, footer, product = "learn" }) {
  const b = BRAND[product] || BRAND.learn;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Brand rail */}
      <div className="hidden lg:flex flex-col justify-between bg-invert-900 text-white p-10 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-[0.15]" />
        <Orbs tone={product === "hire" ? "warm" : "cool"} className="opacity-80" />
        <Link to="/" className="relative flex items-center gap-4">
          <Logo dark size={92} />
          <span className="flex flex-col leading-none">
            <span className="font-display font-bold text-xl text-white">{b.name}</span>
            <span className="text-sm text-slate-300 mt-1.5">{b.tagline}</span>
          </span>
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-display font-bold leading-tight text-white">
            {b.heading[0]}
            <br />
            {b.heading[1]}
          </h2>
          <p className="mt-4 text-slate-300 max-w-sm">{b.blurb}</p>
          <ul className="mt-8 space-y-3 text-sm text-slate-200">
            {b.points.map(([Icon, color, text]) => (
              <li key={text} className="flex items-center gap-2.5">
                <Icon size={18} className={color} /> {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} LARE Cloud Solutions · A unit of LARE Consulting &amp; Technology Pvt. Ltd.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden mb-8 flex flex-col items-center text-center">
            <Link to="/">
              <Logo size={104} />
            </Link>
            <p className="mt-3 font-display font-bold text-lg text-ink-900">{b.name}</p>
          </div>
          <h1 className="text-2xl font-display font-bold text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
