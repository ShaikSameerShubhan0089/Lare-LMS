import { useEffect, useState } from "react";
import { BookOpen, Plus, Layers, FileText, Rocket, CheckCircle2, ChevronRight, Pencil } from "lucide-react";
import { Card, Badge, Button, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading } from "../../components/ui/states.jsx";
import { api } from "../../lib/api.js";
import LessonEditor from "./LessonEditor.jsx";

// Curriculum designer: build curriculum -> years -> modules -> lessons, then
// publish (which makes the structure immutable per the SRS).
export default function CurriculumStudio({ embedded = false }) {
  const [curriculum, setCurriculum] = useState(null);
  const [name, setName] = useState("LARE 4-Year Programme");
  const [status, setStatus] = useState("draft");
  const [years, setYears] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(null); // {id, title} lesson being authored

  // Load an existing curriculum from the backend so its real lessons (with real
  // ids) are editable — no fragile in-session placeholders.
  useEffect(() => {
    (async () => {
      try {
        const list = await api.curricula();
        if (Array.isArray(list) && list.length) {
          const c = list[0];
          const tree = await api.curriculumTree(c.id);
          setCurriculum({ id: c.id, name: c.name });
          setStatus(c.status || tree.status || "draft");
          setYears((tree.years || []).map((y) => ({
            id: y.id, year_no: y.year_no, theme: y.theme,
            modules: (y.modules || []).map((m) => ({
              id: m.id, title: m.title,
              lessons: (m.lessons || []).map((l) => ({ id: l.id, title: l.title, blocks: l.blocks || 0 })),
            })),
          })));
        }
      } catch { /* none yet — show the create card */ }
      finally { setLoading(false); }
    })();
  }, []);

  function flashErr(e, fallbackMsg) {
    setErr(e?.message || fallbackMsg);
    setTimeout(() => setErr(null), 4000);
  }

  async function create() {
    setBusy(true); setErr(null);
    try {
      const c = await api.createCurriculum({ name });
      setCurriculum(c); setYears([]); setStatus("draft");
    } catch (e) {
      flashErr(e, "Couldn't create the curriculum — is the backend running?");
    } finally { setBusy(false); }
  }

  async function addYear() {
    const year_no = years.length + 1;
    try {
      const y = await api.addYear(curriculum.id, { year_no, theme: `Year ${year_no}` });
      setYears([...years, { ...y, year_no, modules: [] }]);
    } catch (e) { flashErr(e, "Couldn't add the year."); }
  }

  async function addModule(yi) {
    const y = years[yi];
    const title = prompt("Module title?");
    if (!title) return;
    try {
      const m = await api.addModule(y.id, { title, branch_scope: "all" });
      const copy = [...years];
      copy[yi] = { ...y, modules: [...y.modules, { ...m, title, lessons: [] }] };
      setYears(copy);
    } catch (e) { flashErr(e, "Couldn't add the module."); }
  }

  async function addLesson(yi, mi) {
    const m = years[yi].modules[mi];
    const title = prompt("Lesson title?");
    if (!title) return;
    try {
      const l = await api.addLesson(m.id, { title });
      const copy = [...years];
      const mods = [...copy[yi].modules];
      mods[mi] = { ...m, lessons: [...m.lessons, { ...l, title, blocks: l.blocks || 0 }] };
      copy[yi] = { ...copy[yi], modules: mods };
      setYears(copy);
    } catch (e) { flashErr(e, "Couldn't add the lesson."); }
  }

  // Reflect the saved block count on the edited lesson.
  function setLessonBlocks(lessonId, count) {
    setYears((ys) => ys.map((y) => ({
      ...y,
      modules: (y.modules || []).map((m) => ({
        ...m,
        lessons: (m.lessons || []).map((l) => (l.id === lessonId ? { ...l, blocks: count } : l)),
      })),
    })));
  }

  async function publish() {
    setBusy(true); setErr(null);
    try {
      await api.publishCurriculum(curriculum.id);
      setStatus("published");
      setMsg("Curriculum published — structure is now immutable.");
    } catch (e) {
      flashErr(e, "Couldn't publish.");
    } finally { setBusy(false); }
  }

  if (loading) return <Loading />;

  if (!curriculum) {
    return (
      <div>
        {!embedded && <PageHeader title="Curriculum Studio" subtitle="Design the 4-year structured programme" />}
        {err && <div className="mb-4 rounded-md bg-amber-500/10 text-amber-700 p-3 text-sm">{err}</div>}
        <Card className="p-6 max-w-lg">
          <h2 className="font-display font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <BookOpen size={18} className="text-brand-500" /> New curriculum
          </h2>
          <Field label="Curriculum name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Button className="mt-4" onClick={create} disabled={busy}><Plus size={16} /> Create curriculum</Button>
        </Card>
      </div>
    );
  }

  const actions = (
    <div className="flex items-center gap-3">
      <Badge tone={status === "published" ? "teal" : "amber"}>{status}</Badge>
      {status !== "published" && (
        <Button variant="amber" onClick={publish} disabled={busy || years.length === 0}>
          <Rocket size={16} /> Publish
        </Button>
      )}
    </div>
  );

  return (
    <div>
      {embedded ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 truncate">{curriculum.name}</p>
          {actions}
        </div>
      ) : (
        <PageHeader title="Curriculum Studio" subtitle={curriculum.name} right={actions} />
      )}

      {msg && (
        <div className="mb-5 rounded-md bg-teal-500/10 text-teal-700 p-3 text-sm flex items-center gap-2">
          <CheckCircle2 size={15} /> {msg}
        </div>
      )}
      {err && (
        <div className="mb-5 rounded-md bg-amber-500/10 text-amber-700 p-3 text-sm">{err}</div>
      )}

      <div className="space-y-4">
        {years.map((y, yi) => (
          <Card key={y.id} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
                <Layers size={17} className="text-amber-500" /> Year {y.year_no}
                <span className="text-sm font-normal text-slate-400">· {y.theme}</span>
              </h3>
              {status !== "published" && (
                <Button size="sm" variant="secondary" onClick={() => addModule(yi)}><Plus size={14} /> Module</Button>
              )}
            </div>
            <div className="space-y-2 pl-2">
              {y.modules.map((m, mi) => (
                <div key={m.id} className="rounded-md border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink-900 flex items-center gap-2">
                      <BookOpen size={14} className="text-brand-500" /> {m.title}
                    </p>
                    {status !== "published" && (
                      <button onClick={() => addLesson(yi, mi)} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                        <Plus size={12} /> Lesson
                      </button>
                    )}
                  </div>
                  {m.lessons.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="text-sm text-slate-600 flex items-center gap-2 pl-4 group">
                          <FileText size={13} className="text-slate-400 shrink-0" />
                          <span className="flex-1">{l.title}</span>
                          {l.blocks > 0
                            ? <Badge tone="teal">{l.blocks} block{l.blocks > 1 ? "s" : ""}</Badge>
                            : <span className="text-xs text-amber-500">no material yet</span>}
                          {!l.demo && (
                            <button onClick={() => setEditing({ id: l.id, title: l.title })}
                              className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                              <Pencil size={12} /> Edit material
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {y.modules.length === 0 && <p className="text-sm text-slate-400 pl-1">No modules yet.</p>}
            </div>
          </Card>
        ))}
      </div>

      {status !== "published" && (
        <button
          onClick={addYear}
          className="mt-4 w-full h-12 rounded-lg border-2 border-dashed border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Add Year {years.length + 1} <ChevronRight size={14} />
        </button>
      )}

      {editing && (
        <LessonEditor
          lessonId={editing.id}
          title={editing.title}
          onClose={() => setEditing(null)}
          onSaved={(count) => setLessonBlocks(editing.id, count)}
        />
      )}
    </div>
  );
}
