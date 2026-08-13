import { useEffect, useState } from "react";
import {
  X, Plus, Type, Code2, Lightbulb, HelpCircle, ArrowUp, ArrowDown, Trash2,
  Save, CheckCircle2, Wand2, Eye, Pencil,
} from "lucide-react";
import { Card, Button, Input } from "../../components/ui/primitives.jsx";
import LessonBlocks from "../../components/LessonBlocks.jsx";
import { api } from "../../lib/api.js";

// A LARE "living lesson" editor: compose real teaching material as interactive
// blocks — rich text, runnable code, callouts, and inline checks that feed the
// learner's twin. Not a file/URL uploader.
const LANGS = ["python", "javascript", "cpp", "java", "c"];

const NEW = {
  text: () => ({ type: "text", html: "" }),
  code: () => ({ type: "code", language: "python", code: "", note: "" }),
  callout: () => ({ type: "callout", tone: "tip", text: "" }),
  check: () => ({ type: "check", skill: "", question: "",
    options: [{ id: "a", text: "" }, { id: "b", text: "" }], answer: "a", explain: "" }),
};

export default function LessonEditor({ lessonId, title, onClose, onSaved }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");
  const [aiTopic, setAiTopic] = useState(title || "");
  const [aiBusy, setAiBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  async function aiGenerate(replace) {
    if (!aiTopic.trim()) return;
    setAiBusy(true); setFlash("");
    try {
      const res = await api.authorBlocks(aiTopic.trim());
      const gen = res.blocks || [];
      setBlocks((b) => (replace ? gen : [...b, ...gen]));
      setFlash(`AI added ${gen.length} block(s)${res.generated ? "" : " (offline template)"} — review and edit, then Save.`);
    } catch { setFlash("Couldn't generate — try again."); }
    finally { setAiBusy(false); setTimeout(() => setFlash(""), 4000); }
  }

  useEffect(() => {
    (async () => {
      try { const l = await api.getLesson(lessonId); setBlocks(l.content || []); }
      catch { setBlocks([]); }
      finally { setLoading(false); }
    })();
  }, [lessonId]);

  const add = (t) => setBlocks((b) => [...b, NEW[t]()]);
  const upd = (i, patch) => setBlocks((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const del = (i) => setBlocks((b) => b.filter((_, j) => j !== i));
  const move = (i, d) => setBlocks((b) => {
    const j = i + d; if (j < 0 || j >= b.length) return b;
    const c = [...b]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  async function save() {
    setSaving(true);
    try {
      const res = await api.setLessonContent(lessonId, blocks);
      setBlocks(res.content || blocks);
      setFlash("Material saved.");
      onSaved && onSaved(res.content?.length ?? blocks.length);
      setTimeout(() => setFlash(""), 2500);
    } catch { setFlash("Couldn't save — check you're signed in as staff."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-invert-900/40 flex items-start justify-center overflow-y-auto p-4">
      <Card className="w-full max-w-3xl my-8 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-display font-semibold text-ink-900">Lesson material</h2>
            <p className="text-xs text-slate-400">{title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-ink-900"><X size={20} /></button>
        </div>

        {/* AI author bar */}
        <div className="px-6 py-3 bg-brand-500/5 border-b border-brand-100 flex flex-wrap items-center gap-2">
          <Wand2 size={16} className="text-brand-500" />
          <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Topic to teach — e.g. HTML tables"
            className="h-9 flex-1 min-w-[180px]" />
          <Button size="sm" onClick={() => aiGenerate(true)} disabled={aiBusy || !aiTopic.trim()}>
            {aiBusy ? "Writing…" : <><Wand2 size={14} /> AI write lesson</>}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => aiGenerate(false)} disabled={aiBusy || !aiTopic.trim()}>
            <Plus size={14} /> Append
          </Button>
          {blocks.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
              {preview ? <><Pencil size={14} /> Edit</> : <><Eye size={14} /> Preview</>}
            </Button>
          )}
        </div>

        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto space-y-3">
          {loading ? <p className="text-sm text-slate-400">Loading…</p> : preview ? (
            <div className="max-w-2xl mx-auto"><LessonBlocks blocks={blocks} /></div>
          ) : (
            <>
              {blocks.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">
                  Empty lesson. Use <b>AI write lesson</b> above, or add blocks manually below.
                </p>
              )}
              {blocks.map((b, i) => (
                <BlockEditor key={i} b={b} i={i} total={blocks.length}
                  onChange={(patch) => upd(i, patch)} onDelete={() => del(i)} onMove={(d) => move(i, d)} />
              ))}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 mr-1">Add:</span>
          <Button size="sm" variant="secondary" onClick={() => add("text")}><Type size={14} /> Text</Button>
          <Button size="sm" variant="secondary" onClick={() => add("code")}><Code2 size={14} /> Code</Button>
          <Button size="sm" variant="secondary" onClick={() => add("callout")}><Lightbulb size={14} /> Callout</Button>
          <Button size="sm" variant="secondary" onClick={() => add("check")}><HelpCircle size={14} /> Check</Button>
          <div className="ml-auto flex items-center gap-2">
            {flash && <span className="text-sm text-teal-600">{flash}</span>}
            <Button onClick={save} disabled={saving}><Save size={15} /> {saving ? "Saving…" : "Save material"}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BlockEditor({ b, i, total, onChange, onDelete, onMove }) {
  const label = { text: "Text", code: "Code", callout: "Callout", check: "Check" }[b.type];
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{i + 1}. {label}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onMove(-1)} disabled={i === 0} className="text-slate-300 hover:text-ink-900 disabled:opacity-30"><ArrowUp size={15} /></button>
          <button onClick={() => onMove(1)} disabled={i === total - 1} className="text-slate-300 hover:text-ink-900 disabled:opacity-30"><ArrowDown size={15} /></button>
          <button onClick={onDelete} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>
        </div>
      </div>

      {b.type === "text" && (
        <textarea value={b.html} onChange={(e) => onChange({ html: e.target.value })} rows={4}
          placeholder="Explain the concept in your own words…"
          className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 resize-y" />
      )}

      {b.type === "code" && (
        <div className="space-y-2">
          <select value={b.language} onChange={(e) => onChange({ language: e.target.value })}
            className="h-8 rounded-md border border-slate-200 text-sm px-2 text-slate-600 capitalize">
            {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <textarea value={b.code} onChange={(e) => onChange({ code: e.target.value })} rows={6} spellCheck={false}
            placeholder="Example code — students can run and tweak it live."
            className="w-full rounded-md bg-slate-900 text-slate-100 font-mono text-sm p-3 outline-none resize-y" />
          <Input value={b.note || ""} onChange={(e) => onChange({ note: e.target.value })} placeholder="Optional note shown under the code" />
        </div>
      )}

      {b.type === "callout" && (
        <div className="space-y-2">
          <select value={b.tone} onChange={(e) => onChange({ tone: e.target.value })}
            className="h-8 rounded-md border border-slate-200 text-sm px-2 text-slate-600">
            <option value="tip">Tip</option>
            <option value="info">Key idea</option>
            <option value="warning">Common trap</option>
          </select>
          <textarea value={b.text} onChange={(e) => onChange({ text: e.target.value })} rows={2}
            className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 resize-y" />
        </div>
      )}

      {b.type === "check" && (
        <div className="space-y-2">
          <Input value={b.question} onChange={(e) => onChange({ question: e.target.value })} placeholder="Check question" />
          <div className="space-y-1.5">
            {(b.options || []).map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input type="radio" name={`ans-${i}`} checked={b.answer === o.id} onChange={() => onChange({ answer: o.id })} className="accent-teal-500" title="Correct answer" />
                <Input value={o.text} onChange={(e) => onChange({ options: b.options.map((x, k) => (k === oi ? { ...x, text: e.target.value } : x)) })} placeholder={`Option ${o.id.toUpperCase()}`} className="h-9" />
                {b.options.length > 2 && (
                  <button onClick={() => onChange({ options: b.options.filter((_, k) => k !== oi) })} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
            {b.options.length < 4 && (
              <button onClick={() => onChange({ options: [...b.options, { id: "abcd"[b.options.length], text: "" }] })}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1"><Plus size={12} /> Option</button>
            )}
          </div>
          <Input value={b.skill || ""} onChange={(e) => onChange({ skill: e.target.value })} placeholder="Skill this check trains (e.g. HTML Tables) — updates the twin" />
          <Input value={b.explain || ""} onChange={(e) => onChange({ explain: e.target.value })} placeholder="Explanation shown after answering" />
          <p className="text-[11px] text-slate-400 flex items-center gap-1"><CheckCircle2 size={11} /> Select the radio next to the correct option.</p>
        </div>
      )}
    </div>
  );
}
