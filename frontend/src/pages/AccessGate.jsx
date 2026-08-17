import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, ShieldCheck, LogOut, ArrowRight } from "lucide-react";
import { Card, Button, Field, Input } from "../components/ui/primitives.jsx";
import { Logo } from "../components/ui/Logo.jsx";
import { Orbs } from "../components/ui/Decor.jsx";
import { useAuth } from "../lib/auth.jsx";
import { api, accessGrant } from "../lib/api.js";

// LARE Learn Access Gate. After signing in, a student must enter their class
// Access ID (one shared code per College → Year → Branch → Section) to enter
// the learning environment. Required every session; staff/admins skip this.
export default function AccessGate() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(null); // resolved class info on success

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await api.validateAccess(code.trim());
      if (res?.grant) accessGrant.set(res.grant);
      setOk(res);
      setTimeout(() => nav("/lms"), 900); // brief confirmation, then enter
    } catch (err) {
      setError(err.message || "Invalid access code. Please check and try again.");
      setBusy(false);
    }
  };

  const firstName = (user?.full_name || user?.email || "there").split(/[\s@]/)[0];

  return (
    <div className="min-h-screen grid place-items-center bg-invert-900 px-4 relative overflow-hidden">
      <div className="bg-grid absolute inset-0 opacity-[0.12]" />
      <Orbs tone="cool" className="opacity-70" />
      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-6"><Logo dark size={110} /></div>
        <Card className="p-8">
          <span className="grid place-items-center h-14 w-14 rounded-2xl bg-brand-500/10 text-brand-600 mb-4">
            <KeyRound size={26} />
          </span>
          <h1 className="font-display text-xl font-bold text-ink-900">Enter your class Access ID</h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome, {firstName}. To open your learning dashboard, enter the Access ID your college
            provided for your class.
          </p>

          {ok ? (
            <div className="mt-6 rounded-xl border border-teal-200 bg-teal-500/10 p-4">
              <p className="flex items-center gap-2 text-teal-800 font-medium">
                <ShieldCheck size={18} /> Access granted
              </p>
              <p className="text-sm text-teal-700 mt-1">
                {[ok.college_name, ok.branch_name || ok.branch_code, ok.year_no ? `Year ${ok.year_no}` : null,
                  ok.section ? `Section ${ok.section}` : null].filter(Boolean).join(" · ")}
              </p>
              <p className="text-xs text-slate-500 mt-2">Opening your dashboard…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {error && (
                <div className="rounded-md bg-rose-500/10 text-rose-600 text-sm px-3.5 py-2.5">{error}</div>
              )}
              <Field label="Access ID" htmlFor="code">
                <Input
                  id="code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CSE3B-7KQ9"
                  className="tracking-wider font-mono"
                />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={busy || !code.trim()}>
                {busy ? "Verifying…" : "Enter"} <ArrowRight size={18} />
              </Button>
            </form>
          )}

          <button
            onClick={async () => { await logout(); nav("/learn/login"); }}
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900"
          >
            <LogOut size={14} /> Sign out
          </button>
        </Card>
        <p className="mt-5 text-center text-xs text-slate-400">
          Don't have an Access ID? Contact your college coordinator / TPO.
        </p>
      </div>
    </div>
  );
}
