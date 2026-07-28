import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, CalendarRange, Compass, Bot, User, Loader2 } from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader } from "../components/ui/states.jsx";
import { api } from "../lib/api.js";
import { demoTutorGreeting } from "../lib/demo.js";

// AI Tutor chat. Talks to the AI Tutor service (which reaches Claude via the
// governed AI Orchestration egress). Degrades to a friendly offline reply.
export default function Tutor() {
  const [messages, setMessages] = useState([{ role: "assistant", content: demoTutorGreeting }]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.tutorChat(msg, sessionId, "");
      setSessionId(res.session_id);
      setMode(res.mode);
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setMode("offline");
      setMessages((m) => [...m, {
        role: "assistant",
        content: "I'm offline right now, but keep practising your weak areas and check your scorecard — I'll have detailed guidance once the AI service is reachable.",
      }]);
    } finally { setBusy(false); }
  }

  async function studyPlan() {
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: "Make me a study plan." }]);
    try {
      const res = await api.studyPlan({ year_no: 2, scorecard: { coding: 80, aptitude: 55 }, weak_areas: ["aptitude"], goal: "TCS NQT", hours: 10 });
      const plan = res.plan;
      const text = typeof plan === "string" ? plan
        : `${plan?.summary || "Here's your plan:"}\n\n` + (plan?.weeks || []).map((w) => `Week ${w.week}: ${w.focus}\n  - ${(w.tasks || []).join("\n  - ")}`).join("\n\n");
      setMode(res.mode);
      setMessages((m) => [...m, { role: "assistant", content: text }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Focus on aptitude this month: 5 questions daily + 2 DSA problems." }]);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader
        title="AI Tutor"
        subtitle="Grounded guidance for your placement journey"
        right={mode && <Badge tone={mode === "live" ? "teal" : "amber"}>{mode === "live" ? "live AI" : mode}</Badge>}
      />
      <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[420px] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <span className={`grid place-items-center h-8 w-8 rounded-full shrink-0 ${m.role === "user" ? "bg-ink-900 text-white" : "bg-brand-500/10 text-brand-600"}`}>
                {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
              </span>
              <div className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-ink-900 text-white" : "bg-slate-100 text-ink-900"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-3">
              <span className="grid place-items-center h-8 w-8 rounded-full bg-brand-500/10 text-brand-600"><Bot size={16} /></span>
              <div className="rounded-lg px-4 py-2.5 bg-slate-100"><Loader2 className="animate-spin text-slate-400" size={16} /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-100 p-3">
          <div className="flex gap-2 mb-2">
            <button onClick={studyPlan} disabled={busy} className="text-xs px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-600 font-medium flex items-center gap-1 hover:bg-amber-500/25">
              <CalendarRange size={13} /> Study plan
            </button>
            <button onClick={() => send("Which specialisation stream fits me?")} disabled={busy} className="text-xs px-3 py-1.5 rounded-full bg-teal-500/12 text-teal-600 font-medium flex items-center gap-1 hover:bg-teal-500/20">
              <Compass size={13} /> Stream advice
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about DSA, aptitude, interviews…"
              className="flex-1 h-11 px-4 rounded-md border border-slate-200 text-ink-900 text-sm"
            />
            <Button type="submit" disabled={busy || !input.trim()}><Send size={16} /></Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
