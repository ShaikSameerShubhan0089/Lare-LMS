import { useEffect, useState } from "react";
import { KeyRound, Plus, RefreshCw, Copy, Check, Power } from "lucide-react";
import { Card, Button, Badge, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../../components/ui/states.jsx";
import { api } from "../../lib/api.js";

// Admin: create & manage LMS Access IDs. Each code maps to ONE cohort
// (College → Year → Branch → Section); students must present it every login.
export default function AccessCodes() {
  const [colleges, setColleges] = useState([]);
  const [collegeId, setCollegeId] = useState("");
  const [cohorts, setCohorts] = useState([]);
  const [cohortId, setCohortId] = useState("");
  const [label, setLabel] = useState("");
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  async function loadCodes() {
    try { setCodes(await api.listAccessCodes()); } catch { setCodes([]); }
  }

  useEffect(() => {
    (async () => {
      try { setColleges(await api.colleges()); } catch { setColleges([]); }
      await loadCodes();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!collegeId) { setCohorts([]); setCohortId(""); return; }
    api.collegeCohorts(collegeId).then((c) => setCohorts(c || [])).catch(() => setCohorts([]));
  }, [collegeId]);

  async function create() {
    if (!cohortId) return;
    setErr(""); setBusy(true);
    try {
      await api.createAccessCode({ cohort_id: cohortId, label: label || null });
      setLabel(""); setCohortId("");
      await loadCodes();
    } catch (e) { setErr(e.message || "Could not create the Access ID."); }
    finally { setBusy(false); }
  }

  async function toggle(c) {
    await api.setAccessCodeStatus(c.id, c.status === "active" ? "inactive" : "active").catch(() => {});
    await loadCodes();
  }
  async function regen(c) {
    await api.regenerateAccessCode(c.id).catch(() => {});
    await loadCodes();
  }
  function copy(code) {
    navigator.clipboard?.writeText(code);
    setCopied(code); setTimeout(() => setCopied(""), 1500);
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Access IDs"
        subtitle="One secure code per class (College → Year → Branch → Section). Students enter it after login to reach their learning dashboard."
      />

      {/* Create */}
      <Card className="p-6 mb-6">
        <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2 mb-4">
          <Plus size={18} className="text-brand-500" /> Generate a new Access ID
        </h3>
        {err && <div className="rounded-md bg-rose-500/10 text-rose-600 text-sm px-3.5 py-2.5 mb-4">{err}</div>}
        <div className="grid sm:grid-cols-4 gap-4 items-end">
          <Field label="College">
            <select value={collegeId} onChange={(e) => setCollegeId(e.target.value)}
              className="w-full h-11 rounded-lg border border-slate-200 bg-surface px-3 text-sm">
              <option value="">Select college…</option>
              {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Class / Cohort">
            <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} disabled={!collegeId}
              className="w-full h-11 rounded-lg border border-slate-200 bg-surface px-3 text-sm disabled:opacity-50">
              <option value="">Select cohort…</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>Year {c.year_no}{c.section ? ` · Sec ${c.section}` : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Label (optional)">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. CSE-B 2024" />
          </Field>
          <Button onClick={create} disabled={busy || !cohortId}>
            <KeyRound size={16} /> {busy ? "Generating…" : "Generate"}
          </Button>
        </div>
      </Card>

      {/* List */}
      {codes.length === 0 ? (
        <EmptyState title="No Access IDs yet" hint="Generate one above for a class to let its students in." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Access ID</th>
                  <th className="px-5 py-3 font-medium">Class</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium tabular-nums">Uses</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <button onClick={() => copy(c.code)} className="font-mono font-semibold text-ink-900 inline-flex items-center gap-1.5 hover:text-brand-600">
                        {c.code}
                        {copied === c.code ? <Check size={14} className="text-teal-600" /> : <Copy size={13} className="text-slate-300" />}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      Year {c.year_no}{c.section ? ` · Sec ${c.section}` : ""}{c.label ? ` · ${c.label}` : ""}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={c.status === "active" ? "teal" : "slate"}>{c.status}</Badge>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-slate-500">{c.used_count}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => toggle(c)}>
                          <Power size={14} /> {c.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => regen(c)}>
                          <RefreshCw size={14} /> Regenerate
                        </Button>
                      </div>
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
