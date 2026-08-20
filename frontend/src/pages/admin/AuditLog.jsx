import { useEffect, useState } from "react";
import {
  ScrollText, ShieldCheck, ShieldAlert, RefreshCw, Search, Filter,
} from "lucide-react";
import { Card, Button, Badge, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../../components/ui/states.jsx";
import { api } from "../../lib/api.js";

// Super Admin · Audit trail. Every administrative action (role changes,
// suspensions, permission edits) is appended to a hash-chained, tamper-evident
// log. This page reads and filters it, and can verify the chain is unbroken.
const ACTION_TONE = (a) =>
  a.includes("deleted") || a.includes("status") ? "rose"
  : a.includes("created") || a.includes("assigned") ? "teal"
  : a.includes("updated") || a.includes("cloned") ? "amber" : "slate";

function prettyAction(a) {
  return a.replace(/^admin\./, "").replace(/[._]/g, " ");
}

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [verify, setVerify] = useState(null);
  const [filters, setFilters] = useState({ action: "", actor_id: "", entity_type: "", limit: 200 });

  async function load() {
    setLoading(true); setErr("");
    try {
      setRows(await api.auditLogs({ partition_key: "platform", ...filters }));
    } catch (e) { setErr(e.message || "Could not load the audit log."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function checkIntegrity() {
    setVerify(null);
    try { setVerify(await api.auditVerify("platform")); }
    catch (e) { setErr(e.message || "Verification failed."); }
  }

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        subtitle="A tamper-evident record of every administrative action across the platform."
        right={
          <div className="flex items-center gap-2">
            {verify && (
              <Badge tone={verify.valid ? "teal" : "rose"}>
                {verify.valid
                  ? <><ShieldCheck size={13} /> chain intact · {verify.records}</>
                  : <><ShieldAlert size={13} /> broken @ seq {verify.broken_at_seq}</>}
              </Badge>
            )}
            <Button variant="secondary" size="sm" onClick={checkIntegrity}>
              <ShieldCheck size={14} /> Verify integrity
            </Button>
            <Button variant="secondary" size="sm" onClick={load}><RefreshCw size={14} /> Refresh</Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <Field label="Action">
            <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full h-10 rounded-lg border border-slate-200 bg-surface px-3 text-sm">
              <option value="">All actions</option>
              <option value="admin.role.assigned">Role assigned</option>
              <option value="admin.role.unassigned">Role unassigned</option>
              <option value="admin.role.created">Role created</option>
              <option value="admin.role.updated">Role updated</option>
              <option value="admin.role.deleted">Role deleted</option>
              <option value="admin.user.status_changed">User suspended / reactivated</option>
            </select>
          </Field>
          <Field label="Actor (user id)">
            <Input value={filters.actor_id} onChange={(e) => setFilters({ ...filters, actor_id: e.target.value })}
              placeholder="Any admin" />
          </Field>
          <Field label="Entity type">
            <select value={filters.entity_type} onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
              className="w-full h-10 rounded-lg border border-slate-200 bg-surface px-3 text-sm">
              <option value="">All</option>
              <option value="user">User</option>
              <option value="role">Role</option>
            </select>
          </Field>
          <Button onClick={load}><Filter size={15} /> Apply</Button>
        </div>
      </Card>

      {err && <div className="rounded-md bg-rose-500/10 text-rose-600 text-sm px-3.5 py-2.5 mb-4">{err}</div>}

      {loading ? <Loading /> : rows.length === 0 ? (
        <EmptyState title="No audit records" hint="Administrative actions will appear here as they happen." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">Details</th>
                  <th className="px-5 py-3 font-medium tabular-nums">Seq</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 align-top">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {r.ts ? new Date(r.ts).toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-slate-600">{r.actor_id?.slice(0, 8) || "system"}</span>
                      <span className="block text-[11px] text-slate-400">{r.actor_type}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={ACTION_TONE(r.action)}>{prettyAction(r.action)}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-slate-600">{r.entity_type}</span>
                      {r.entity_id && <span className="block font-mono text-[11px] text-slate-400">{r.entity_id.slice(0, 12)}</span>}
                    </td>
                    <td className="px-5 py-3 max-w-xs">
                      <MetaSummary meta={r.meta} />
                    </td>
                    <td className="px-5 py-3 tabular-nums text-slate-400">{r.seq}</td>
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

function MetaSummary({ meta }) {
  const skip = new Set(["actor_id", "actor_type", "entity_type", "entity_id"]);
  const entries = Object.entries(meta || {}).filter(([k, v]) => !skip.has(k) && v != null && v !== "");
  if (!entries.length) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
          <span className="text-slate-400">{k}:</span>
          {Array.isArray(v) ? `${v.length} items` : String(v).slice(0, 24)}
        </span>
      ))}
    </div>
  );
}
