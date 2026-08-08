import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Wand2, RefreshCw, ChevronRight, Brain } from "lucide-react";
import { Card, Badge, Button, Input } from "../components/ui/primitives.jsx";
import { PageHeader, Loading } from "../components/ui/states.jsx";
import LessonBlocks from "../components/LessonBlocks.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

// New lessons come as `blocks`. Older lessons (pre-block-format) have separate
// fields — convert them so they still render instead of showing an empty state.
function toBlocks(lesson) {
  if (Array.isArray(lesson?.blocks) && lesson.blocks.length) return lesson.blocks;
  if (!lesson || (!lesson.intro && !lesson.key_points && !lesson.practice)) return [];
  const b = [];
  if (lesson.intro) b.push({ type: "text", id: "i", html: lesson.intro });
  if (lesson.key_points?.length)
    b.push({ type: "text", id: "k", html: "### Key points\n" + lesson.key_points.map((k) => `- ${k}`).join("\n") });
  if (lesson.worked_example)
    b.push({ type: "text", id: "w", html: "### Worked example\n**" + (lesson.worked_example.problem || "") + "**\n" + (lesson.worked_example.solution_steps || []).map((s, i) => `${i + 1}. ${s}`).join("\n") });
  if (lesson.misconception) b.push({ type: "callout", id: "m", tone: "warning", text: lesson.misconception });
  if (lesson.practice?.length)
    b.push({ type: "text", id: "p", html: "### Practice\n" + lesson.practice.map((p) => `- ${p.q || p}`).join("\n") });
  return b;
}

// LARE Learn — Generative Learning Fabric. Type any concept and the AI writes a
// detailed, spoon-fed lesson: text (with tables/examples), runnable code,
// callouts and checks — the same rich block format as curriculum lessons.
export default function Lessons() {
  const { user } = useAuth();
  const id = user?.id;
  const [topics, setTopics] = useState([]);
  const [library, setLibrary] = useState([]);
  const [input, setInput] = useState("");
  const [current, setCurrent] = useState(null); // {topic, lesson:{title,blocks}, generated}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const [twin, lib] = await Promise.all([
        api.skillTwin(id).catch(() => null),
        api.listLessons(id).catch(() => []),
      ]);
      setTopics((twin?.focus_areas || []).map((f) => f.name));
      setLibrary(Array.isArray(lib) ? lib : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { if (id) refresh(); /* eslint-disable-next-line */ }, [id]);

  async function generate(topic, force = false) {
    if (!topic?.trim()) return;
    setBusy(true); setErr("");
    try { setCurrent(await api.generateLesson(id, topic.trim(), force)); refresh(); }
    catch { setErr("Couldn't generate that lesson — try again in a moment."); }
    finally { setBusy(false); }
  }

  if (loading) return <Loading />;

  const lesson = current?.lesson || {};
  const blocks = toBlocks(lesson);

  return (
    <div>
      <PageHeader
        title="Micro-Lessons"
        subtitle="Name a concept and get a complete, spoon-fed lesson right now — explanations with tables and examples, runnable code, and checks."
        right={<Button as={Link} to="/lms/skill-map" variant="secondary"><Brain size={16} /> Skill Map</Button>}
      />

      <Card className="p-6 mb-6">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[220px] flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. SQL joins, Dynamic Programming, HTML tables…"
              onKeyDown={(e) => e.key === "Enter" && generate(input)} />
            <Button onClick={() => generate(input)} disabled={busy || !input.trim()}>
              {busy ? "Writing…" : <><Wand2 size={16} /> Generate</>}
            </Button>
          </div>
        </div>
        {topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-slate-400">Your focus areas:</span>
            {topics.map((t) => (
              <button key={t} onClick={() => { setInput(t); generate(t); }}
                className="rounded-full bg-amber-500/10 text-amber-700 px-2.5 py-1 text-xs font-medium hover:bg-amber-500/20">{t}</button>
            ))}
          </div>
        )}
        {err && <p className="mt-3 text-sm text-amber-600">{err}</p>}
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {blocks.length === 0 ? (
            <Card className="p-10 text-center">
              <span className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-brand-500/10 text-brand-600"><BookOpen size={28} /></span>
              <h2 className="mt-4 font-display text-xl font-bold text-ink-900">Pick a concept to learn</h2>
              <p className="mt-1 text-slate-500 max-w-md mx-auto">Type any topic above or tap a focus area — your full lesson appears here in seconds.</p>
            </Card>
          ) : (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl font-bold text-ink-900">{lesson.title}</h2>
                <div className="flex items-center gap-2">
                  <Badge tone={current.generated ? "brand" : "slate"}>{current.generated ? "AI-generated" : "Smart lesson"}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => generate(current.topic, true)} disabled={busy}><RefreshCw size={14} /> Regenerate</Button>
                </div>
              </div>
              <LessonBlocks blocks={blocks} />
            </div>
          )}
        </div>

        <div>
          <Card className="p-5">
            <h3 className="font-display font-semibold text-ink-900 mb-3 flex items-center gap-2"><BookOpen size={17} className="text-brand-500" /> Your lessons</h3>
            {library.length === 0 ? (
              <p className="text-sm text-slate-400">Lessons you generate are saved here to revisit anytime.</p>
            ) : (
              <div className="space-y-1.5">
                {library.map((l) => (
                  <button key={l.topic} onClick={() => generate(l.topic)}
                    className="w-full text-left rounded-md p-2.5 hover:bg-slate-50 flex items-center justify-between gap-2">
                    <span className="text-sm text-ink-900 truncate">{l.title}</span>
                    <ChevronRight size={15} className="text-slate-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
