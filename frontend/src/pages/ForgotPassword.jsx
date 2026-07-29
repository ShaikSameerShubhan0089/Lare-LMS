import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Card, Button, Field, Input } from "../components/ui/primitives.jsx";
import { Logo } from "../components/ui/Logo.jsx";
import { api } from "../lib/api.js";

// Two-step self-service reset: request a token by email, then set a new password.
export default function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState("request"); // request | reset | done
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [devToken, setDevToken] = useState(null);

  async function requestReset(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await api.forgotPassword(email);
      if (r?.dev_reset_token) setDevToken(r.dev_reset_token); // dev convenience
      setStep("reset");
    } catch {
      setStep("reset"); // uniform response — never reveal if the email exists
    } finally { setBusy(false); }
  }

  async function doReset(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await api.resetPassword(token, pw);
      setStep("done");
      setTimeout(() => nav("/login"), 1800);
    } catch (ex) {
      setErr(ex.message || "Reset failed — check your token.");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6"><Logo size={104} /></div>
        <Card className="p-8">
          {step === "request" && (
            <>
              <h1 className="text-xl font-display font-bold text-ink-900 mb-1">Reset your password</h1>
              <p className="text-sm text-slate-500 mb-6">We'll send a reset link to your email.</p>
              <form onSubmit={requestReset} className="space-y-4">
                <Field label="Email">
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.edu" />
                </Field>
                <Button type="submit" className="w-full" disabled={busy}>
                  <Mail size={16} /> Send reset link
                </Button>
              </form>
            </>
          )}

          {step === "reset" && (
            <>
              <h1 className="text-xl font-display font-bold text-ink-900 mb-1">Enter reset token</h1>
              <p className="text-sm text-slate-500 mb-6">Paste the token from your email and choose a new password.</p>
              {devToken && (
                <div className="mb-4 rounded-md bg-amber-500/10 text-amber-700 p-3 text-xs break-all">
                  Dev token: {devToken}
                </div>
              )}
              <form onSubmit={doReset} className="space-y-4">
                <Field label="Reset token">
                  <Input required value={token} onChange={(e) => setToken(e.target.value)} />
                </Field>
                <Field label="New password" error={err}>
                  <Input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
                </Field>
                <Button type="submit" className="w-full" disabled={busy}>
                  <KeyRound size={16} /> Set new password
                </Button>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="text-center py-6">
              <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-teal-500/10 text-teal-600 mb-3">
                <CheckCircle2 size={30} />
              </div>
              <p className="font-display font-semibold text-ink-900">Password updated</p>
              <p className="text-sm text-slate-500 mt-1">Redirecting to sign in…</p>
            </div>
          )}

          <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink-900">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </Card>
      </div>
    </div>
  );
}
