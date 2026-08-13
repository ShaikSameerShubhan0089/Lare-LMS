// LARE Cloud Solutions — real brand mark (public/brand/lare-cloud.png).
// On dark surfaces the logo sits on a white rounded chip so its light artwork
// reads crisply instead of looking like a stray box.
export function Logo({ className = "", dark = false, size = 64 }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <img
        src="/brand/lare-cloud.png"
        alt="LARE Cloud Solutions"
        className={`object-contain rounded-lg ${
          dark ? "bg-surface p-1 shadow-sm ring-1 ring-black/5" : ""
        }`}
        style={{ height: size, width: size }}
      />
    </span>
  );
}
