import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { PlayCircle, FileText, BookOpen, Lock, CheckCircle2, Layers, ChevronRight } from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource } from "../components/ui/states.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { api, withFallback } from "../lib/api.js";
import { demoCurriculum, demoPlaylist, DEMO_LEARNER_ID } from "../lib/demo.js";

const TYPE_ICON = { video: PlayCircle, reading: FileText, interactive: Layers, pdf: FileText };

export default function MyLearning() {
  const curriculum = useAsync(
    () => withFallback(api.curricula().then((cs) => api.curriculumTree(cs[0].id)), demoCurriculum),
    [],
  );
  const playlist = useAsync(
    () => withFallback(api.playlist(DEMO_LEARNER_ID), demoPlaylist),
    [],
  );

  if (curriculum.loading) return <Loading />;
  const tree = curriculum.data;
  const items = playlist.data || [];

  return (
    <div>
      <PageHeader
        title="My Learning"
        subtitle={tree?.name}
        right={<DataSource live={curriculum.live} />}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Curriculum tree */}
        <div className="lg:col-span-2 space-y-4">
          {(tree?.years || []).map((year) => (
            <Card key={year.year_no} className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="grid place-items-center h-8 w-8 rounded-md bg-ink-900 text-white font-display font-semibold text-sm">
                  {year.year_no}
                </span>
                <div>
                  <h2 className="font-display font-semibold text-ink-900">{year.theme}</h2>
                  <p className="text-xs text-slate-400">Year {year.year_no}</p>
                </div>
              </div>
              <div className="space-y-3">
                {year.modules.map((m) => (
                  <div key={m.id} className="rounded-md border border-slate-100 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-ink-900 flex items-center gap-2">
                        <BookOpen size={16} className="text-brand-500" /> {m.title}
                      </p>
                      <Badge tone={m.branch_scope === "core" ? "teal" : "slate"}>
                        {m.branch_scope}
                      </Badge>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {m.lessons.map((l) => (
                        <li key={l.id}>
                          <Link to={`/lms/lesson/${l.id}`}
                            className="text-sm text-slate-600 flex items-center gap-2 rounded-md -mx-1 px-1 py-1 hover:bg-brand-500/5 hover:text-brand-700 group">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-brand-400" />
                            <span className="flex-1">{l.title}</span>
                            {l.objectives?.[0]?.skill_tag && (
                              <Badge tone="brand">{l.objectives[0].skill_tag}</Badge>
                            )}
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-400" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Playlist */}
        <div>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-ink-900">Your playlist</h2>
              <DataSource live={playlist.live} />
            </div>
            <div className="space-y-3">
              {items.map((it, i) => {
                const Icon = TYPE_ICON[it.type] || FileText;
                const done = it.status === "completed";
                return (
                  <motion.div
                    key={it.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-md border p-3 flex items-center gap-3 ${
                      it.unlocked ? "border-slate-100" : "border-slate-100 opacity-60"
                    }`}
                  >
                    <span
                      className={`grid place-items-center h-9 w-9 rounded-md ${
                        done ? "bg-teal-500/12 text-teal-600" : "bg-brand-500/10 text-brand-600"
                      }`}
                    >
                      {it.unlocked ? (done ? <CheckCircle2 size={18} /> : <Icon size={18} />) : <Lock size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900 truncate">{it.title}</p>
                      <p className="text-xs text-slate-400">
                        {Math.round((it.duration_sec || 0) / 60)} min · {it.difficulty}
                      </p>
                    </div>
                    {it.unlocked && !done && (
                      <Button size="sm" variant="secondary">Start</Button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
