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
  LayoutGrid,
  ArrowLeftRight,
  LogOut,
  Menu,
  Bell,
} from "lucide-react";
import { Logo } from "../ui/Logo.jsx";
import { Badge } from "../ui/primitives.jsx";
import { useAuth } from "../../lib/auth.jsx";

const RECRUITER_ROLES = ["recruiter", "company_admin", "super_admin"];
const STAFF_ROLES = ["super_admin", "company_admin", "college_admin", "trainer"];
const STUDENT = ["student"];

// Two standalone apps on one platform. Each product owns its own nav; they never
// appear together. Every item declares which roles may see it — students see only
// student pages, admins/recruiters only theirs. Items with no `roles` are shown
// to everyone in that app. Shared pages (profile/settings/notifications) live
// under each product's base path so the sidebar context stays consistent.
export const PRODUCTS = {
  lms: {
    key: "lms",
    title: "LARE LMS",
    tagline: "Learning & Training",
    base: "/lms",
    gamified: true,
    items: [
      { to: "/lms", icon: LayoutDashboard, label: "Dashboard", end: true, roles: STUDENT },
      { to: "/lms/learning", icon: BookOpen, label: "My Learning", roles: STUDENT },
      { to: "/lms/assessments", icon: ClipboardList, label: "Assessments", roles: STUDENT },
      { to: "/lms/achievements", icon: Trophy, label: "Achievements", roles: STUDENT },
      { to: "/lms/tutor", icon: Sparkles, label: "AI Tutor", roles: STUDENT },
      { to: "/lms/certificates", icon: Award, label: "Certificates", roles: STUDENT },
    ],
    sections: [
      {
        title: "Administration",
        roles: STAFF_ROLES,
        items: [
          { to: "/lms/admin", icon: Building2, label: "Institution" },
          { to: "/lms/curriculum", icon: BookMarked, label: "Curriculum Studio" },
          { to: "/lms/trainer", icon: GraduationCap, label: "Trainer Console" },
          { to: "/lms/analytics", icon: BarChart3, label: "Analytics" },
        ],
      },
    ],
    switchTo: { label: "Switch to Drive", to: "/drive" },
    home: "/lms",
  },
  drive: {
    key: "drive",
    title: "LARE Drive",
    tagline: "Campus Recruitment",
    base: "/drive",
    gamified: false,
    // Students only browse & take their drive tests here. No LMS anything.
    items: [
      { to: "/drive", icon: Briefcase, label: "My Drives", end: true, roles: STUDENT },
    ],
    sections: [
      {
        title: "Recruiter",
        roles: RECRUITER_ROLES,
        items: [
          { to: "/drive/recruiter/drives", icon: Building2, label: "Manage Drives" },
          { to: "/drive/recruiter/questions", icon: FileStack, label: "Question Bank" },
        ],
      },
    ],
    switchTo: { label: "Switch to LMS", to: "/lms" },
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
  const roles = user?.roles || [];

  const initials = (user?.full_name || user?.email || "?")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[260px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-ink-900 text-slate-200 flex flex-col transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/10">
          <Logo dark />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/90 border-l border-white/15 pl-2.5">
            {cfg.title.replace("LARE ", "")}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                {sec.items.map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={linkClass}>
                    <item.icon size={19} strokeWidth={1.75} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ) : null,
          )}
        </nav>

        {/* App switcher + shared */}
        <div className="px-3 py-2 border-t border-white/10 space-y-1">
          <button onClick={() => nav(cfg.switchTo.to)} className={linkClass({ isActive: false }) + " w-full"}>
            <ArrowLeftRight size={19} strokeWidth={1.75} /> {cfg.switchTo.label}
          </button>
          <button onClick={() => nav("/apps")} className={linkClass({ isActive: false }) + " w-full"}>
            <LayoutGrid size={19} strokeWidth={1.75} /> All apps
          </button>
          <NavLink to={`${cfg.base}/settings`} onClick={() => setOpen(false)} className={linkClass}>
            <SettingsIcon size={19} strokeWidth={1.75} /> Settings
          </NavLink>
          <button
            onClick={async () => { await logout(); nav("/login"); }}
            className={linkClass({ isActive: false }) + " w-full"}
          >
            <LogOut size={19} strokeWidth={1.75} /> Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-ink-950/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20">
          <button
            className="lg:hidden grid place-items-center h-10 w-10 rounded-md hover:bg-slate-100"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:block">
            <p className="text-sm text-slate-400">{cfg.title} · {cfg.tagline}</p>
            <p className="font-display font-semibold text-ink-900 -mt-0.5">
              {user?.full_name || user?.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {cfg.gamified && (
              <Badge tone="amber"><Trophy size={13} /> Level 4</Badge>
            )}
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
              className="grid place-items-center h-10 w-10 rounded-full bg-ink-900 text-white text-sm font-semibold"
              aria-label="Profile"
            >
              {initials}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
