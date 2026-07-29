import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, ArrowRight, CheckCircle2, Copy, IdCard, AlertTriangle } from "lucide-react";
import { Card, Button, Field, Input } from "../components/ui/primitives.jsx";
import { Logo } from "../components/ui/Logo.jsx";
import { api, tokens } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

// Public, no-login entry point. A walk-in student registers for the active drive
// and receives a Student ID; that ID (no password) is how they return. On success
// we store the issued session so the assessment flow just works.
export default function AttendDrive() {
  const nav = useNavigate();
  const { reload } = useAuth();
  const [mode, setMode] = useState("register"); // register | resume
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", roll_number: "" });
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null); // { student_id, drive, full_name }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function startSession(res) {
    tokens.set(res);          // { access_token, refresh_token }
    await reload();           // become the student
    setDone(res);
  }

  async function register(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const res = await api.attendDrive(form);
      await startSession(res);
    } catch (e2) {
      setErr(e2?.status === 409
        ? (e2.message || "Registration is closed right now.")
        : (e2?.details?.[0]?.msg || e2?.message || "Could not register — check your details."));
    } finally { setBusy(false); }
  }

  async function resume(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const res = await api.attendResume(studentId.trim());
      await startSession(res);
    } catch (e2) {
      setErr(e2?.message || "That Student ID was not found.");
    } finally { setBusy(false); }
  }

  // ---- success screen ----
  if (done) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-teal-500/10 text-teal-600">
            <CheckCircle2 size={30} />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">You're registered!</h1>
          <p className="mt-1 text-slate-500">
            {done.drive?.title ? <>for <span className="font-medium text-ink-900">{done.drive.title}</span></> : "for the drive"}
            {done.drive?.company_name ? ` · ${done.drive.company_name}` : ""}
          </p>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400 flex items-center justify-center gap-1.5">
              <IdCard size={14} /> Your Student ID
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="font-display text-2xl font-bold text-brand-600 tracking-wide">{done.student_id}</span>
              <button onClick={() => navigator.clipboard?.writeText(done.student_id)}
                className="text-slate-400 hover:text-ink-900" title="Copy">
                <Copy size={16} />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Save this ID — use it to sign back in (no password needed).
            </p>
          </div>

          <Button className="w-full mt-6" size="lg" onClick={() => nav("/drive")}>
            Continue to assessment <ArrowRight size={18} />
          </Button>
        </Card>
      </Shell>
    );
  }

  // ---- register / resume forms ----
  return (
    <Shell>
      <Card className="p-8">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center h-11 w-11 rounded-md bg-ink-900 text-white">
            <GraduationCap size={22} />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-ink-900">Attend Drive</h1>
            <p className="text-sm text-slate-500">Register for the recruitment drive — no account needed.</p>
          </div>
        </div>

        <div className="mt-6 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button onClick={() => { setMode("register"); setErr(""); }}
            className={`flex-1 h-9 rounded-md font-medium ${mode === "register" ? "bg-white shadow text-ink-900" : "text-slate-500"}`}>
            New registration
          </button>
          <button onClick={() => { setMode("resume"); setErr(""); }}
            className={`flex-1 h-9 rounded-md font-medium ${mode === "resume" ? "bg-white shadow text-ink-900" : "text-slate-500"}`}>
            I have a Student ID
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-md bg-rose-500/10 text-rose-700 p-3 text-sm flex items-center gap-2">
            <AlertTriangle size={15} /> {err}
          </div>
        )}

        {mode === "register" ? (
          <form onSubmit={register} className="mt-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name"><Input value={form.first_name} onChange={set("first_name")} required /></Field>
              <Field label="Last name"><Input value={form.last_name} onChange={set("last_name")} required /></Field>
            </div>
            <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} required /></Field>
            <Field label="Roll number">
              <Input value={form.roll_number} onChange={set("roll_number")} placeholder="e.g. 21CS045" required />
              <p className="mt-1 text-xs text-slate-400">Letters and digits only — no spaces or symbols.</p>
            </Field>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? "Registering…" : <>Register &amp; get Student ID <ArrowRight size={18} /></>}
            </Button>
          </form>
        ) : (
          <form onSubmit={resume} className="mt-5 space-y-3">
            <Field label="Student ID">
              <Input value={studentId} onChange={(e) => setStudentId(e.target.value)}
                placeholder="LARE-2026-0001" required />
            </Field>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? "Signing in…" : <>Continue <ArrowRight size={18} /></>}
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-slate-400">
          Staff or college? <Link to="/login" className="text-brand-600 hover:underline">Sign in here</Link>
        </p>
      </Card>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo size={132} />
          <p className="mt-3 font-display font-bold text-3xl text-ink-900">LARE Hire</p>
          <p className="text-base text-amber-600 font-medium">Find the right talent, faster.</p>
        </div>
        {children}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          A unit of LARE Consulting &amp; Technology Pvt. Ltd.
        </p>
      </div>
    </div>
  );
}
