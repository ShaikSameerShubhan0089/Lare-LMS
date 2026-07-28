import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, Trophy } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";

// Focused single-panel auth with a branded rail (distinct from landing/dashboard).
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Brand rail */}
      <div className="hidden lg:flex flex-col justify-between bg-ink-900 text-white p-10 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-[0.15]" />
        <Link to="/" className="relative">
          <Logo dark />
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-display font-bold leading-tight text-white">
            Learn. Level up.
            <br />
            Get placed.
          </h2>
          <p className="mt-4 text-slate-300 max-w-sm">
            An AI-integrated, gamified path from your first year to a real Pre-Placement Offer.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-200">
            <li className="flex items-center gap-2.5">
              <Sparkles size={18} className="text-amber-400" /> AI tutor & personalized study plans
            </li>
            <li className="flex items-center gap-2.5">
              <Trophy size={18} className="text-amber-400" /> XP, badges, streaks & leaderboards
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-teal-400" /> Proctored drives & coding rounds
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} LARE IT Cloud Solutions
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Link to="/">
              <Logo />
            </Link>
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
