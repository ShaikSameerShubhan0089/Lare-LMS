import { useEffect, useMemo, useState } from "react";
import {
  Library, Video, FileText, Presentation, BookOpen, Code2, Link2, Plus, X,
  ChevronRight, FolderTree,
} from "lucide-react";
import { Card, Button, Badge, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../../components/ui/states.jsx";
import { api } from "../../lib/api.js";

// Content Studio — author materials onto the roadmap. Pick a curriculum → year →
// module → topic, then add resources (recordings, PPT, PDF, notes, coding, links).
// Because modules are branch-scoped and curricula are assigned to cohorts, what
// you add here becomes visible to every eligible student automatically.
const RES_TYPES = [
  { key: "video", label: "Recording", icon: Video, cls: "bg-rose-500/10 text-rose-600" },
  { key: "slide", label: "PPT / Slides", icon: Presentation, cls: "bg-amber-500/10 text-amber-600" },
  { key: "pdf", label: "PDF / Notes", icon: FileText, cls: "bg-violet-500/10 text-violet-600" },
  { key: "reading", label: "Study Material", icon: BookOpen, cls: "bg-teal-500/10 text-teal-600" },
  { key: "interactive", label: "Coding Example", icon: Code2, cls: "bg-brand-500/10 text-brand-600" },
  { key: "link", label: "Resource Link", icon: Link2, cls: "bg-slate-500/10 text-slate-500" },
];
const typeMeta = (t) => RES_TYPES.find((r) => r.key === t) || RES_TYPES[5];

export default function ContentStudio() {
  const [curricula, setCurricula] = useState([]);
  const [curId, setCurId] = useState("");
  const [tree, setTree] = useState(null);
  const [yearNo, setYearNo] = useState(null);
  const [moduleId, setModuleId] = useState(null);
  const [lessonId, setLessonId] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const cs = await api.curricula();
        setCurricula(cs || []);
        if (cs?.length) setCurId(cs[0].id);
      } catch (e) { setErr(e.message || "Could not load curricula."); }
      setLoading(false);
    })();
  }, []);

  async function loadTree(id) {
    setYearNo(null); setModuleId(null); setLessonId(null); setResources([]);
    if (!id) return setTree(null);
    try {
      const t = await api.curriculumTree(id);
      setTree(t);
      if (t?.years?.length) setYearNo(t.years[0].year_no);
    } catch (e) { setErr(e.message || "Could not load the roadmap."); }
  }
  useEffect(() => { if (curId) loadTree(curId); }, [curId]);

  const year = useMemo(() => (tree?.years || []).find((y) => y.year_no === yearNo), [tree, yearNo]);
  const module = useMemo(() => (year?.modules || []).find((m) => m.id === moduleId), [year, moduleId]);

  async function openLesson(lid) {
    setLessonId(lid);
    try { setResources(await api.listContent(lid)); } catch { setResources([]); }
  }

  async function addTopic(title) {
    const order = (module.lessons || []).length;
    await api.addLesson(module.id, { title, order });
    await loadTree(curId);          // refresh tree
    setModuleId(module.id);         // keep the module open
  }

  async function addResource(body) {
    await api.createContent({ ...body, lesson_id: lessonId });
    await openLesson(lessonId);     // refresh resources
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Content Studio"
        subtitle="Author recordings, notes, slides and more onto the roadmap — automatically visible to every eligible student."
      />
      {err && <div className="rounded-md bg-rose-500/10 text-rose-600 text-sm px-3.5 py-2.5 mb-4">{err}</div>}

      {/* Curriculum + year selectors */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <Field label="Roadmap / Curriculum">
          <select value={curId} onChange={(e) => setCurId(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 bg-surface px-3 text-sm min-w-[220px]">
            {curricula.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {tree && (
          <div className="flex gap-1.5">
            {tree.years.map((y) => (
              <button key={y.year_no} onClick={() => { setYearNo(y.year_no); setModuleId(null); setLessonId(null); }}
                className={`px-3 h-11 rounded-lg text-sm font-medium border transition
                  ${yearNo === y.year_no ? "border-brand-400 bg-brand-500/10 text-brand-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                Year {y.year_no}
              </button>
            ))}
          </div>
        )}
      </div>

      {!tree ? <EmptyState title="No curriculum" hint="Create a roadmap curriculum first." /> : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-5">
          {/* Modules of the selected year */}
          <Card className="p-0 overflow-hidden self-start">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-ink-900 flex items-center gap-2">
              <FolderTree size={15} className="text-brand-500" /> {year?.theme || `Year ${yearNo}`}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {(year?.modules || []).map((m) => (
                <button key={m.id} onClick={() => { setModuleId(m.id); setLessonId(null); }}
                  className={`w-full text-left px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 flex items-center justify-between gap-2
                    ${moduleId === m.id ? "bg-brand-500/5 border-l-2 border-l-brand-500" : ""}`}>
                  <span className="text-sm text-ink-900 truncate">{m.title}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {m.branch_scope !== "all" && <Badge tone="amber">{m.branch_scope.replace("cse_allied", "cse")}</Badge>}
                    <span className="text-xs text-slate-400">{m.lessons?.length || 0}</span>
                  </span>
                </button>
              ))}
              {(year?.modules || []).length === 0 && <p className="p-4 text-sm text-slate-400">No modules this year.</p>}
            </div>
          </Card>

          {/* Topics + resources of the selected module */}
          {!module ? (
            <EmptyState title="Select a module" hint="Pick a module to add topics and resources." />
          ) : (
            <ModulePanel module={module} lessonId={lessonId} resources={resources}
              onOpenLesson={openLesson} onAddTopic={addTopic} onAddResource={addResource} setErr={setErr} />
          )}
        </div>
      )}
    </div>
  );
}

function ModulePanel({ module, lessonId, resources, onOpenLesson, onAddTopic, onAddResource, setErr }) {
  const [newTopic, setNewTopic] = useState("");
  const [busy, setBusy] = useState(false);

  async function addTopic() {
    if (!newTopic.trim()) return;
    setBusy(true); setErr("");
    try { await onAddTopic(newTopic.trim()); setNewTopic(""); }
    catch (e) { setErr(e.message || "Could not add topic."); }
    finally { setBusy(false); }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-ink-900">{module.title}</h3>
        {module.branch_scope !== "all" && <Badge tone="amber">{module.branch_scope} only</Badge>}
      </div>

      {/* Topics */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(module.lessons || []).map((l) => (
          <button key={l.id} onClick={() => onOpenLesson(l.id)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition
              ${lessonId === l.id ? "border-brand-400 bg-brand-500/10 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {l.title}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-5">
        <Input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="Add a topic (e.g. Python Basics)"
          onKeyDown={(e) => e.key === "Enter" && addTopic()} />
        <Button onClick={addTopic} disabled={busy}><Plus size={15} /> Topic</Button>
      </div>

      {/* Resources for the selected topic */}
      {!lessonId ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
          Select or add a topic to attach resources.
        </div>
      ) : (
        <div className="border-t border-slate-100 pt-4">
          <ResourceList resources={resources} />
          <AddResource onAdd={onAddResource} setErr={setErr} />
        </div>
      )}
    </Card>
  );
}

function ResourceList({ resources }) {
  if (!resources.length)
    return <p className="text-sm text-slate-400 mb-4">No resources yet — add the first below.</p>;
  return (
    <div className="space-y-2 mb-4">
      {resources.map((r) => {
        const m = typeMeta(r.type); const Icon = m.icon;
        return (
          <div key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
            <span className={`grid place-items-center h-8 w-8 rounded-md ${m.cls}`}><Icon size={16} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-900 truncate">{r.title}</p>
              {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 truncate block hover:underline">{r.url}</a>}
            </div>
            <Badge tone="slate">{m.label}</Badge>
          </div>
        );
      })}
    </div>
  );
}

function AddResource({ onAdd, setErr }) {
  const [type, setType] = useState("video");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return setErr("Give the resource a title.");
    setBusy(true); setErr("");
    try {
      await onAdd({ type, title: title.trim(), url: url.trim() || null });
      setTitle(""); setUrl("");
    } catch (e) { setErr(e.message || "Could not add the resource."); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-3">
      <div className="flex flex-wrap gap-2 mb-3">
        {RES_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setType(t.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition
                ${type === t.key ? "border-brand-400 bg-white text-brand-700" : "border-slate-200 text-slate-500 hover:bg-white"}`}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resource title" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (video / file / link)" />
      </div>
      <div className="flex justify-end mt-2">
        <Button size="sm" onClick={submit} disabled={busy}><Plus size={14} /> {busy ? "Adding…" : "Add resource"}</Button>
      </div>
    </div>
  );
}
