// LARE wordmark + cloud/skilling glyph (inline SVG — no external asset).
export function Logo({ className = "", showText = true, dark = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="11" fill={dark ? "#F59E0B" : "#13294B"} />
        <path
          d="M12 27c-2.2 0-4-1.8-4-4 0-2 1.5-3.7 3.5-3.95C12 15.6 14.7 13 18 13c2.9 0 5.3 2 6 4.7.4-.13.9-.2 1.3-.2 2.6 0 4.7 2.1 4.7 4.75S27.9 27 25.3 27H12Z"
          fill={dark ? "#13294B" : "#FBBF24"}
        />
        <circle cx="18.5" cy="21" r="1.6" fill={dark ? "#13294B" : "#2563EB"} />
        <circle cx="24" cy="21" r="1.6" fill={dark ? "#13294B" : "#2563EB"} />
      </svg>
      {showText && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-display font-bold text-lg tracking-tight ${
              dark ? "text-white" : "text-ink-900"
            }`}
          >
            LARE
          </span>
          <span className={`text-[10px] font-medium ${dark ? "text-slate-300" : "text-slate-400"}`}>
            IT CLOUD SOLUTIONS
          </span>
        </span>
      )}
    </span>
  );
}
