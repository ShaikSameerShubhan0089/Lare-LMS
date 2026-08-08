import { useState } from "react";
import {
  Play, Loader2, Lightbulb, Info, AlertTriangle, CheckCircle2, XCircle, HelpCircle,
} from "lucide-react";
import { Card, Button } from "./ui/primitives.jsx";
import { api } from "../lib/api.js";
import { renderMarkdown } from "../lib/markdown.js";
import { useAuth } from "../lib/auth.jsx";

// Shared renderer for a LARE "living lesson" — used by the curriculum lesson
// viewer AND AI Micro-Lessons. `grade` is supplied by the parent so checks can
// be graded on the server (curriculum) or on the client (personal lessons).
export default function LessonBlocks({ blocks, grade, onCheckAnswered }) {
  const list = Array.isArray(blocks) ? blocks : [];
  if (list.length === 0) return null;
  return (
    <div className="space-y-4">
      {list.map((b, i) => (
        <Block key={b.id || i} b={b} grade={grade} onCheckAnswered={onCheckAnswered} />
      ))}
    </div>
  );
}

function Block({ b, grade, onCheckAnswered }) {
  if (b.type === "text")
    return <div className="lb-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(b.html || b.text || "") }} />;
  if (b.type === "callout") return <Callout b={b} />;
  if (b.type === "code") return <CodeBlock b={b} />;
  if (b.type === "check") return <Check b={b} grade={grade} onCheckAnswered={onCheckAnswered} />;
  return null;
}

function Callout({ b }) {
  const map = {
    tip: { icon: Lightbulb, cls: "bg-teal-500/10 text-teal-800", ic: "text-teal-500", label: "Tip" },
    info: { icon: Info, cls: "bg-brand-500/10 text-brand-800", ic: "text-brand-500", label: "Key idea" },
    warning: { icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-800", ic: "text-amber-500", label: "Common trap" },
  }[b.tone] || { icon: Info, cls: "bg-slate-100 text-slate-700", ic: "text-slate-400", label: "Note" };
  const Icon = map.icon;
  return (
    <div className={`rounded-lg p-4 flex items-start gap-2.5 text-sm ${map.cls}`}>
      <Icon size={17} className={`shrink-0 mt-0.5 ${map.ic}`} />
      <span><b>{map.label}:</b> {b.text}</span>
    </div>
  );
}

// Languages the coding sandbox can actually execute.
const RUNNABLE = ["python", "javascript", "js", "cpp", "c++", "c", "java"];

function CodeBlock({ b }) {
  const [code, setCode] = useState(b.code || "");
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const runnable = RUNNABLE.includes((b.language || "").toLowerCase());
  async function run() {
    setBusy(true); setOut(null);
    try {
      const res = await api.runCode(b.language, code, [{ input: "", expected: "" }]);
      const c = (res.cases && res.cases[0]) || {};
      setOut({ stdout: c.stdout, stderr: c.stderr || res.compile_log, failed: res.compile_failed });
    } catch { setOut({ stderr: "Couldn't run — the sandbox may be offline." }); }
    finally { setBusy(false); }
  }
  return (
    <div className="rounded-lg overflow-hidden border border-slate-800">
      <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5">
        <span className="text-xs text-slate-300 capitalize">{b.language}</span>
        {runnable && (
          <Button size="sm" onClick={run} disabled={busy}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Run
          </Button>
        )}
      </div>
      {runnable ? (
        <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false}
          rows={Math.min(20, Math.max(3, code.split("\n").length))}
          className="w-full bg-slate-900 text-slate-100 font-mono text-sm p-3 outline-none resize-y" />
      ) : (
        // Non-runnable (e.g. SQL): show as a clean read-only snippet.
        <pre className="bg-slate-900 text-slate-100 font-mono text-sm p-3 overflow-x-auto whitespace-pre">{code}</pre>
      )}
      {b.note && <p className="bg-slate-800 text-slate-400 text-xs px-3 py-1.5">{b.note}</p>}
      {out && (
        <div className="bg-slate-950 px-3 py-2.5 text-xs font-mono">
          {out.failed || out.stderr
            ? <pre className="text-rose-300 whitespace-pre-wrap">{out.stderr || "Error"}</pre>
            : <pre className="text-emerald-200 whitespace-pre-wrap">{out.stdout || "(no output)"}</pre>}
        </div>
      )}
    </div>
  );
}

function Check({ b, grade, onCheckAnswered }) {
  const { user } = useAuth();
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function answer(optId) {
    if (chosen || busy) return;
    setChosen(optId); setBusy(true);
    try {
      // parent-supplied grader (server for curriculum, client for personal)
      const res = grade
        ? await grade(b.id, optId)
        : { correct: optId === b.answer, answer: b.answer, explain: b.explain, skill: b.skill };
      setResult(res);
      if (user?.id && res.skill) api.recordActivity(user.id, res.skill, res.correct, res.correct ? 100 : 0).catch(() => {});
      onCheckAnswered && onCheckAnswered(res.correct);
    } catch { setResult({ explain: "Couldn't grade — try again." }); setChosen(null); }
    finally { setBusy(false); }
  }

  return (
    <Card className="p-5 border-brand-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-2 flex items-center gap-1.5"><HelpCircle size={13} /> Quick check</p>
      <p className="font-medium text-ink-900 mb-3">{b.question}</p>
      <div className="space-y-2">
        {(b.options || []).map((o) => {
          const isChosen = chosen === o.id;
          const isRight = result && o.id === result.answer;
          const isWrongPick = result && isChosen && !result.correct;
          return (
            <button key={o.id} disabled={!!chosen} onClick={() => answer(o.id)}
              className={`w-full text-left rounded-lg border p-3 flex items-center gap-3 transition ${
                isRight ? "border-teal-300 bg-teal-500/10"
                : isWrongPick ? "border-rose-300 bg-rose-500/10"
                : isChosen ? "border-brand-300 bg-brand-500/5"
                : "border-slate-200 hover:border-brand-300"} ${chosen ? "cursor-default" : ""}`}>
              <span className="grid place-items-center h-6 w-6 rounded-full border border-slate-300 text-xs font-semibold text-slate-500 shrink-0 uppercase">{o.id}</span>
              <span className="text-sm text-ink-900 flex-1">{o.text}</span>
              {isRight && <CheckCircle2 size={17} className="text-teal-500" />}
              {isWrongPick && <XCircle size={17} className="text-rose-500" />}
            </button>
          );
        })}
      </div>
      {result && (
        <p className={`mt-3 text-sm ${result.correct ? "text-teal-700" : "text-amber-700"}`}>
          {result.correct ? "Correct! " : "Not quite. "}{result.explain}
        </p>
      )}
    </Card>
  );
}
