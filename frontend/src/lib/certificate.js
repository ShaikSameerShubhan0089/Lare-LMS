// One source of truth for the certificate artwork — an inline-styled HTML string
// used both in the on-screen modal (dangerouslySetInnerHTML) and in the print
// window (so the print looks identical without needing the app's CSS).

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function certificateHtml(c, { origin } = {}) {
  const holder = esc(c.holder_name || "LARE Learner");
  const name = esc(c.certificate || `Year ${c.year_no} Certificate`);
  const certNo = esc(c.cert_no || "");
  const date = esc((c.issued_at || "").slice(0, 10) || "");
  const verifyId = esc(c.verify_id || "");
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const verifyUrl = verifyId ? `${base}/verify/${verifyId}` : "";
  const ppo = c.ppo_tag
    ? `<div style="margin-top:8px;display:inline-block;background:#f59e0b22;color:#b45309;padding:3px 10px;border-radius:999px;font-size:12px;font-family:Arial,sans-serif;">PPO eligible</div>`
    : "";
  return `
  <div style="width:820px;max-width:100%;box-sizing:border-box;background:#ffffff;padding:14px;font-family:Georgia,'Times New Roman',serif;color:#0f172a;">
    <div style="border:2px solid #2563eb;box-sizing:border-box;">
      <div style="border:1px solid #cbd5e1;margin:6px;padding:38px 46px;box-sizing:border-box;text-align:center;position:relative;">
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <div style="width:30px;height:30px;border-radius:8px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;font-weight:700;">L</div>
          <div style="font-family:Arial,sans-serif;font-weight:700;letter-spacing:2px;color:#1e293b;">LARE LEARN</div>
        </div>
        <div style="margin-top:26px;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#64748b;font-family:Arial,sans-serif;">Certificate of Achievement</div>
        <div style="margin-top:22px;font-size:14px;color:#475569;">This is proudly presented to</div>
        <div style="margin-top:12px;font-size:40px;font-weight:700;color:#1d4ed8;line-height:1.1;">${holder}</div>
        <div style="margin:14px auto 0;width:120px;border-bottom:2px solid #e2e8f0;"></div>
        <div style="margin-top:20px;font-size:15px;color:#475569;">for successfully completing</div>
        <div style="margin-top:8px;font-size:22px;font-weight:600;color:#0f172a;">${name}</div>
        <div style="margin-top:4px;font-size:14px;color:#64748b;font-family:Arial,sans-serif;">Year ${esc(c.year_no)} of the LARE 4-Year Programme</div>
        ${ppo}
        <div style="margin-top:34px;display:flex;justify-content:space-between;align-items:flex-end;font-family:Arial,sans-serif;">
          <div style="text-align:left;">
            <div style="font-size:12px;color:#94a3b8;">Certificate No.</div>
            <div style="font-size:13px;color:#334155;font-weight:600;">${certNo}</div>
          </div>
          <div style="text-align:center;">
            <div style="width:56px;height:56px;border-radius:50%;border:2px solid #2563eb;color:#2563eb;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:22px;">&#10003;</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Verified</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;color:#94a3b8;">Issued</div>
            <div style="font-size:13px;color:#334155;font-weight:600;">${date}</div>
          </div>
        </div>
        ${verifyUrl ? `<div style="margin-top:22px;font-size:11px;color:#94a3b8;font-family:Arial,sans-serif;">Verify authenticity at ${esc(verifyUrl)}</div>` : ""}
      </div>
    </div>
  </div>`;
}

export function printCertificate(c) {
  const w = window.open("", "_blank", "width=1000,height=720");
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><title>Certificate ${esc(c.cert_no || "")}</title>` +
    `<style>@page{size:A4 landscape;margin:12mm;} body{margin:0;display:flex;justify-content:center;}</style>` +
    `</head><body>${certificateHtml(c, { origin: window.location.origin })}</body></html>`
  );
  w.document.close();
  w.focus();
  // give the browser a tick to lay out before printing
  setTimeout(() => { w.print(); }, 300);
}
