import { motion } from "framer-motion";
import { Trophy, GraduationCap, Building2, Briefcase, TrendingUp } from "lucide-react";
import { Card, StatTile, Badge } from "../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource } from "../components/ui/states.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { api, withFallback } from "../lib/api.js";
import { demoRanking } from "../lib/demo.js";

export default function Analytics() {
  const ranking = useAsync(() => withFallback(api.ranking(), demoRanking), []);
  const dash = useAsync(
    () => withFallback(api.dashboard("company_admin"), {
      colleges: 2, learners: 480, drives: 6, top_colleges: demoRanking,
    }),
    [],
  );

  if (ranking.loading) return <Loading />;
  const rows = ranking.data || [];
  const d = dash.data || {};
  const max = Math.max(...rows.map((r) => r.readiness_index), 100);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Readiness & the best-college ranking"
        right={<DataSource live={ranking.live} />}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile icon={Building2} label="Colleges" value={d.colleges ?? rows.length} tone="brand" />
        <StatTile icon={GraduationCap} label="Learners" value={d.learners ?? "—"} tone="teal" />
        <StatTile icon={Briefcase} label="Drives" value={d.drives ?? "—"} tone="amber" />
        <StatTile
          icon={TrendingUp}
          label="Top readiness"
          value={rows[0] ? `${rows[0].readiness_index}` : "—"}
          tone="brand"
        />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display font-semibold text-ink-900 flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" /> Best College Ranking
            </h2>
            <p className="text-sm text-slate-500">Weighted composite: attendance, scores, placement, certification, engagement.</p>
          </div>
        </div>
        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={r.college_id} className="flex items-center gap-4">
              <span
                className={`grid place-items-center h-9 w-9 rounded-full text-sm font-semibold shrink-0 ${
                  i === 0 ? "bg-amber-500 text-ink-950" : "bg-slate-100 text-slate-500"
                }`}
              >
                {r.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-ink-900 truncate">{r.college_id}</span>
                  <span className="tabular-nums text-sm text-slate-600">{r.readiness_index}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${i === 0 ? "bg-amber-500" : "bg-brand-500"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(r.readiness_index / max) * 100}%` }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.08 }}
                  />
                </div>
              </div>
              {i === 0 && <Badge tone="amber">Top</Badge>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
