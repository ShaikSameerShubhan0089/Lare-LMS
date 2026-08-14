import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { AuthLayout } from "./AuthLayout.jsx";
import { Button, Field, Input } from "../components/ui/primitives.jsx";
import { useAuth } from "../lib/auth.jsx";

const NAME = { learn: "LARE Learn", hire: "LARE Hire" };

export default function Login({ product = "learn" }) {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const home = product === "hire" ? "/drive" : "/lms";
  const registerTo = product === "hire" ? "/hire/register" : "/learn/register";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form.email, form.password, product);
      nav(home);
    } catch (err) {
      setError(err.message || "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      product={product}
      title={`Sign in to ${NAME[product]}`}
      subtitle="Separate account per app — this signs you into this product only."
      footer={
        <>
          New here?{" "}
          <Link to={registerTo} className="font-semibold text-brand-600 hover:underline">
            Create a {NAME[product]} account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-md bg-rose-500/10 text-rose-600 text-sm px-3.5 py-2.5">
            {error}
          </div>
        )}
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@college.edu"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
          />
        </Field>
        <div className="flex justify-end -mt-1">
          <Link to={`/forgot-password?app=${product}`} className="text-sm text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <LogIn size={18} /> {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
