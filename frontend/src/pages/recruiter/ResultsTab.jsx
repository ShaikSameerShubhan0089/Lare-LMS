import { useState } from "react";
import { Trophy, Send, Upload, Award, CheckCircle2, ExternalLink } from "lucide-react";
import { Card, Badge, Button, Input } from "../../components/ui/primitives.jsx";
import { Loading, DataSource } from "../../components/ui/states.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { api, withFallback } from "../../lib/api.js";
import { demoRegistrations, demoResults } from "../../lib/demo.js";

const OUTCOME_TONE = { selected: "teal", shortlist: "brand", fail: "rose", pass: "brand" };

// Render a candidate as name / email / roll, falling back to the id.
function Person({ info }) {
  const i = info || {};
  if (!i.candidate_name && !i.candidate_email) {
    return <span className="font-mono text-xs">{i.candidate_id}</span>;
  }
  return (
    <div className="leading-tight">
      <span>{i.candidate_name || i.candidate_email}</span>
      {i.candidate_email && <span className="block text-xs text-slate-400">{i.candidate_email}</span>}
      {i.candidate_roll && <span className="block text-xs text-slate-400">Roll: {i.candidate_roll}</span>}
    </div>
  );
}

export default function ResultsTab({ id }) {
  const regs = useAsync(() => withFallback(api.driveRegistrations(id), demoRegistrations), [id]);
  const [scores, setScores] = useState({});
  const [cutoff, setCutoff] = useState(60);
  const [results, setResults] = useState(null);
  const [published, setPublished] = useState(false);
  const [offers, setOffers] = useState({});

  if (regs.loading) return <Loading />;
  const candidates = (regs.data || []).filter((r) => r.eligible !== "no");
  // Lookup so result/offer rows show real people, not UUIDs.
  const info = Object.fromEntries((regs.data || []).map((r) => [r.candidate_id, r]));

  async function compile() {
    const rows = candidates.map((c) => ({
      candidate_id: c.candidate_id,
      final_score: Number(scores[c.candidate_id] ?? 0),
      interview_decision: c.status === "selected" ? "select" : null,
    }));
    try {
      await api.compileResults({ drive_id: id, cutoff: Number(cutoff), rows });
      const live = await api.driveResults(id);
      setResults(live);
    } catch {
      // demo compile
      const ranked = [...rows].sort((a, b) => b.final_score - a.final_score).map((r, i) => ({
        candidate_id: r.candidate_id,
        final_score: r.final_score,
        rank: i + 1,
        outcome: r.interview_decision === "select" ? "selected" : r.final_score >= cutoff ? "shortlist" : "fail",
        status: "draft",
      }));
      setResults(ranked.length ? ranked : demoResults);
    }
  }

  async function publish() {
    try { await api.publishResults(id); } catch { /* demo */ }
    setResults((rs) => (rs || []).map((r) => ({ ...r, status: "published" })));
    setPublished(true);
  }

  async function makeOffer(cid, type) {
    let out;
    try {
      out = await api.generateOffer({
        drive_id: id, candidate_id: cid, type,
        company_name: "Lare Consulting & Technologies Pvt. Ltd.", role_title: "Software Engineer", ctc: "6 LPA",
      });
    } catch {
      out = { verify_id: "demo-" + Math.random().toString(36).slice(2, 8), type };
    }
    setOffers((o) => ({ ...o, [cid]: out }));
  }

  return (
    <div className="space-y-6">
      {/* Compile controls */}
      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-ink-900">Compile results</h2>
            <p className="text-sm text-slate-500">Enter final scores, set the cutoff, then compile & publish.</p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Cutoff %</label>
              <Input type="number" value={cutoff} onChange={(e) => setCutoff(e.target.value)} className="w-24" />
            </div>
            <Button onClick={compile}><Trophy size={17} /> Compile</Button>
          </div>
        </div>

        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {candidates.map((c) => (
            <div key={c.candidate_id} className="rounded-md border border-slate-100 p-3">
              <div className="text-sm font-medium text-ink-900 mb-2"><Person info={c} /></div>
              <Input
                type="number"
                placeholder="Final score"
                value={scores[c.candidate_id] ?? ""}
                onChange={(e) => setScores((s) => ({ ...s, [c.candidate_id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Results table */}
      {results && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="font-display font-semibold text-ink-900">Results</h2>
            <div className="flex items-center gap-3">
              <DataSource live={regs.live} />
              {!published && (
                <Button onClick={publish}><Upload size={16} /> Publish results</Button>
              )}
              {published && <Badge tone="teal"><CheckCircle2 size={13} /> Published</Badge>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-medium px-5 py-3">Rank</th>
                  <th className="text-left font-medium px-5 py-3">Candidate</th>
                  <th className="text-left font-medium px-5 py-3">Score</th>
                  <th className="text-left font-medium px-5 py-3">Outcome</th>
                  <th className="text-right font-medium px-5 py-3">Offer</th>
                </tr>
              </thead>
              <tbody>
                {(results || []).map((r) => (
                  <tr key={r.candidate_id} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <span className={`grid place-items-center h-7 w-7 rounded-full text-sm font-semibold ${
                        r.rank === 1 ? "bg-amber-500 text-ink-950" : "bg-slate-100 text-slate-500"
                      }`}>{r.rank}</span>
                    </td>
                    <td className="px-5 py-3 font-medium text-ink-900"><Person info={info[r.candidate_id] || { candidate_id: r.candidate_id }} /></td>
                    <td className="px-5 py-3 tabular-nums text-slate-600">{r.final_score}</td>
                    <td className="px-5 py-3"><Badge tone={OUTCOME_TONE[r.outcome] || "slate"}>{r.outcome}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      {offers[r.candidate_id] ? (
                        <a
                          href={`/api/verify/offer/${offers[r.candidate_id].verify_id}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
                        >
                          <ExternalLink size={14} /> {offers[r.candidate_id].type === "ppo" ? "PPO" : "Offer"} issued
                        </a>
                      ) : r.outcome === "selected" ? (
                        <Button size="sm" variant="amber" onClick={() => makeOffer(r.candidate_id, "ppo")}>
                          <Award size={15} /> PPO offer
                        </Button>
                      ) : r.outcome === "shortlist" ? (
                        <Button size="sm" variant="secondary" onClick={() => makeOffer(r.candidate_id, "offer")}>
                          <Send size={14} /> Offer
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
