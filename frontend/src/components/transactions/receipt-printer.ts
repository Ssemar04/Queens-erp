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
) {
  const r = getReceiptSummary(t, itemNameMap);
  const printedAt = format(new Date(), "dd/MM/yyyy HH:mm");
  const soldAt = format(new Date(r.time), "dd/MM/yyyy HH:mm");
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) return;

  const subtotal = r.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  const totalDiscount = r.lineItems.reduce((s, li) => s + li.discount, 0);
  const totalVat = r.lineItems.reduce((s, li) => s + li.vat, 0);
  const verifyUrl = verificationUrl(r.receipt, company);
  const locationLine = [company.location, company.floorNumber, company.roomNumber].filter(Boolean).join(" - ");
  const contactLine = company.contactLine || [company.phone, company.email].filter(Boolean).join(" / ");

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
        <title>Epson M267E Receipt - ${escapeHtml(r.receipt)}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f5f5f4;
            color: #111;
            font-family: "Arial Narrow", Arial, sans-serif;
            font-size: 11px;
          }
          .receipt {
            width: 80mm;
            max-width: 80mm;
            margin: 18px auto;
            background: #fff;
            padding: 5mm 4mm 7mm;
            box-shadow: 0 12px 34px rgba(0,0,0,.16);
          }
          .center { text-align: center; }
          .company { margin: 0; font-size: 17px; line-height: 1.08; font-weight: 800; text-transform: uppercase; }
          .muted { color: #444; }
          .subtle { color: #555; font-size: 10px; line-height: 1.25; }
          .rule { border-top: 1px dashed #111; margin: 8px 0; }
          .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
          .receipt-id { margin-top: 5px; font-size: 12px; font-weight: 700; }
          .row, .item {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 6px;
            align-items: start;
            padding: 2px 0;
          }
          .item { grid-template-columns: 1fr 44px 58px; border-bottom: 1px dotted #bbb; padding: 4px 0; }
          .item-name { min-width: 0; font-weight: 700; overflow-wrap: anywhere; }
          .item-meta { text-align: right; white-space: nowrap; }
          .item-amount { text-align: right; font-weight: 700; white-space: nowrap; }
          .total { border-top: 1px solid #111; border-bottom: 2px solid #111; margin-top: 3px; padding: 5px 0; font-size: 14px; font-weight: 800; }
          .barcode { margin-top: 10px; text-align: center; }
          .barcode svg { width: 68mm; max-width: 100%; height: 14mm; }
          .verify { margin-top: 3px; font-size: 9px; line-height: 1.25; overflow-wrap: anywhere; }
          .slogan { margin: 10px 0 0; font-weight: 800; text-transform: uppercase; }
          @media print {
            body { background: #fff; }
            .receipt { margin: 0; width: 80mm; max-width: 80mm; box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <header class="center">
            <h1 class="company">${escapeHtml(company.name)}</h1>
            ${company.address ? `<div class="subtle">${escapeHtml(company.address)}</div>` : ""}
            ${locationLine ? `<div class="subtle">${escapeHtml(locationLine)}</div>` : ""}
            ${contactLine ? `<div class="subtle">Contact: ${escapeHtml(contactLine)}</div>` : ""}
            ${company.taxId ? `<div class="subtle">Tax ID: ${escapeHtml(company.taxId)}</div>` : ""}
            <div class="receipt-id mono">RECEIPT ${escapeHtml(r.receipt)}</div>
          </header>

          <div class="rule"></div>
          <div class="row"><span>Sold</span><strong>${escapeHtml(soldAt)}</strong></div>
          <div class="row"><span>Printed</span><strong>${escapeHtml(printedAt)}</strong></div>
          <div class="row"><span>Customer</span><strong>${escapeHtml(r.customer)}</strong></div>
          <div class="row"><span>Staff</span><strong>${escapeHtml(r.staff)}</strong></div>
          <div class="row"><span>Status</span><strong>${escapeHtml(r.status)}</strong></div>
          <div class="rule"></div>

          ${linesHtml}

          <div class="rule"></div>
          <div class="row"><span>Subtotal</span><strong>${escapeHtml(fmtMoney(subtotal))}</strong></div>
          <div class="row"><span>Discount</span><strong>${escapeHtml(fmtMoney(totalDiscount))}</strong></div>
          <div class="row"><span>VAT</span><strong>${escapeHtml(fmtMoney(totalVat))}</strong></div>
          <div class="row total"><span>Total</span><span>${escapeHtml(fmtMoney(r.total))}</span></div>
          <div class="row"><span>Paid</span><strong>${escapeHtml(fmtMoney(r.deposit))}</strong></div>
          <div class="row"><span>Balance</span><strong>${escapeHtml(fmtMoney(r.balance))}</strong></div>
          <div class="row"><span>Payment</span><strong>${escapeHtml(METHOD_LABEL[r.method] ?? r.method)}</strong></div>

          <footer class="center">
            <div class="barcode">${renderBarcodeSVG(r.receipt)}</div>
            <div class="mono">${escapeHtml(r.receipt)}</div>
            <div class="verify">Scan the barcode in Transactions search, or verify at ${escapeHtml(verifyUrl)}</div>
            <p class="slogan">${escapeHtml(company.receiptSlogan || "Thank you for your business.")}</p>
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
