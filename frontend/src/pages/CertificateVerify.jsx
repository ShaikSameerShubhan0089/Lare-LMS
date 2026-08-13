import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck, ShieldX, Printer } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { Button } from "../components/ui/primitives.jsx";
import { api } from "../lib/api.js";
import { certificateHtml, printCertificate } from "../lib/certificate.js";

// PUBLIC page (no login) — anyone can confirm a LARE certificate is authentic.
export default function CertificateVerify() {
  const { verifyId } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    (async () => {
      try { setState({ loading: false, data: await api.verifyCertificate(verifyId) }); }
      catch { setState({ loading: false, data: null, error: true }); }
    })();
  }, [verifyId]);

  const d = state.data;
  const valid = d && d.valid;
  // build a cert-shaped object for the shared artwork
  const cert = d && {
    holder_name: d.holder_name, certificate: d.certificate, cert_no: d.cert_no,
    year_no: d.year_no, issued_at: d.issued_at, ppo_tag: d.ppo_eligible, verify_id: verifyId,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <Logo />
          <span className="text-xs text-slate-400">Certificate verification</span>
        </div>

        {state.loading ? (
          <div className="rounded-2xl bg-surface border border-slate-200 p-10 text-center text-slate-400">Verifying…</div>
        ) : valid ? (
          <div>
            <div className="rounded-xl bg-teal-500/10 border border-teal-200 p-4 mb-4 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-teal-800 font-medium">
                <ShieldCheck size={18} className="text-teal-600" /> Authentic — issued by LARE Learn
              </span>
              <Button variant="secondary" onClick={() => printCertificate(cert)}><Printer size={15} /> Print</Button>
            </div>
            <div className="rounded-lg shadow-xl overflow-hidden"
                 dangerouslySetInnerHTML={{ __html: certificateHtml(cert) }} />
          </div>
        ) : (
          <div className="rounded-2xl bg-surface border border-rose-200 shadow-sm p-8 text-center">
            <span className="mx-auto grid place-items-center h-12 w-12 rounded-full bg-rose-500/10 text-rose-600"><ShieldX size={26} /></span>
            <p className="mt-3 font-display text-lg font-bold text-ink-900">Could not verify</p>
            <p className="mt-1 text-sm text-slate-500">
              {state.error ? "This certificate could not be found." : "This certificate is not valid or has been revoked."}
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by <Link to="/" className="text-brand-600 hover:underline">LARE</Link> — verified human competence.
        </p>
      </div>
    </div>
  );
}
