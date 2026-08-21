import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Trophy,
  Briefcase,
  FileCheck2,
  BarChart3,
  Code2,
  Building2,
  FileStack,
  Award,
  Sparkles,
  ClipboardList,
  GraduationCap,
  BookMarked,
  Settings as SettingsIcon,
  KeyRound,
  LogOut,
  Menu,
  Bell,
  Brain,
  Compass,
  Target,
  Repeat,
  Wallet as WalletIcon,
  Gauge,
  Users,
  Boxes,
  ShieldCheck,
  ScrollText,
  Library,
  Sun,
  Moon,
} from "lucide-react";
import { Logo } from "../ui/Logo.jsx";
import { Badge } from "../ui/primitives.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { getTheme, toggleTheme } from "../../lib/theme.js";

const RECRUITER_ROLES = ["recruiter", "company_admin", "super_admin"];
const STAFF_ROLES = ["super_admin", "company_admin", "college_admin", "trainer"];
const PLATFORM_ADMIN = ["super_admin", "company_admin"];
const ANALYTICS_ROLES = ["super_admin", "company_admin", "college_admin",
  "principal", "dean", "hod", "tpo", "faculty", "trainer"];
const CONTENT_AUTHOR_ROLES = ["super_admin", "company_admin", "college_admin", "trainer", "faculty", "hod"];
const STUDENT = ["student"];

// Two standalone apps on one platform. Each product owns its own nav; they never
// appear together. Every item declares which roles may see it — students see only
// student pages, admins/recruiters only theirs. Items with no `roles` are shown
// to everyone in that app. Shared pages (profile/settings/notifications) live
// under each product's base path so the sidebar context stays consistent.
export const PRODUCTS = {
  lms: {
    key: "lms",
    title: "LARE Learn",
    tagline: "Four years. One platform. Career-ready.",
    icon: GraduationCap,
    pill: "bg-brand-500/10 text-brand-700 ring-1 ring-brand-500/20",
    tile: "bg-gradient-to-br from-brand-500 to-brand-600",
    base: "/lms",
    gamified: true,
    items: [
      { to: "/lms", icon: LayoutDashboard, label: "Dashboard", end: true, roles: STUDENT },
      { to: "/lms/roadmap", icon: GraduationCap, label: "My Roadmap", roles: STUDENT },
      { to: "/lms/learning", icon: BookOpen, label: "My Learning", roles: STUDENT },
      { to: "/lms/assessments", icon: ClipboardList, label: "Assessments", roles: STUDENT },
      { to: "/lms/practice", icon: Code2, label: "Coding Practice", roles: STUDENT },
      { to: "/lms/drill", icon: Gauge, label: "Adaptive Drill", roles: STUDENT },
      { to: "/lms/worlds", icon: Boxes, label: "Practice Worlds", roles: STUDENT },
      { to: "/lms/skill-map", icon: Brain, label: "My Skill Map", roles: STUDENT },
      { to: "/lms/careers", icon: Compass, label: "Career Readiness", roles: STUDENT },
      { to: "/lms/keep-sharp", icon: Repeat, label: "Keep Sharp", roles: STUDENT },
      { to: "/lms/mesh", icon: Users, label: "Peer Mesh", roles: STUDENT },
      { to: "/lms/achievements", icon: Trophy, label: "Achievements", roles: STUDENT },
      { to: "/lms/lessons", icon: BookMarked, label: "Micro-Lessons", roles: STUDENT },
      { to: "/lms/tutor", icon: Sparkles, label: "AI Tutor", roles: STUDENT },
      { to: "/lms/certificates", icon: Award, label: "Certificates", roles: STUDENT },
      { to: "/lms/wallet", icon: WalletIcon, label: "My Wallet", roles: STUDENT },
    ],
    sections: [
      {
        title: "Administration",
        // Leadership/academic roles (Principal, Dean, TPO, Faculty) reach the
        // scope-clipped analytics item; management items stay staff-only via
        // their own per-item `roles`.
        roles: ANALYTICS_ROLES,
        items: [
          { to: "/lms/institution-analytics", icon: BarChart3, label: "Institution Analytics", roles: ANALYTICS_ROLES },
          { to: "/lms/placement", icon: Briefcase, label: "Placement Readiness", roles: ANALYTICS_ROLES },
          { to: "/lms/admin", icon: Building2, label: "Institution", roles: STAFF_ROLES },
          { to: "/lms/users", icon: Users, label: "User Management", roles: PLATFORM_ADMIN },
          { to: "/lms/roles", icon: ShieldCheck, label: "Roles & Permissions", roles: PLATFORM_ADMIN },
          { to: "/lms/audit", icon: ScrollText, label: "Audit Trail", roles: PLATFORM_ADMIN },
          { to: "/lms/access-codes", icon: KeyRound, label: "Access IDs", roles: STAFF_ROLES },
          { to: "/lms/course-builder", icon: Library, label: "Course Builder", roles: CONTENT_AUTHOR_ROLES },
          { to: "/lms/trainer", icon: GraduationCap, label: "Trainer Console", roles: STAFF_ROLES },
        ],
      },
    ],
    switchTo: { label: "Switch to Hire", to: "/drive" },
    home: "/lms",
  },
  drive: {
    key: "drive",
    title: "LARE Hire",
    tagline: "Find the right talent, faster.",
    icon: Briefcase,
    pill: "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20",
    tile: "bg-gradient-to-br from-amber-500 to-amber-600",
    base: "/drive",
    gamified: false,
    // Students only browse & take their drive tests here. No LMS anything.
    items: [
      { to: "/drive", icon: Briefcase, label: "My Drives", end: true, roles: STUDENT },
      { to: "/drive/opportunities", icon: Target, label: "Matched Opportunities", roles: STUDENT },
    ],
    sections: [
      {
        title: "Recruiter",
        roles: RECRUITER_ROLES,
        items: [
          { to: "/drive/recruiter/drives", icon: Building2, label: "Manage Drives" },
          { to: "/drive/recruiter/access-codes", icon: KeyRound, label: "Drive Access IDs" },
          { to: "/drive/recruiter/questions", icon: FileStack, label: "Question Bank" },
        ],
      },
    ],
    switchTo: { label: "Switch to Learn", to: "/lms" },
    home: "/drive",
  },
};

