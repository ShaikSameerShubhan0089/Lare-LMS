import { useState } from "react";
import { BookOpen, Plus, Layers, FileText, Rocket, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, Badge, Button, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader } from "../../components/ui/states.jsx";
import { api } from "../../lib/api.js";

// Curriculum designer: build curriculum -> years -> modules -> lessons, then
// publish (which makes the structure immutable per the SRS).
export default function CurriculumStudio() {
  const [curriculum, setCurriculum] = useState(null);
  const [name, setName] = useState("LARE 4-Year Programme");
  const [status, setStatus] = useState("draft");
  const [years, setYears] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function create() {
    setBusy(true);
    try {
      const c = await api.createCurriculum({ name });
      setCurriculum(c);
    } catch {
      setCurriculum({ id: `cur-${Date.now()}`, name, demo: true });
    } finally { setBusy(false); }
  }

  async function addYear() {
    const year_no = years.length + 1;
    let y;
    try {
      y = await api.addYear(curriculum.id, { year_no, theme: `Year ${year_no}` });
    } catch {
      y = { id: `y-${Date.now()}`, year_no, theme: `Year ${year_no}`, demo: true };
    }
    setYears([...years, { ...y, year_no, modules: [] }]);
  }

  async function addModule(yi) {
    const y = years[yi];
    const title = prompt("Module title?");
    if (!title) return;
    let m;
    try { m = await api.addModule(y.id, { title, branch_scope: "all" }); }
    catch { m = { id: `m-${Date.now()}`, title, demo: true }; }
    const copy = [...years];
    copy[yi] = { ...y, modules: [...y.modules, { ...m, title, lessons: [] }] };
    setYears(copy);
  }

  async function addLesson(yi, mi) {
    const m = years[yi].modules[mi];
    const title = prompt("Lesson title?");
    if (!title) return;
    let l;
    try { l = await api.addLesson(m.id, { title }); }
    catch { l = { id: `l-${Date.now()}`, title, demo: true }; }
    const copy = [...years];
    const mods = [...copy[yi].modules];
    mods[mi] = { ...m, lessons: [...m.lessons, { ...l, title }] };
    copy[yi] = { ...copy[yi], modules: mods };
    setYears(copy);
  }

  async function publish() {
    setBusy(true);
    try {
      await api.publishCurriculum(curriculum.id);
      setStatus("published");
      setMsg("Curriculum published — structure is now immutable.");
    } catch {
      setStatus("published");
      setMsg("Published (demo).");
    } finally { setBusy(false); }
  }

  if (!curriculum) {
    return (
      <div>
        <PageHeader title="Curriculum Studio" subtitle="Design the 4-year structured programme" />
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

  return (
    <div>
      <PageHeader
        title="Curriculum Studio"
        subtitle={curriculum.name}
        right={
          <div className="flex items-center gap-3">
            <Badge tone={status === "published" ? "teal" : "amber"}>{status}</Badge>
            {status !== "published" && (
              <Button variant="amber" onClick={publish} disabled={busy || years.length === 0}>
                <Rocket size={16} /> Publish
              </Button>
            )}
          </div>
        }
      />

      {msg && (
        <div className="mb-5 rounded-md bg-teal-500/10 text-teal-700 p-3 text-sm flex items-center gap-2">
          <CheckCircle2 size={15} /> {msg}
        </div>
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
                        <li key={l.id} className="text-sm text-slate-600 flex items-center gap-1.5 pl-4">
                          <FileText size={13} className="text-slate-400" /> {l.title}
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
    </div>
  );
}
