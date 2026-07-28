import { useState } from "react";
import { Play, Send, CheckCircle2, XCircle, Terminal, Code2 } from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader } from "../components/ui/states.jsx";
import { api } from "../lib/api.js";
import { demoProblem, demoStarter } from "../lib/demo.js";

// Browser coding IDE. Wired to the live Coding Assessment service
// (api.codingOpen/Run/Submit); falls back to a client-side sample check when
// the backend isn't running so the flow stays clickable.
export default function CodingIDE() {
  const problem = demoProblem;
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState(demoStarter.python);
  const [sessionId, setSessionId] = useState(null);
  const [output, setOutput] = useState(null); // {cases, passed, total} | {score,...}
  const [busy, setBusy] = useState(false);

  function switchLang(l) {
    setLang(l);
    setCode(demoStarter[l] || "");
  }

  async function ensureSession() {
    if (sessionId) return sessionId;
    try {
      const s = await api.codingOpen(problem.id);
      setSessionId(s.session_id);
      return s.session_id;
    } catch {
      return null; // demo mode
    }
  }

  // Demo evaluator: only for the sum-two-ints sample so Run feels real offline.
  function demoRun(cases) {
    return cases.map((c) => {
      let stdout = "";
      try {
        const [a, b] = c.input.split(/\s+/).map(Number);
        stdout = String(a + b);
      } catch {
        stdout = "";
      }
      const passed = stdout.trim() === c.expected.trim() && /(\+|sum|a\s*\+\s*b)/i.test(code);
      return { input: c.input, expected: c.expected, stdout, passed, timed_out: false };
    });
  }

  async function run() {
    setBusy(true);
    setOutput(null);
    const sid = await ensureSession();
    try {
      if (sid) {
        const res = await api.codingRun(sid, code);
        setOutput({ kind: "run", ...res });
      } else {
        const cases = demoRun(problem.sample_cases);
        setOutput({ kind: "run", cases, passed: cases.filter((c) => c.passed).length, total: cases.length, demo: true });
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setOutput(null);
    const sid = await ensureSession();
    try {
      if (sid) {
        const res = await api.codingSubmit(sid, code);
        setOutput({ kind: "submit", ...res });
        setSessionId(null);
      } else {
        const cases = demoRun(problem.sample_cases);
        const passed = cases.filter((c) => c.passed).length;
        setOutput({ kind: "submit", score: Math.round((passed / cases.length) * 100), cases_passed: passed, total_cases: cases.length, demo: true });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Practice — Coding" subtitle="Solve, run against samples, submit against hidden tests" />
      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        {/* Problem */}
        <Card className="p-6 h-fit">
          <div className="flex items-center justify-between">
            <span className="grid place-items-center h-10 w-10 rounded-md bg-brand-500/10 text-brand-600">
              <Code2 size={20} />
            </span>
            <Badge tone="teal">{problem.time_limit_sec}s limit</Badge>
          </div>
          <h2 className="mt-4 font-display font-semibold text-ink-900">{problem.title}</h2>
          <pre className="mt-3 text-sm text-slate-600 whitespace-pre-wrap font-sans">{problem.statement}</pre>
          <h3 className="mt-5 text-sm font-semibold text-ink-900">Sample cases</h3>
          <div className="mt-2 space-y-2">
            {problem.sample_cases.map((c, i) => (
              <div key={i} className="rounded-md bg-slate-50 p-2.5 font-mono text-xs">
                <span className="text-slate-400">in </span>{c.input}
                <span className="text-slate-400 ml-3">out </span>{c.expected}
              </div>
            ))}
          </div>
        </Card>

        {/* Editor + output */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 h-12 border-b border-slate-100 bg-slate-50">
              <div className="flex gap-1">
                {problem.languages.map((l) => (
                  <button
                    key={l}
                    onClick={() => switchLang(l)}
                    className={`px-3 h-8 rounded-md text-sm font-medium capitalize ${
                      lang === l ? "bg-ink-900 text-white" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={run} disabled={busy}>
                  <Play size={15} /> Run
                </Button>
                <Button size="sm" onClick={submit} disabled={busy}>
                  <Send size={15} /> Submit
                </Button>
              </div>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full h-72 p-4 font-mono text-sm text-slate-100 bg-ink-950 resize-none outline-none"
            />
          </Card>

          {/* Output */}
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900 mb-3">
              <Terminal size={16} /> Output
              {output?.demo && <Badge tone="amber">demo run</Badge>}
            </div>
            {!output && <p className="text-sm text-slate-400">Run your code to see results.</p>}
            {output?.kind === "run" && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  {output.passed}/{output.total} sample cases passed
                </p>
                {output.cases.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md border border-slate-100 p-2.5 text-sm">
                    {c.passed ? (
                      <CheckCircle2 size={16} className="text-teal-500 shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-rose-500 shrink-0" />
                    )}
                    <span className="font-mono text-xs text-slate-500">in {c.input}</span>
                    <span className="font-mono text-xs">→ {c.stdout || "∅"}</span>
                    {!c.passed && <span className="font-mono text-xs text-slate-400">exp {c.expected}</span>}
                  </div>
                ))}
              </div>
            )}
            {output?.kind === "submit" && (
              <div className="flex items-center gap-4">
                <div
                  className={`grid place-items-center h-16 w-16 rounded-2xl font-display font-bold text-xl ${
                    output.score >= 60 ? "bg-teal-500/12 text-teal-600" : "bg-rose-500/10 text-rose-600"
                  }`}
                >
                  {output.score}
                </div>
                <div>
                  <p className="font-medium text-ink-900">
                    {output.cases_passed}/{output.total_cases} hidden cases passed
                  </p>
                  <p className="text-sm text-slate-500">Score: {output.score}/100</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