function visibleItems(items, roles) {
  return items.filter((it) => !it.roles || roles.some((r) => it.roles.includes(r)));
}

const linkClass = ({ isActive }) =>
  `w-full flex items-center gap-3 px-3 h-11 rounded-md text-sm font-medium transition-colors ${
    isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
  }`;

export function AppShell({ children, product = "lms" }) {
  const cfg = PRODUCTS[product] || PRODUCTS.lms;
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState(getTheme());
  const roles = user?.roles || [];

  const initials = (user?.full_name || user?.email || "?")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const firstName = (user?.full_name || user?.email || "there").split(/[\s@]/)[0];

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-invert-900 focus:text-white focus:text-sm">Skip to content</a>
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-invert-900 text-slate-200 flex flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 py-4 flex items-center gap-3 border-b border-white/10">
          <Logo dark size={64} />
          <div className="min-w-0">
            <p className="font-display font-bold text-white text-[17px] leading-none">{cfg.title}</p>
            <p className="text-[11px] text-amber-400/90 mt-1.5 leading-tight">{cfg.tagline}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto sidebar-scroll">
          {visibleItems(cfg.items, roles).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={linkClass}>
              <item.icon size={19} strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}

          {cfg.sections.map((sec) =>
            roles.some((r) => sec.roles.includes(r)) ? (
              <div key={sec.title}>
                <p className="px-3 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {sec.title}
                </p>
                {sec.items
                  .filter((item) => !item.roles || roles.some((r) => item.roles.includes(r)))
                  .map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={linkClass}>
                    <item.icon size={19} strokeWidth={1.75} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ) : null,
          )}
        </nav>

        {/* Settings + sign out. LARE Learn and LARE Hire are separate accounts,
            so there is no in-session product switch — signing into the other
            product means logging in with that account from the home page. */}
        <div className="px-3 py-2 border-t border-white/10 space-y-1">
          <NavLink to={`${cfg.base}/settings`} onClick={() => setOpen(false)} className={linkClass}>
            <SettingsIcon size={19} strokeWidth={1.75} /> Settings
          </NavLink>
          <button
            onClick={async () => { await logout(); nav(cfg.key === "drive" ? "/hire/login" : "/learn/login"); }}
            className={linkClass({ isActive: false }) + " w-full"}
          >
            <LogOut size={19} strokeWidth={1.75} /> Sign out
          </button>
        </div>

        {/* Parent-company attribution */}
        <div className="px-4 py-3.5 border-t border-white/10 flex items-center gap-3">
          <img
            src="/brand/lare-parent.png"
            alt="LARE Consulting & Technology Pvt. Ltd."
            className="h-14 w-14 object-contain rounded-lg bg-surface p-1 shrink-0 shadow-sm"
          />
          <p className="text-[11px] leading-snug text-slate-400">
            A unit of
            <span className="block text-slate-200 font-semibold text-xs mt-0.5">LARE Consulting &amp; Technology Pvt. Ltd.</span>
          </p>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-invert-950/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex flex-col min-h-screen">
        <header className="h-16 bg-surface border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20">
          <button
            className="lg:hidden grid place-items-center h-10 w-10 rounded-md hover:bg-slate-100"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:flex items-center gap-3.5">
            <span className={`grid place-items-center h-12 w-12 rounded-xl text-white shadow-sm ${cfg.tile}`}>
              <cfg.icon size={24} strokeWidth={2} />
            </span>
            <div className="leading-tight">
              <p className="font-display font-bold text-ink-900 text-xl -mb-0.5">{cfg.title}</p>
              <p className="text-[13px] text-slate-500 font-medium">{cfg.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right leading-tight mr-1">
              <p className="text-[11px] text-slate-400">Welcome back</p>
              <p className="font-display font-semibold text-ink-900 text-sm -mt-0.5">{firstName}</p>
            </div>
            {cfg.gamified && (
              <Badge tone="amber"><Trophy size={13} /> Level 4</Badge>
            )}
            <button
              onClick={() => setThemeState(toggleTheme())}
              className="grid place-items-center h-10 w-10 rounded-md hover:bg-slate-100 text-slate-500"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun size={19} strokeWidth={1.75} /> : <Moon size={19} strokeWidth={1.75} />}
            </button>
            <button
              onClick={() => nav(`${cfg.base}/notifications`)}
              className="relative grid place-items-center h-10 w-10 rounded-md hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Bell size={19} strokeWidth={1.75} />
              <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-rose-500" />
            </button>
            <button
              onClick={() => nav(`${cfg.base}/profile`)}
              className="grid place-items-center h-10 w-10 rounded-full bg-invert-900 text-white text-sm font-semibold"
              aria-label="Profile"
            >
              {initials}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 p-4 lg:p-8 outline-none">{children}</main>
      </div>
    </div>
  );
}
