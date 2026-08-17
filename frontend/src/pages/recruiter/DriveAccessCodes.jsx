import { useEffect, useState } from "react";
import { KeyRound, Plus, RefreshCw, Copy, Check, Power } from "lucide-react";
import { Card, Button, Badge, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../../components/ui/states.jsx";
import { api } from "../../lib/api.js";

// Recruiter: create & manage Drive Access IDs. Each code maps to ONE drive;
// candidates present it (after Hire login) to access only that drive.
export default function DriveAccessCodes() {
  const [drives, setDrives] = useState([]);
  const [driveId, setDriveId] = useState("");
  const [label, setLabel] = useState("");
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  async function loadCodes() {
    try { setCodes(await api.listDriveAccessCodes()); } catch { setCodes([]); }
  }

  useEffect(() => {
    (async () => {
      try { setDrives(await api.drives()); } catch { setDrives([]); }
      await loadCodes();
      setLoading(false);
    })();
  }, []);

  const driveName = (id) => {
    const d = drives.find((x) => x.id === id);
    return d ? `${d.title}${d.company_name ? ` · ${d.company_name}` : ""}` : id;
  };

  async function create() {
    if (!driveId) return;
    setErr(""); setBusy(true);
    try {
      await api.createDriveAccessCode({ drive_id: driveId, label: label || null });
      setLabel(""); setDriveId("");
      await loadCodes();
    } catch (e) { setErr(e.message || "Could not create the Access ID."); }
    finally { setBusy(false); }
  }
  async function toggle(c) {
    await api.setDriveAccessCodeStatus(c.id, c.status === "active" ? "inactive" : "active").catch(() => {});
    await loadCodes();
  }
  async function regen(c) {
    await api.regenerateDriveAccessCode(c.id).catch(() => {});
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
        title="Drive Access IDs"
        subtitle="One secure code per recruitment drive. Candidates sign in and enter it to access only that drive."
      />

      <Card className="p-6 mb-6">
        <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2 mb-4">
          <Plus size={18} className="text-amber-500" /> Generate a new Drive Access ID
        </h3>
        {err && <div className="rounded-md bg-rose-500/10 text-rose-600 text-sm px-3.5 py-2.5 mb-4">{err}</div>}
        <div className="grid sm:grid-cols-3 gap-4 items-end">
          <Field label="Drive">
            <select value={driveId} onChange={(e) => setDriveId(e.target.value)}
              className="w-full h-11 rounded-lg border border-slate-200 bg-surface px-3 text-sm">
              <option value="">Select drive…</option>
              {drives.map((d) => <option key={d.id} value={d.id}>{d.title}{d.company_name ? ` · ${d.company_name}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Label (optional)">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Campus A batch" />
          </Field>
          <Button variant="amber" onClick={create} disabled={busy || !driveId}>
            <KeyRound size={16} /> {busy ? "Generating…" : "Generate"}
          </Button>
        </div>
      </Card>

      {codes.length === 0 ? (
        <EmptyState title="No Drive Access IDs yet" hint="Generate one above for a drive to let its candidates in." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Access ID</th>
                  <th className="px-5 py-3 font-medium">Drive</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium tabular-nums">Uses</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <button onClick={() => copy(c.code)} className="font-mono font-semibold text-ink-900 inline-flex items-center gap-1.5 hover:text-amber-600">
                        {c.code}
                        {copied === c.code ? <Check size={14} className="text-teal-600" /> : <Copy size={13} className="text-slate-300" />}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{driveName(c.drive_id)}{c.label ? ` · ${c.label}` : ""}</td>
                    <td className="px-5 py-3"><Badge tone={c.status === "active" ? "teal" : "slate"}>{c.status}</Badge></td>
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
