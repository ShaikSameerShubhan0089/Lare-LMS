import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Building2, MapPin, Clock, ChevronRight, X, Trash2 } from "lucide-react";
import { Card, Badge, Button, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, DataSource } from "../../components/ui/states.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { api, withFallback } from "../../lib/api.js";
import { demoRecruiterDrives } from "../../lib/demo.js";

export default function RecruiterDrives() {
  const drives = useAsync(() => withFallback(api.drives(), demoRecruiterDrives), []);
  const [creating, setCreating] = useState(false);
  const [extra, setExtra] = useState([]);
  const [removed, setRemoved] = useState(() => new Set());

  if (drives.loading) return <Loading />;
  const list = [...(drives.data || []), ...extra].filter((d) => !removed.has(d.id));

  async function del(d) {
    if (!window.confirm(`Delete "${d.title}"? This permanently removes the drive and all its rounds, marks, registrations, and results.`)) return;
    try { await api.deleteDrive(d.id); } catch { /* still hide locally */ }
    setRemoved((r) => new Set(r).add(d.id));
  }

  return (
    <div>
      <PageHeader
        title="Recruitment Drives"
        subtitle="Create and run campus recruitment drives"
        right={
          <div className="flex items-center gap-3">
            <DataSource live={drives.live} />
            <Button onClick={() => setCreating(true)}>
              <Plus size={18} /> New drive
            </Button>
          </div>
        }
      />

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((d) => (
          <Card key={d.id} className="p-6">
            <div className="flex items-start justify-between">
              <span className="grid place-items-center h-11 w-11 rounded-md bg-ink-900 text-white">
                <Building2 size={22} />
              </span>
              <Badge tone={d.status === "open" ? "teal" : d.status === "draft" ? "slate" : "amber"}>
                {d.status}
              </Badge>
            </div>
            <h2 className="mt-4 font-display font-semibold text-ink-900">{d.title}</h2>
            <p className="text-sm text-slate-500">{d.company_name}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              {d.venue && <span className="flex items-center gap-1.5"><MapPin size={14} /> {d.venue}</span>}
              {d.reporting_time && <span className="flex items-center gap-1.5"><Clock size={14} /> {d.reporting_time}</span>}
            </div>
            <div className="flex gap-2 mt-5">
              <Button as={Link} to={`/drive/recruiter/drives/${d.id}`} variant="secondary" className="flex-1">
                Manage <ChevronRight size={18} />
              </Button>
              <button
                onClick={() => del(d)}
                aria-label="Delete drive"
                className="grid place-items-center h-11 w-11 rounded-md border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300"
              >
                <Trash2 size={17} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {creating && (
        <CreateDrive
          onClose={() => setCreating(false)}
          onCreated={(d) => {
            setExtra((e) => [...e, d]);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CreateDrive({ onClose, onCreated }) {
  const [form, setForm] = useState({ company_name: "", title: "", venue: "", reporting_time: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const body = { company_id: form.company_name.toLowerCase().replace(/\s+/g, "-"), ...form };
    try {
      const created = await api.createDrive(body);
      onCreated(created);
    } catch {
      onCreated({ id: `local-${Date.now()}`, status: "draft", ...form }); // demo
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-ink-900">New recruitment drive</h2>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-md hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Company name">
            <Input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Lare Consulting & Technologies Pvt. Ltd." />
          </Field>
          <Field label="Drive title">
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="SWE Intern Drive 2027" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Venue">
              <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Aditya College" />
            </Field>
            <Field label="Reporting time">
              <Input value={form.reporting_time} onChange={(e) => setForm({ ...form, reporting_time: e.target.value })} placeholder="9:00 AM" />
            </Field>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create drive"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
