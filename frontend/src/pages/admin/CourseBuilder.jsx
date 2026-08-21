import { useState } from "react";
import { FolderTree, Library } from "lucide-react";
import { PageHeader } from "../../components/ui/states.jsx";
import CurriculumStudio from "./CurriculumStudio.jsx";
import ContentStudio from "./ContentStudio.jsx";

// One place to build a course end to end: the Structure tab designs the
// curriculum (years → modules → topics + interactive lessons); the Materials
// tab attaches resources (recordings, PDFs, slides, coding) to those topics —
// which then appear on every eligible student's roadmap.
const TABS = [
  { key: "structure", label: "Structure", icon: FolderTree,
    hint: "Design the programme: years, modules, topics & interactive lessons" },
  { key: "materials", label: "Materials", icon: Library,
    hint: "Attach recordings, notes, slides and coding resources to each topic" },
];

export default function CourseBuilder() {
  const [tab, setTab] = useState("structure");
  const active = TABS.find((t) => t.key === tab);

  return (
    <div>
      <PageHeader title="Course Builder" subtitle={active.hint} />

      <div className="flex gap-2 mb-5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium border transition
                ${tab === t.key ? "border-brand-400 bg-brand-500/10 text-brand-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "structure" ? <CurriculumStudio embedded /> : <ContentStudio embedded />}
    </div>
  );
}
