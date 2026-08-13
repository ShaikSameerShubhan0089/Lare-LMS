import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play, Send, CheckCircle2, XCircle, Terminal, Code2, ArrowLeft, Trophy,
  Brain, Loader2, ShieldCheck, MessageSquareQuote,
} from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../components/ui/states.jsx";
import ProctorBanner from "../components/ProctorBanner.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

// LARE Learn — Coding Practice. Wired to the live coding sandbox via the LMS
// practice API. Every solved problem feeds the learner's Skill Map (Cognitive
// Twin). No demo fallback: this is a real, graded practice surface.

const STARTERS = {
  python: "import sys\n\n# Read input with input()/sys.stdin; print your answer.\n",
  javascript:
    "const lines = require('fs').readFileSync(0, 'utf8').split('\\n');\n// lines[0], lines[1], ... then console.log(answer)\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code\n    return 0;\n}\n",
  java: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // your code\n    }\n}\n",
  c: "#include <stdio.h>\n\nint main() {\n    // your code\n    return 0;\n}\n",
};

const DIFF = {
  easy: "teal",
  medium: "amber",
  hard: "rose",
};

export default function CodingPractice() {
  const { user } = useAuth();
  const [problems, setProblems] = useState(null);
  const [skills, setSkills] = useState(null);
  const [active, setActive] = useState(null); // selected problem card
  const [err, setErr] = useState("");

  async function loadBank() {
    setErr("");
    try {
      const [ps, sk] = await Promise.all([
        api.practiceProblems(),
        user?.id ? api.practiceSkills(user.id).catch(() => null) : Promise.resolve(null),
      ]);
      setProblems(Array.isArray(ps) ? ps : []);
      setSkills(sk);
    } catch {
      setErr("Couldn't load the practice bank. Make sure you're signed in and try again.");
      setProblems([]);
    }
  }

  useEffect(() => {
    loadBank();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Which problems has this learner already solved (best = all cases passed)?
  const solvedSkillMastery = useMemo(() => {
    const m = {};
    (skills?.by_skill || []).forEach((s) => { m[s.name] = s; });
    return m;
  }, [skills]);

  if (problems === null) return <Loading />;

  if (active) {
    return (
      <SolveView
        card={active}
        onBack={() => { setActive(null); loadBank(); }}
      />
    );
  }

  // group by skill
  const bySkill = {};
  problems.forEach((p) => { (bySkill[p.skill] = bySkill[p.skill] || []).push(p); });
  const skillNames = Object.keys(bySkill).sort();

  return (
    <div>
      <PageHeader
        title="Coding Practice"
        subtitle="Solve real problems in the language of your choice. Every solve sharpens your Skill Map."
        right={
          <Button as={Link} to="/lms/skill-map" variant="secondary">
            <Brain size={16} /> My Skill Map
          </Button>
        }
      />

      {err && <Card className="p-4 mb-4 text-sm text-amber-600">{err}</Card>}

      {skills && skills.attempted > 0 && (
        <Card className="p-5 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
          <Stat label="Problems solved" value={`${skills.solved} / ${skills.attempted}`} icon={Trophy} />
          <Stat label="Verified skills" value={`${skills.verified ?? 0}`} icon={ShieldCheck} />
          <Stat label="Coding mastery" value={`${skills.mastery}%`} icon={Code2} />
          <div className="flex flex-wrap gap-2">
            {(skills.by_language || []).map((l) => (
              <span key={l.name} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-ink-900">
                <span className="capitalize">{l.name}</span>
                <span className="tabular-nums text-slate-500">{l.solved}/{l.attempted}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {problems.length === 0 ? (
        <EmptyState
          title="No practice problems yet"
          hint="Your trainer hasn't published practice problems. Check back soon."
        />
      ) : (
        <div className="space-y-8">
          {skillNames.map((skill) => {
            const sm = solvedSkillMastery[skill];
            return (
              <div key={skill}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-display font-semibold text-ink-900">{skill}</h3>
                  {sm && (
                    <Badge tone={DIFF[sm.band === "strong" ? "easy" : sm.band === "developing" ? "medium" : "hard"]}>
                      {sm.mastery}% · {sm.solved}/{sm.attempted} solved
                    </Badge>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bySkill[skill].map((p) => (
                    <ProblemCard key={p.id} p={p} onOpen={() => setActive(p)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProblemCard({ p, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-xl border border-slate-200 bg-surface p-5 hover:border-brand-300 hover:shadow-sm transition group"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-ink-900 group-hover:text-brand-700">{p.title}</span>
        <Badge tone={DIFF[p.difficulty] || "slate"}>{p.difficulty}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(p.languages || []).slice(0, 5).map((l) => (
          <span key={l} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500 capitalize">{l}</span>
        ))}
      </div>
    </button>
  );
}

function SolveView({ card, onBack }) {
  const [session, setSession] = useState(null); // {session_id, problem, language}
  const [lang, setLang] = useState(card.languages?.[0] || "python");
  const [code, setCode] = useState(STARTERS[card.languages?.[0] || "python"] || "");
  const [output, setOutput] = useState(null);
  const [result, setResult] = useState(null); // final submit result (carries sid)
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  // Adversarial viva state
  const [viva, setViva] = useState(null); // {viva_id, question}
  const [vivaAnswer, setVivaAnswer] = useState("");
  const [vivaResult, setVivaResult] = useState(null);
  const [vivaBusy, setVivaBusy] = useState("");

  // Open a fresh practice session for this problem.
  async function ensureSession(forLang) {
    if (session && session.language === forLang) return session;
    const s = await api.practiceOpen(card.id, forLang);
    setSession(s);
    return s;
  }

  useEffect(() => {
    (async () => {
      try { await ensureSession(lang); }
      catch { setErr("Couldn't start this problem. Please try again."); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchLang(l) {
    setLang(l);
    setCode(STARTERS[l] || "");
    setOutput(null);
    setResult(null);
    // A new session is opened lazily on next Run/Submit for the new language.
    setSession(null);
  }

  async function run() {
    setBusy("run"); setErr(""); setOutput(null);
    try {
      const s = await ensureSession(lang);
      const res = await api.practiceRun(s.session_id, code);
      setOutput({ kind: "run", ...res });
    } catch {
      setErr("Run failed — check your code compiles and try again.");
    } finally { setBusy(""); }
  }

  async function submit() {
    setBusy("submit"); setErr(""); setOutput(null); setViva(null); setVivaResult(null);
    try {
      const s = await ensureSession(lang);
      const res = await api.practiceSubmit(s.session_id, code);
      setResult({ ...res, sid: s.session_id });
      // A submitted session is closed; force a new one for any further attempt.
      setSession(null);
    } catch {
      setErr("Submit failed — please try again.");
    } finally { setBusy(""); }
  }

  async function startViva() {
    setVivaBusy("start");
    try {
      const res = await api.vivaStart(result.sid);
      setViva(res);
    } catch {
      setErr("Couldn't start the viva — please try again.");
    } finally { setVivaBusy(""); }
  }

  async function gradeViva() {
    if (!vivaAnswer.trim()) return;
    setVivaBusy("grade");
    try {
      const res = await api.vivaGrade(viva.viva_id, vivaAnswer);
      setVivaResult(res);
    } catch {
      setErr("Couldn't grade your explanation — please try again.");
    } finally { setVivaBusy(""); }
  }

  const problem = session?.problem || card;
  const samples = problem.sample_cases || [];
  const solved = result && result.total_cases > 0 && result.cases_passed >= result.total_cases;

  return (
    <div>
      <PageHeader
        title={card.title}
        subtitle={`${card.skill} · ${card.difficulty}`}
        right={<Button variant="secondary" onClick={onBack}><ArrowLeft size={16} /> Back to bank</Button>}
      />

      <ProctorBanner active />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Statement + samples */}
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="font-display font-semibold text-ink-900 mb-2 flex items-center gap-2">
              <Code2 size={18} className="text-brand-500" /> Problem
            </h3>
            <p className="text-sm text-ink-900 whitespace-pre-wrap leading-relaxed">
              {problem.statement}
            </p>
          </Card>
          {samples.length > 0 && (
            <Card className="p-6">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Sample cases</h4>
              <div className="space-y-3">
                {samples.map((c, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Input</p>
                      <pre className="rounded bg-slate-900 text-slate-100 p-2.5 overflow-x-auto text-xs">{c.input}</pre>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Expected</p>
                      <pre className="rounded bg-slate-900 text-teal-200 p-2.5 overflow-x-auto text-xs">{c.expected}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Editor + run/submit */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-wrap gap-1.5">
                {(card.languages || ["python"]).map((l) => (
                  <button
                    key={l}
                    onClick={() => switchLang(l)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                      l === lang ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-400 flex items-center gap-1"><Terminal size={13} /> stdin → stdout</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={16}
              className="w-full rounded-lg bg-slate-900 text-slate-100 font-mono text-sm p-4 outline-none focus:ring-2 focus:ring-brand-400 resize-y"
            />
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={run} disabled={!!busy}>
                {busy === "run" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run samples
              </Button>
              <Button variant="secondary" onClick={submit} disabled={!!busy}>
                {busy === "submit" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit
              </Button>
            </div>
            {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
          </Card>

          {/* Run output */}
          {output?.kind === "run" && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-ink-900">Sample results</h4>
                <Badge tone={output.passed === output.total ? "teal" : "amber"}>
                  {output.passed}/{output.total} passed
                </Badge>
              </div>
              {output.compile_failed && (
                <pre className="rounded bg-rose-50 text-rose-700 p-3 text-xs overflow-x-auto mb-3 whitespace-pre-wrap">{output.cases?.[0]?.stderr || "Compilation failed."}</pre>
              )}
              <div className="space-y-2">
                {(output.cases || []).map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {c.passed ? <CheckCircle2 size={16} className="text-teal-500 mt-0.5 shrink-0" />
                              : <XCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <span className="text-slate-500">in:</span> <code className="text-ink-900">{c.input}</code>
                      {!c.passed && (
                        <span className="text-slate-500"> · got <code className="text-rose-600">{c.stdout || "(nothing)"}</code></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Final submit result */}
          {result && (
            <Card className={`p-6 text-center ${solved ? "bg-teal-500/5 border-teal-200" : "bg-amber-500/5 border-amber-200"}`}>
              <span className={`mx-auto grid place-items-center h-12 w-12 rounded-full ${solved ? "bg-teal-500/15 text-teal-600" : "bg-amber-500/15 text-amber-600"}`}>
                {solved ? <Trophy size={24} /> : <CheckCircle2 size={24} />}
              </span>
              <p className="mt-3 font-display text-lg font-bold text-ink-900">
                {solved ? "Solved! 🎉" : "Partial — keep going"}
              </p>
              <p className="text-sm text-slate-500">
                {result.cases_passed}/{result.total_cases} hidden tests passed · score {result.score}
              </p>
              <p className="mt-2 text-xs text-slate-400">Your Skill Map has been updated.</p>

              {/* Adversarial viva — only for solved problems, to verify it wasn't faked */}
              {solved && (
                <div className="mt-5 border-t border-teal-200 pt-5 text-left">
                  {!viva && !vivaResult && (
                    <div className="text-center">
                      <p className="text-sm text-ink-900 font-medium flex items-center justify-center gap-1.5">
                        <ShieldCheck size={16} className="text-brand-500" /> Verify your skill
                      </p>
                      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                        Passing tests is one thing — explaining <em>why</em> your solution works proves you really own it. Take a 1-question viva to earn a <b>Verified</b> mark on your Skill Map.
                      </p>
                      <Button className="mt-3" onClick={startViva} disabled={vivaBusy === "start"}>
                        {vivaBusy === "start" ? <Loader2 size={15} className="animate-spin" /> : <MessageSquareQuote size={15} />} Start viva
                      </Button>
                    </div>
                  )}

                  {viva && !vivaResult && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1.5 flex items-center gap-1.5">
                        <MessageSquareQuote size={13} /> Examiner's question
                      </p>
                      <p className="text-sm text-ink-900 mb-3">{viva.question}</p>
                      <textarea
                        value={vivaAnswer}
                        onChange={(e) => setVivaAnswer(e.target.value)}
                        rows={4}
                        placeholder="Explain your approach, why it's correct, and its time complexity…"
                        className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-brand-400 resize-y"
                      />
                      <Button className="mt-2" onClick={gradeViva} disabled={vivaBusy === "grade" || !vivaAnswer.trim()}>
                        {vivaBusy === "grade" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Submit explanation
                      </Button>
                    </div>
                  )}

                  {vivaResult && (
                    <div className={`rounded-lg p-4 ${vivaResult.passed ? "bg-teal-500/10" : "bg-amber-500/10"}`}>
                      <p className={`text-sm font-semibold flex items-center gap-1.5 ${vivaResult.passed ? "text-teal-700" : "text-amber-700"}`}>
                        {vivaResult.passed ? <><ShieldCheck size={16} /> Verified ✓ — you clearly understand this</>
                                           : <><Brain size={16} /> Not verified yet ({vivaResult.score}/100)</>}
                      </p>
                      <p className="mt-1.5 text-sm text-ink-900">{vivaResult.verdict}</p>
                      {!vivaResult.passed && (
                        <Button variant="secondary" className="mt-3" onClick={() => { setViva(null); setVivaResult(null); setVivaAnswer(""); }}>
                          Try explaining again
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid place-items-center h-9 w-9 rounded-lg bg-brand-500/10 text-brand-600"><Icon size={18} /></span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-display text-lg font-bold text-ink-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}
