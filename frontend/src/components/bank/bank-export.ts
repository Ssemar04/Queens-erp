// Lightweight client-side exporters: CSV, Excel (HTML-table .xls), PDF (print-to-pdf).
export interface ExportRow {
  [key: string]: string | number;
}

function escapeCSV(v: string | number) {
  const s = String(v ?? "");
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const dateSlug = () => new Date().toISOString().slice(0, 10);

export function exportCSV(name: string, rows: ExportRow[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(",")),
  ];
  download(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }), `${name}-${dateSlug()}.csv`);
}

export function exportExcel(name: string, title: string, rows: ExportRow[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const thead = `<tr>${headers.map((h) => `<th style="background:#0b1733;color:#fff;padding:6px;text-align:left;">${h}</th>`).join("")}</tr>`;
  const tbody = rows
    .map(
      (r) =>
        `<tr>${headers
          .map((h) => `<td style="border:1px solid #e5e7eb;padding:6px;">${r[h] ?? ""}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  const html = `<html><head><meta charset="UTF-8"><title>${title}</title></head><body><h2>${title}</h2><table>${thead}${tbody}</table></body></html>`;
  download(new Blob([html], { type: "application/vnd.ms-excel" }), `${name}-${dateSlug()}.xls`);
}

export function exportPDF(title: string, rows: ExportRow[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const style = `
    body{font-family:ui-sans-serif,system-ui,-apple-system;margin:32px;color:#0b1733}
    h1{font-size:18px;margin:0 0 4px;color:#0b1733}
    .meta{color:#64748b;font-size:11px;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#0b1733;color:#fff;padding:8px;text-align:left;border:1px solid #0b1733}
    td{padding:6px 8px;border:1px solid #e5e7eb}
    tr:nth-child(even) td{background:#f8fafc}
    .brand{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b91c1c;padding-bottom:10px;margin-bottom:16px}
    .brand strong{color:#b91c1c;letter-spacing:.04em}
  `;
  const thead = `<tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${headers.map((h) => `<td>${r[h] ?? ""}</td>`).join("")}</tr>`).join("");
  w.document.write(`<html><head><title>${title}</title><style>${style}</style></head><body>
    <div class="brand"><strong>STACKWISE · BANK</strong><span>${new Date().toLocaleString()}</span></div>
    <h1>${title}</h1>
    <div class="meta">${rows.length} record${rows.length === 1 ? "" : "s"}</div>
    <table>${thead}${tbody}</table>
    <script>window.onload=()=>{window.print();}</script>
  </body></html>`);
  w.document.close();
}

export function exportAll(name: string, title: string, rows: ExportRow[], fmt: "csv" | "excel" | "pdf") {
  if (fmt === "csv") return exportCSV(name, rows);
  if (fmt === "excel") return exportExcel(name, title, rows);
  return exportPDF(title, rows);
}
