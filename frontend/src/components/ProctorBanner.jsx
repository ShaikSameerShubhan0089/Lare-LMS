import { useEffect, useRef, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { attachProctoring, SIGNAL_LABEL } from "../lib/proctor.js";

// A lightweight integrity banner for any surface where students answer questions
// (drills, practice worlds, lesson checks, coding practice). It *flags*
// tab-switches, copy/paste and right-clicks so monitoring is visible — but, on
// learning surfaces, it doesn't block or auto-submit (that's exam-only).
export default function ProctorBanner({ active = true, block = false }) {
  const [flags, setFlags] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef([]);

  useEffect(() => {
    if (!active) return undefined;
    const detach = attachProctoring({
      block,
      onViolation: (type) => {
        ref.current = [...ref.current, { type, at: Date.now() }].slice(-20);
        setFlags(ref.current);
      },
    });
    return detach;
  }, [active, block]);

  if (!active) return null;
  const count = flags.length;
  const last = flags[flags.length - 1];

  return (
    <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${
      count === 0 ? "border-slate-200 bg-slate-50 text-slate-500"
                  : "border-amber-200 bg-amber-500/10 text-amber-800"}`}>
      <div className="flex items-center gap-2">
        {count === 0 ? <ShieldCheck size={16} className="text-teal-500" />
                     : <ShieldAlert size={16} className="text-amber-500" />}
        <span className="font-medium">
          {count === 0 ? "Integrity monitoring on" : `${count} integrity flag${count > 1 ? "s" : ""}`}
        </span>
        {last && <span className="text-xs">· last: {SIGNAL_LABEL[last.type] || last.type}</span>}
        {count > 0 && (
          <button onClick={() => setOpen((o) => !o)} className="ml-auto text-xs underline">
            {open ? "hide" : "view flags"}
          </button>
        )}
      </div>
      {open && count > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {flags.slice().reverse().map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-amber-500" />
              {SIGNAL_LABEL[f.type] || f.type}
              <span className="text-amber-600/60">{new Date(f.at).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
