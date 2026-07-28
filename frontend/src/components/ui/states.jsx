import { Loader2, Inbox, WifiOff } from "lucide-react";

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="grid place-items-center py-20 text-slate-400">
      <Loader2 className="animate-spin mb-3" size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", hint }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <span className="grid place-items-center h-12 w-12 rounded-xl bg-slate-100 text-slate-400 mb-3">
        <Inbox size={22} />
      </span>
      <p className="font-display font-semibold text-ink-900">{title}</p>
      {hint && <p className="text-sm text-slate-500 mt-1 max-w-sm">{hint}</p>}
    </div>
  );
}

// Small indicator: are we showing live backend data or the offline demo set?
export function DataSource({ live }) {
  if (live) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600">
      <WifiOff size={12} /> Demo data (backend offline)
    </span>
  );
}
