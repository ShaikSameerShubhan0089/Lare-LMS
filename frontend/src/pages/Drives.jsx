import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, MapPin, Clock, Play, ListChecks } from "lucide-react";
import { Card, Badge, Button } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource, EmptyState } from "../components/ui/states.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { api, withFallback } from "../lib/api.js";
import { demoDrives } from "../lib/demo.js";
import { ReadOut } from "../components/drive/grammar.jsx";

// Student view of LARE Hire. Students register via the public "Attend Drive"
// flow, so here they simply see the open drive(s) and start the assessment — no
// per-drive apply step. No LMS content here.
export default function Drives() {
  const nav = useNavigate();
  const drives = useAsync(() => withFallback(api.drives("open"), demoDrives), []);
  const [exams, setExams] = useState({}); // drive_id -> [exam]

  const list = drives.data || [];

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        list.map(async (d) => [d.id, await api.listExams(d.id).catch(() => [])]),
      );
      setExams(Object.fromEntries(entries));
    })();
  }, [drives.data]);

  if (drives.loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="My Drive"
        subtitle="Start your assessment for the drive you registered for"
        right={<DataSource live={drives.live} />}
      />
      {list.length === 0 ? (
        <EmptyState title="No open drives" hint="Drives opened by your placement cell will appear here." />
      ) : (
        <>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <ReadOut label="Open drives" value={list.length} hint="you can attempt now" />
          <ReadOut label="Assessments" value={Object.values(exams).reduce((n, e) => n + (e?.length || 0), 0)} hint="ready to start" />
          <ReadOut label="Companies" value={new Set(list.map((d) => d.company_name)).size} hint="hiring on campus" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {list.map((d) => {
            const driveExams = exams[d.id] || [];
            return (
              <Card key={d.id} className="p-6">
                <div className="flex items-start justify-between">
                  <span className="grid place-items-center h-11 w-11 rounded-md bg-invert-900 text-white">
                    <Building2 size={22} />
                  </span>
                  <Badge tone={d.status === "open" ? "teal" : "slate"}>{d.status}</Badge>
                </div>
                <h2 className="mt-4 font-display font-semibold text-ink-900">{d.title}</h2>
                <p className="text-sm text-slate-500">{d.company_name}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  {d.venue && <span className="flex items-center gap-1.5"><MapPin size={14} /> {d.venue}</span>}
                  {d.reporting_time && <span className="flex items-center gap-1.5"><Clock size={14} /> {d.reporting_time}</span>}
                </div>

                {driveExams.length > 0 ? (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <ListChecks size={13} /> Assessment{driveExams.length > 1 ? "s" : ""}
                    </p>
                    {driveExams.map((ex) => (
                      <div key={ex.id} className="flex items-center justify-between rounded-md border border-slate-100 p-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-900 truncate">{ex.title}</p>
                          <p className="text-xs text-slate-400">{ex.sections} section{ex.sections === 1 ? "" : "s"} · {ex.total_time_min} min</p>
                        </div>
                        <Button size="sm" variant="amber" onClick={() => nav(`/drive/test/${ex.id}`)}>
                          <Play size={14} /> Start
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-slate-400">Assessment not scheduled yet — check back soon.</p>
                )}
              </Card>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
