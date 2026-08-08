// Minimal, safe Markdown -> HTML for lesson text blocks. Escapes first, so no
// raw HTML from the model is ever injected. Supports headings, bold/italic,
// inline code, fenced code, lists, tables, blockquotes, links and images.

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s) {
  return s
    // images ![alt](url)  (http/https/data only)
    .replace(/!\[([^\]]*)\]\((https?:[^)\s]+|data:image\/[^)\s]+)\)/g,
      (_, a, u) => `<img src="${u}" alt="${a}" class="lb-img" />`)
    // links [text](url)
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      (_, t, u) => `<a href="${u}" target="_blank" rel="noreferrer">${t}</a>`)
    // inline code
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    // bold then italic
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

export function renderMarkdown(md) {
  const src = esc(md || "");
  const lines = src.split("\n");
  const out = [];
  let i = 0;

  const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);

  while (i < lines.length) {
    let line = lines[i];

    // fenced code
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { body.push(lines[i]); i++; }
      i++; // closing fence
      out.push(`<pre class="lb-pre"><code>${body.join("\n")}</code></pre>`);
      continue;
    }

    // table
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const cells = (l) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") { rows.push(cells(lines[i])); i++; }
      let t = '<div class="lb-tablewrap"><table class="lb-table"><thead><tr>';
      t += head.map((h) => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>";
      t += rows.map((r) => "<tr>" + head.map((_, k) => `<td>${inline(r[k] || "")}</td>`).join("") + "</tr>").join("");
      t += "</tbody></table></div>";
      out.push(t);
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const n = h[1].length; out.push(`<h${n} class="lb-h${n}">${inline(h[2])}</h${n}>`); i++; continue; }

    // horizontal rule
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr class="lb-hr" />'); i++; continue; }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      out.push(`<blockquote class="lb-quote">${inline(body.join(" "))}</blockquote>`);
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, "")); i++; }
      out.push(`<ul class="lb-ul">${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`);
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      out.push(`<ol class="lb-ol">${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ol>`);
      continue;
    }

    // blank line
    if (line.trim() === "") { i++; continue; }

    // paragraph (accumulate until blank / block start)
    const para = [];
    while (i < lines.length && lines[i].trim() !== "" &&
           !/^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>|```)/.test(lines[i]) &&
           !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
      para.push(lines[i]); i++;
    }
    out.push(`<p class="lb-p">${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}
