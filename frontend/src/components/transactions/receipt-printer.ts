import { format } from "date-fns";
import type { CompanyDetails } from "@/contexts/ThemeContext";
import { escapeHtml } from "@/lib/html-escape";
import type { SaleItem, TransactionStatus } from "@/types/inventory";
import type { GroupedTransaction } from "@/routes/app.movements";

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  mobile: "Mobile",
  bank_transfer: "Bank",
  credit: "Credit",
};

const CODE128B_START = 104;
const CODE128B_STOP = [2, 3, 3, 1, 1, 1, 2];
const START_B_PATTERN = [2, 1, 1, 4, 1, 2];
const CODE128B_PATTERNS: number[][] = [
  [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
  [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
  [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
  [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
  [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
  [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
  [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
  [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
  [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
  [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
  [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
  [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
  [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
  [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
  [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
  [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
  [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
  [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
  [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
  [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
  [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],
  [2,1,1,2,3,2],[2,3,3,1,1,1,2],
];

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(n || 0);

export function getLastName(name: string): string {
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export interface ReceiptSummary {
  receipt: string;
  item: string;
  itemSummary: string;
  qty: number;
  total: number;
  deposit: number;
  balance: number;
  method: string;
  customer: string;
  staff: string;
  status: TransactionStatus;
  assets: string[];
  time: string;
  lineItems: SaleItem[];
  telephone: string;
  email: string;
  reference: string;
}

function encodeCode128B(text: string): number[] {
  const bars: number[] = [...START_B_PATTERN];
  let checksum = CODE128B_START;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code < 0 || code > 106) continue;
    const pattern = CODE128B_PATTERNS[code];
    if (pattern) bars.push(...pattern);
    checksum += code * (i + 1);
  }

  const checksumPattern = CODE128B_PATTERNS[checksum % 103];
  if (checksumPattern) bars.push(...checksumPattern);
  bars.push(...CODE128B_STOP);
  return bars;
}

function renderBarcodeSVG(text: string, height = 42): string {
  const bars = encodeCode128B(text);
  let x = 10;
  const rects: string[] = [];
  for (let i = 0; i < bars.length; i++) {
    const width = bars[i];
    if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${width}" height="${height}"/>`);
    x += width;
  }
  const totalWidth = x + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}" height="${height}" aria-label="Receipt barcode">${rects.join("")}</svg>`;
}

function getLineItems(t: GroupedTransaction, itemNameMap: Map<string, string>): SaleItem[] {
  if (t.saleDetails?.lineItems && t.saleDetails.lineItems.length > 0) {
    return t.saleDetails.lineItems;
  }

  return t.movements.map((m) => {
    const qty = Math.abs(m.quantity);
    const unitPrice = m.sale?.unitPrice ?? (qty > 0 ? (m.sale?.totalAmount ?? 0) / qty : 0);
    return {
      itemId: m.itemId || null,
      itemName: itemNameMap.get(m.itemId) ?? m.sale?.itemName ?? "Unknown",
      unitPrice,
      quantity: qty,
      discount: m.sale?.discount ?? 0,
      vat: m.sale?.vat ?? 0,
      vatRate: m.sale?.vatRate ?? 0,
      assetId: m.sale?.assetId ?? null,
      assetName: m.sale?.assetName ?? null,
      lineTotal: m.sale?.totalAmount ?? 0,
    };
  });
}

export function getReceiptSummary(t: GroupedTransaction, itemNameMap: Map<string, string>): ReceiptSummary {
  const items = getLineItems(t, itemNameMap);
  return {
    receipt: t.receiptNumber,
    item: items.length === 1 ? items[0].itemName : `${items.length} items`,
    itemSummary: items.map((i) => i.itemName).join(", "),
    qty: t.totalItems,
    total: t.totalAmount,
    deposit: t.deposit,
    balance: t.balance,
    method: t.paymentMethod,
    customer: t.customer,
    staff: t.staff,
    status: t.status as TransactionStatus,
    assets: items.map((i) => i.assetName).filter(Boolean) as string[],
    time: t.createdAt,
    lineItems: items,
    telephone: t.saleDetails?.telephone ?? "",
    email: t.saleDetails?.email ?? "",
    reference: t.receiptNumber,
  };
}

import type { Location } from "@/types/inventory";

export function getBranchReceiptCompanyDetails(
  company: CompanyDetails,
  branch?: Location | null
): CompanyDetails {
  if (!branch) return company;

  const branchAddress = [branch.street, branch.building, branch.floor, branch.roomNumber]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(", ");

  const contactLine =
    branch.contactLine?.trim() ||
    [branch.phone, branch.email].filter((s) => Boolean(s && s.trim())).join(" / ") ||
    company.contactLine;

  return {
    name: branch.receiptTitle?.trim() || branch.name || company.name,
    email: branch.email?.trim() || company.email,
    phone: branch.phone?.trim() || company.phone,
    address: branchAddress || branch.address || company.address,
    location: branch.name || company.location,
    floorNumber: branch.floor || company.floorNumber,
    roomNumber: branch.roomNumber || company.roomNumber,
    contactLine,
    receiptSlogan: branch.receiptSlogan?.trim() || company.receiptSlogan,
    receiptVerificationBaseUrl: branch.receiptVerificationBaseUrl?.trim() || company.receiptVerificationBaseUrl,
    taxId: branch.taxId?.trim() || company.taxId,
  };
}

function verificationUrl(receipt: string, company: CompanyDetails) {
  const configured = company.receiptVerificationBaseUrl.trim();
  const base = configured || (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return `/app/movements?receipt=${encodeURIComponent(receipt)}`;
  return `${base.replace(/\/$/, "")}/app/movements?receipt=${encodeURIComponent(receipt)}`;
}

export function printReceipt(
  t: GroupedTransaction,
  itemNameMap: Map<string, string>,
  company: CompanyDetails,
  branch?: Location | null,
) {
  const effectiveCompany = getBranchReceiptCompanyDetails(company, branch);
  const r = getReceiptSummary(t, itemNameMap);
  const soldAt = format(new Date(r.time), "dd/MM/yyyy HH:mm");
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) return;

  const subtotal = r.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  const totalDiscount = r.lineItems.reduce((s, li) => s + li.discount, 0);
  const totalVat = r.lineItems.reduce((s, li) => s + li.vat, 0);
  const verifyUrl = verificationUrl(r.receipt, effectiveCompany);
  const locationLine = [effectiveCompany.location, effectiveCompany.floorNumber, effectiveCompany.roomNumber].filter(Boolean).join(" - ");
  const contactLine = effectiveCompany.contactLine || [effectiveCompany.phone, effectiveCompany.email].filter(Boolean).join(" / ");

  const linesHtml = r.lineItems.map((li) => {
    const assetHtml = li.assetName ? `<div class="subtle">Asset: ${escapeHtml(li.assetName)}</div>` : "";
    return `
      <section class="item">
        <div class="item-name">${escapeHtml(li.itemName)}${assetHtml}</div>
        <div class="item-meta">${li.quantity} x ${escapeHtml(fmtMoney(li.unitPrice))}</div>
        <div class="item-amount">${escapeHtml(fmtMoney(li.lineTotal))}</div>
      </section>
    `;
  }).join("");

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Receipt - ${escapeHtml(r.receipt)}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          :root { --ink: #000; --ink-soft: #1a1a1a; --ink-line: #000; --ink-rule: #1a1a1a; }
          body {
            margin: 0;
            background: #fff;
            color: var(--ink);
            font-family: "Arial Narrow", Arial, sans-serif;
            font-size: 11px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt {
            width: 80mm;
            max-width: 80mm;
            margin: 0 auto;
            background: #fff;
            color: var(--ink);
            padding: 5mm 4mm 7mm;
            border: 1px solid #ddd;
          }
          .center { text-align: center; }
          .header-band {
            margin: -5mm -4mm 4mm;
            padding: 4mm 4mm 3.5mm;
            background: #fff;
            color: var(--ink);
            border-bottom: 2px solid var(--ink-line);
            text-align: center;
          }
          .company { margin: 0; font-size: 16px; line-height: 1.08; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; color: var(--ink); }
          .header-band .subtle { color: var(--ink-soft); font-size: 10px; }
          .muted { color: var(--ink-soft); }
          .subtle { color: var(--ink-soft); font-size: 10px; line-height: 1.25; }
          .rule-dash { border-top: 1px dashed var(--ink-rule); margin: 7px 0; }
          .rule-brand { border-top: 1px solid var(--ink-rule); margin: 8px 0; }
          .rule-thick { border-top: 2px solid var(--ink-line); margin: 4px 0; }
          .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--ink); }
          .receipt-id {
            margin-top: 4px; font-size: 12px; font-weight: 700;
            display: inline-block; padding: 2px 8px;
            background: #fff;
            border: 1px solid var(--ink-line);
            border-radius: 3px;
            color: var(--ink);
          }
          .row, .item {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 6px;
            align-items: start;
            padding: 2px 0;
            color: var(--ink);
          }
          .row strong { color: var(--ink); font-weight: 700; }
          .particulars-head {
            margin: 2px 0 4px;
            display: flex; align-items: center; justify-content: space-between;
            padding: 3px 0;
            border-top: 1px solid var(--ink-rule);
            border-bottom: 1px solid var(--ink-rule);
            background: #fff;
          }
          .particulars-title {
            font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;
            color: var(--ink);
            padding: 0 4px;
          }
          .particulars-count {
            font-size: 9px; color: var(--ink); opacity: 0.8;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            padding: 0 4px;
          }
          .item { grid-template-columns: 1fr 44px 58px; border-bottom: 1px dotted var(--ink-rule); padding: 4px 0; }
          .item-name { min-width: 0; font-weight: 700; overflow-wrap: anywhere; color: var(--ink); }
          .item-meta { text-align: right; white-space: nowrap; color: var(--ink-soft); }
          .item-amount { text-align: right; font-weight: 700; white-space: nowrap; color: var(--ink); }
          .total { border-top: 2px solid var(--ink-line); border-bottom: 3px double var(--ink-line); margin-top: 3px; padding: 5px 0; font-size: 14px; font-weight: 800; color: var(--ink); background: #fff; }
          .total span { color: var(--ink); font-weight: 800; }
          .barcode { margin-top: 10px; text-align: center; padding: 4px 2px; border-top: 1px solid var(--ink-rule); }
          .barcode svg { width: 68mm; max-width: 100%; height: 14mm; }
          .barcode svg rect { fill: #000; }
          .verify { margin-top: 3px; font-size: 9px; line-height: 1.25; overflow-wrap: anywhere; color: var(--ink-soft); }
          .slogan { margin: 8px 0 0; font-weight: 800; text-transform: uppercase; color: var(--ink); letter-spacing: 0.3px; }
          @media print {
            body { background: #fff; }
            .receipt { margin: 0; width: 80mm; max-width: 80mm; box-shadow: none; border-radius: 0; border: none; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <header class="center header-band">
            <h1 class="company">${escapeHtml(effectiveCompany.name)}</h1>
            ${locationLine ? `<div class="subtle">${escapeHtml(locationLine)}</div>` : ""}
            ${contactLine ? `<div class="subtle">Contact: ${escapeHtml(contactLine)}</div>` : ""}
            ${effectiveCompany.taxId ? `<div class="subtle">${escapeHtml(effectiveCompany.taxId)}</div>` : ""}
            <div class="receipt-id mono">RECEIPT ${escapeHtml(r.receipt)}</div>
          </header>

          <div class="rule-dash"></div>
          <div class="row"><span class="muted">Date</span><strong>${escapeHtml(soldAt)}</strong></div>
          <div class="row"><span class="muted">Customer</span><strong>${escapeHtml(r.customer)}</strong></div>
          <div class="row"><span class="muted">Staff</span><strong>${escapeHtml(getLastName(r.staff))}</strong></div>

          <div class="particulars-head">
            <span class="particulars-title">◆ Particulars</span>
            <span class="particulars-count">${r.lineItems.length} line${r.lineItems.length === 1 ? "" : "s"}</span>
          </div>
          ${linesHtml}

          <div class="rule-brand"></div>
          <div class="row"><span class="muted">Subtotal</span><strong>${escapeHtml(fmtMoney(subtotal))}</strong></div>
          ${totalDiscount > 0 ? `<div class="row"><span class="muted">Discount</span><strong>${escapeHtml(fmtMoney(totalDiscount))}</strong></div>` : ""}
          ${totalVat > 0 ? `<div class="row"><span class="muted">VAT</span><strong>${escapeHtml(fmtMoney(totalVat))}</strong></div>` : ""}
          <div class="row total"><span>Total</span><span>${escapeHtml(fmtMoney(r.total))}</span></div>
          <div class="row"><span class="muted">Balance</span><strong>${escapeHtml(fmtMoney(r.balance))}</strong></div>
          <div class="row"><span class="muted">Payment</span><strong>${escapeHtml(METHOD_LABEL[r.method] ?? r.method)}</strong></div>

          <footer class="center">
            <div class="barcode">${renderBarcodeSVG(r.receipt)}</div>
            <div class="mono subtle">${escapeHtml(r.receipt)}</div>
            <p class="slogan">${escapeHtml(effectiveCompany.receiptSlogan || "Thank you for your business.")}</p>
          </footer>
        </main>
        <script>
          window.onload = () => {
            window.focus();
            window.print();
            window.setTimeout(() => window.close(), 350);
          };
        </script>
      </body>
    </html>
  `);
  popup.document.close();
}
