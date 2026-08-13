// Premium, self-contained SVG charts for the LARE Drive analytics. No external
// chart library. Theme-aware (tracks/axes use CSS token vars; data colors are
// explicit hues). Each chart is data-driven from real drive metrics.
import { useId } from "react";

/* ---------- smooth path (Catmull-Rom-ish) ---------- */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  const ctrl = (cur, prev, next, reverse) => {
    prev = prev || cur; next = next || cur;
    const dx = next[0] - prev[0], dy = next[1] - prev[1];
    const ang = Math.atan2(dy, dx) + (reverse ? Math.PI : 0);
    const len = Math.hypot(dx, dy) * 0.16;
    return [cur[0] + Math.cos(ang) * len, cur[1] + Math.sin(ang) * len];
  };
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const cps = ctrl(pts[i - 1], pts[i - 2], pts[i], false);
    const cpe = ctrl(pts[i], pts[i - 1], pts[i + 1], true);
    d += ` C ${cps[0]},${cps[1]} ${cpe[0]},${cpe[1]} ${pts[i][0]},${pts[i][1]}`;
  }
  return d;
}

/* ---------- Radial gauge (progress toward a max) ---------- */
export function RadialGauge({ value = 0, max = 100, label, color = "#2563EB", size = 132, suffix = "%" }) {
  const id = useId();
  const stroke = 11;
  const r = size / 2 - stroke;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.65" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-slate-200))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#g${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`} style={{ transition: "stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-[26px] font-bold text-ink-900 tabular-nums leading-none">{Math.round(value)}<span className="text-[15px] text-slate-400 font-semibold">{suffix}</span></div>
        {label && <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400 mt-1">{label}</div>}
      </div>
    </div>
  );
}

/* ---------- Funnel (narrowing trapezoids) ---------- */
export function Funnel({ stages = [] }) {
  const id = useId();
  const max = Math.max(1, ...stages.map((s) => s.value));
  const W = 560, rowH = 52, gap = 8;
  const H = stages.length * (rowH + gap) - gap;
  const wAt = (v) => Math.max(46, (v / max) * W);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 380 }}>
        <defs>
          {stages.map((s, i) => (
            <linearGradient key={i} id={`f${id}-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.82" />
              <stop offset="100%" stopColor={s.color} />
            </linearGradient>
          ))}
        </defs>
        {stages.map((s, i) => {
          const topW = wAt(s.value);
          const botW = wAt(i < stages.length - 1 ? stages[i + 1].value : s.value);
          const y = i * (rowH + gap);
          const yb = y + rowH;
          const x1 = (W - topW) / 2, x2 = (W + topW) / 2, x3 = (W + botW) / 2, x4 = (W - botW) / 2;
          const prev = i === 0 ? null : stages[i - 1].value;
          const conv = prev ? Math.round((s.value / (prev || 1)) * 100) : null;
          return (
            <g key={s.label}>
              <path d={`M${x1},${y} L${x2},${y} L${x3},${yb} L${x4},${yb} Z`} fill={`url(#f${id}-${i})`}>
                <title>{s.label}: {s.value}</title>
              </path>
              <text x={W / 2} y={y + rowH / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="17" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>{s.value}</text>
              <text x={12} y={y + rowH / 2} dominantBaseline="central" fill="rgb(var(--c-slate-600))" fontSize="12.5">{s.label}</text>
              {conv != null && <text x={W - 12} y={y + rowH / 2} textAnchor="end" dominantBaseline="central" fill="rgb(var(--c-slate-400))" fontSize="12">{conv}%</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Smooth area chart (distribution / density) ---------- */
export function AreaChart({ data = [], color = "#2563EB", height = 180 }) {
  const id = useId();
  const W = 520, H = height, padX = 14, padT = 16, padB = 28;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const xAt = (i) => padX + (n <= 1 ? 0 : (i / (n - 1)) * (W - padX * 2));
  const yAt = (v) => padT + (1 - v / max) * (H - padT - padB);
  const pts = data.map((d, i) => [xAt(i), yAt(d.value)]);
  const line = smoothPath(pts);
  const area = pts.length ? `${line} L ${xAt(n - 1)},${H - padB} L ${xAt(0)},${H - padB} Z` : "";
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={padX} x2={W - padX} y1={padT + g * (H - padT - padB)} y2={padT + g * (H - padT - padB)} stroke="rgb(var(--c-slate-100))" strokeWidth="1" />)}
        {area && <path d={area} fill={`url(#a${id})`} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r="3.5" fill="rgb(var(--c-surface))" stroke={color} strokeWidth="2">
              <title>{data[i].label}: {data[i].value}</title>
            </circle>
            <text x={p[0]} y={H - padB + 16} textAnchor="middle" fill="rgb(var(--c-slate-400))" fontSize="10.5">{data[i].label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------- Donut (composition, headline in center) ---------- */
function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0},${y0} A ${r},${r} 0 ${large} 1 ${x1},${y1}`;
}
export function Donut({ parts = [], size = 168, centerValue, centerLabel }) {
  const total = parts.reduce((n, p) => n + p.n, 0);
  const cx = size / 2, cy = size / 2, r = size / 2 - 12, stroke = 18;
  let ang = -Math.PI / 2;
  const gap = total > 1 ? 0.04 : 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(var(--c-slate-100))" strokeWidth={stroke} />
          {total > 0 && parts.map((p) => {
            const frac = p.n / total;
            const a0 = ang + gap / 2, a1 = ang + frac * 2 * Math.PI - gap / 2;
            ang += frac * 2 * Math.PI;
            if (a1 <= a0) return null;
            return <path key={p.label} d={arc(cx, cy, r, a0, a1)} fill="none" stroke={p.color} strokeWidth={stroke} strokeLinecap="round"><title>{p.label}: {p.n}</title></path>;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-display text-2xl font-bold text-ink-900 tabular-nums leading-none">{centerValue ?? total}</div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-400 mt-1">{centerLabel ?? "total"}</div>
          </div>
        </div>
      </div>
      <div className="grid gap-2 min-w-0">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="text-slate-600 truncate">{p.label}</span>
            <span className="ml-auto pl-3 font-semibold text-ink-900 tabular-nums">{p.n}</span>
            <span className="text-slate-400 tabular-nums w-9 text-right">{total ? Math.round((p.n / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
