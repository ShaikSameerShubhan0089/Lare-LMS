import { useEffect, useMemo, useState } from "react";
import {
  Shield, Plus, Copy, Trash2, Save, Power, Lock, Users, Search, X,
} from "lucide-react";
import { Card, Button, Badge, Field, Input } from "../../components/ui/primitives.jsx";
import { PageHeader, Loading, EmptyState } from "../../components/ui/states.jsx";
import { api } from "../../lib/api.js";

const SCOPES = [
  ["platform", "Platform — every college"],
  ["college", "College — one institution"],
  ["branch", "Branch / department"],
  ["section", "Section / class"],
  ["self", "Self only"],
];
const SCOPE_TONE = { platform: "violet", college: "teal", branch: "amber", section: "slate", self: "slate" };

// Admin: the RBAC control room. Roles bundle granular permissions; every API
// enforces on those permission codes, so what you grant here is what a user can
// actually do — the UI is not the boundary, the backend is.
export default function RolesPermissions() {
  const [roles, setRoles] = useState([]);
  const [perms, setPerms] = useState([]);
  const [sel, setSel] = useState(null);       // selected role id
  const [draft, setDraft] = useState(null);   // editable copy of selected role
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  async function load(keepSel) {
    const [r, p] = await Promise.all([api.listRoles(), api.listPermissions()]);
    setRoles(r || []); setPerms(p || []);
    if (keepSel) {
      const found = (r || []).find((x) => x.id === keepSel);
      if (found) { setSel(found.id); setDraft({ ...found, permissions: [...found.permissions] }); }
    }
  }

  useEffect(() => {
    (async () => {
      try { await load(); } catch (e) { setErr(e.message || "Failed to load roles."); }
      setLoading(false);
    })();
  }, []);

  // permissions grouped by domain, for the editor
  const byDomain = useMemo(() => {
    const g = {};
    for (const p of perms) (g[p.domain] || (g[p.domain] = [])).push(p);
    return g;
  }, [perms]);

  function pick(role) {
    setCreating(false); setErr("");
    setSel(role.id);
    setDraft({ ...role, permissions: [...role.permissions] });
  }

  function startCreate() {
    setCreating(true); setSel(null); setErr("");
    setDraft({ name: "", description: "", scope_level: "self", permissions: [], is_system: false, is_active: true });
  }

  function toggle(code) {
    setDraft((d) => {
      const has = d.permissions.includes(code);
      return { ...d, permissions: has ? d.permissions.filter((c) => c !== code) : [...d.permissions, code] };
    });
  }

  const dirty = useMemo(() => {
    if (!draft) return false;
    if (creating) return draft.name.trim().length >= 2;
    const orig = roles.find((r) => r.id === sel);
    if (!orig) return false;
    return (
      draft.description !== orig.description ||
      draft.scope_level !== orig.scope_level ||
      draft.is_active !== orig.is_active ||
      draft.permissions.slice().sort().join() !== orig.permissions.slice().sort().join()
    );
  }, [draft, roles, sel, creating]);

  async function save() {
    setErr(""); setBusy(true);
    try {
      if (creating) {
        const created = await api.createRole({
          name: draft.name, description: draft.description,
          scope_level: draft.scope_level, permissions: draft.permissions,
        });
        await load(created.id); setCreating(false);
      } else {
        await api.updateRole(sel, {
          description: draft.description, scope_level: draft.scope_level,
          is_active: draft.is_active, permissions: draft.permissions,
        });
        await load(sel);
      }
    } catch (e) { setErr(e.message || "Could not save the role."); }
    finally { setBusy(false); }
  }

  async function clone(role) {
    setErr(""); setBusy(true);
    try {
      const c = await api.cloneRole(role.id, { name: `${role.name}_copy` });
      await load(c.id);
    } catch (e) { setErr(e.message || "Could not clone the role."); }
    finally { setBusy(false); }
  }

  async function remove(role) {
    if (!confirm(`Delete the “${role.name}” role? This cannot be undone.`)) return;
    setErr(""); setBusy(true);
    try {
      await api.deleteRole(role.id);
      if (sel === role.id) { setSel(null); setDraft(null); }
      await load();
    } catch (e) { setErr(e.message || "Could not delete the role."); }
    finally { setBusy(false); }
  }

  if (loading) return <Loading />;

  const filtered = roles.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what each role can do. Permissions are enforced by every backend service — granting here grants the real capability."
        right={<Button onClick={startCreate}><Plus size={16} /> New role</Button>}
      />

      {err && <div className="rounded-md bg-rose-500/10 text-rose-600 text-sm px-3.5 py-2.5 mb-4">{err}</div>}

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        {/* Roles list */}
        <Card className="p-0 overflow-hidden self-start">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roles…"
                className="w-full h-10 rounded-lg border border-slate-200 bg-surface pl-9 pr-3 text-sm" />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {filtered.map((r) => (
              <button key={r.id} onClick={() => pick(r)}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition
                  ${sel === r.id ? "bg-brand-500/5 border-l-2 border-l-brand-500" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink-900 flex items-center gap-1.5">
                    {r.is_system && <Lock size={12} className="text-slate-400" />}
                    {r.name}
                  </span>
                  <Badge tone={SCOPE_TONE[r.scope_level] || "slate"}>{r.scope_level}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  <span>{r.permissions.length} perms</span>
                  <span className="flex items-center gap-1"><Users size={11} /> {r.user_count}</span>
                  {!r.is_active && <span className="text-rose-500">inactive</span>}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Editor */}
        {!draft ? (
          <EmptyState title="Select a role" hint="Pick a role to view and edit its permissions, or create a new one." />
        ) : (
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0 flex-1">
                {creating ? (
                  <Field label="Role name">
                    <Input value={draft.name} autoFocus
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="e.g. hod_cse" />
                  </Field>
                ) : (
                  <h2 className="font-display text-lg font-semibold text-ink-900 flex items-center gap-2">
                    <Shield size={18} className="text-brand-500" /> {draft.name}
                    {draft.is_system && <Badge tone="slate">built-in</Badge>}
                  </h2>
                )}
              </div>
              {!creating && !draft.is_system && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => clone(roles.find((r) => r.id === sel))}>
                    <Copy size={14} /> Clone
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => remove(roles.find((r) => r.id === sel))}>
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              )}
              {!creating && draft.is_system && (
                <Button variant="secondary" size="sm" onClick={() => clone(roles.find((r) => r.id === sel))}>
                  <Copy size={14} /> Clone to customise
                </Button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <Field label="Description">
                <Input value={draft.description || ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="What this role is for" />
              </Field>
              <Field label="Data scope">
                <select value={draft.scope_level}
                  disabled={draft.is_system && !creating}
                  onChange={(e) => setDraft({ ...draft, scope_level: e.target.value })}
                  className="w-full h-11 rounded-lg border border-slate-200 bg-surface px-3 text-sm disabled:opacity-60">
                  {SCOPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </Field>
            </div>

            {!creating && !draft.is_system && (
              <label className="flex items-center gap-2 text-sm text-slate-600 mb-5 cursor-pointer">
                <input type="checkbox" checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300" />
                <Power size={14} /> Active (an inactive role grants no permissions at login)
              </label>
            )}

            {/* Permission matrix */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink-900">
                  Permissions <span className="text-slate-400 font-normal">· {draft.permissions.length} selected</span>
                </h3>
                {draft.is_system && !creating &&
                  <span className="text-xs text-slate-400">Built-in role — permissions editable, scope locked</span>}
              </div>
              <div className="space-y-4">
                {Object.entries(byDomain).map(([domain, list]) => (
                  <div key={domain}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{domain}</p>
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
                      {list.map((p) => (
                        <label key={p.code}
                          className="flex items-start gap-2 text-sm py-1 cursor-pointer group">
                          <input type="checkbox" checked={draft.permissions.includes(p.code)}
                            onChange={() => toggle(p.code)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
                          <span className="min-w-0">
                            <span className="text-ink-800 group-hover:text-brand-700">{p.description}</span>
                            <span className="block font-mono text-[11px] text-slate-400">{p.code}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              {creating && (
                <Button variant="secondary" onClick={() => { setCreating(false); setDraft(null); }}>
                  <X size={15} /> Cancel
                </Button>
              )}
              <Button onClick={save} disabled={busy || !dirty}>
                <Save size={15} /> {busy ? "Saving…" : creating ? "Create role" : "Save changes"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
