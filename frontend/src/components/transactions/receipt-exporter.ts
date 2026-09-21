import { format } from "date-fns";
import { toast } from "sonner";
import type { CompanyDetails } from "@/contexts/ThemeContext";
import type { GroupedTransaction } from "@/routes/app.movements";
import type { Location } from "@/types/inventory";
import { getReceiptSummary, getBranchReceiptCompanyDetails, type ReceiptSummary } from "./receipt-printer";

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  mobile: "Mobile",
  bank_transfer: "Bank",
  credit: "Credit",
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(n || 0);

function getLastName(name: string): string {
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// Code128 Encoding logic for barcode rendering on Canvas
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

/**
 * Renders a complete high-DPI receipt canvas.
 */
export function generateReceiptCanvas(
  t: GroupedTransaction,
  itemNameMap: Map<string, string>,
  company: CompanyDetails,
  branch?: Location | null
): HTMLCanvasElement {
  const companyInfo = getBranchReceiptCompanyDetails(company, branch);
  const r = getReceiptSummary(t, itemNameMap);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const width = 600;
  const padding = 32;
  const contentWidth = width - padding * 2;

  // Measure dynamic height (brand band 120 + meta ~88 + particulars ~62 + totals ~132 + barcode ~80 + slogan ~24 + paddings)
  let estimatedHeight = 120 + 320; // Brand header band + rest of static sections
  estimatedHeight += r.lineItems.length * 48;
  canvas.width = width;
  canvas.height = estimatedHeight;

  const BRAND = "#003399";
  const BRAND_SOFT = "rgba(0,51,153,0.08)";
  const BRAND_LINE = "rgba(0,51,153,0.25)";

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, estimatedHeight);

  let y = padding;

  // Branded Header Band
  const headerBandHeight = 120;
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, BRAND);
  grad.addColorStop(1, "#0042b3");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, headerBandHeight);

  // Company Name (white on brand)
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(companyInfo.name.toUpperCase(), width / 2, y + 20);
  y += 28;

  // Location & Contact
  const locationLine = [companyInfo.location, companyInfo.floorNumber, companyInfo.roomNumber].filter(Boolean).join(" - ");
  const contactLine = companyInfo.contactLine || [companyInfo.phone, companyInfo.email].filter(Boolean).join(" / ");

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  if (locationLine) {
    ctx.fillText(locationLine, width / 2, y + 12);
    y += 18;
  }
  if (contactLine) {
    ctx.fillText(`Contact: ${contactLine}`, width / 2, y + 12);
    y += 18;
  }

  y += 10;

  // Receipt ID Badge (inverted white pill)
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(width / 2 - 140, y, 280, 32, 6);
  } else {
    ctx.rect(width / 2 - 140, y, 280, 32);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 15px monospace";
  ctx.fillText(`RECEIPT ${r.receipt}`, width / 2, y + 21);
  y = headerBandHeight + padding;

  // Dashed Divider
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  ctx.setLineDash([]);
  y += 20;

  // Metadata Grid
  ctx.textAlign = "left";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#64748B";

  const metaItems = [
    { label: "Date & Time:", val: format(new Date(r.time), "MMM d, yyyy HH:mm") },
    { label: "Customer:", val: r.customer },
    { label: "Staff Member:", val: getLastName(r.staff) },
    { label: "Payment Method:", val: METHOD_LABEL[r.method] ?? r.method },
  ];

  for (let i = 0; i < metaItems.length; i += 2) {
    const item1 = metaItems[i];
    const item2 = metaItems[i + 1];

    if (item1) {
      ctx.fillStyle = "#64748B";
      ctx.fillText(item1.label, padding, y);
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.fillText(item1.val, padding + 95, y);
    }
    if (item2) {
      ctx.fillStyle = "#64748B";
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillText(item2.label, width / 2 + 10, y);
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.fillText(item2.val, width / 2 + 115, y);
    }
    y += 22;
  }

  y += 10;

  // Particulars Section Header
  ctx.fillStyle = BRAND_SOFT;
  ctx.fillRect(padding, y, contentWidth, 28);
  ctx.strokeStyle = BRAND_LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.moveTo(padding, y + 28);
  ctx.lineTo(width - padding, y + 28);
  ctx.stroke();

  ctx.fillStyle = BRAND;
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.letterSpacing = "1px";
  ctx.fillText("◆  PARTICULARS", padding + 10, y + 18);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "right";
  ctx.font = "10px monospace";
  ctx.fillStyle = BRAND;
  ctx.globalAlpha = 0.75;
  ctx.fillText(`${r.lineItems.length} line${r.lineItems.length === 1 ? "" : "s"}`, width - padding - 10, y + 18);
  ctx.globalAlpha = 1;
  y += 34;

  // Line items Table Header
  ctx.fillStyle = BRAND_SOFT;
  ctx.fillRect(padding, y, contentWidth, 26);
  ctx.fillStyle = BRAND;
  ctx.globalAlpha = 0.8;
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("ITEM DESCRIPTION", padding + 8, y + 17);
  ctx.textAlign = "center";
  ctx.fillText("QTY", width - padding - 150, y + 17);
  ctx.textAlign = "right";
  ctx.fillText("AMOUNT", width - padding - 8, y + 17);
  ctx.globalAlpha = 1;
  y += 32;

  // Line Items
  const subtotal = r.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  const totalDiscount = r.lineItems.reduce((s, li) => s + li.discount, 0);
  const totalVat = r.lineItems.reduce((s, li) => s + li.vat, 0);

  for (const li of r.lineItems) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";

    const nameText = li.itemName.length > 32 ? li.itemName.slice(0, 30) + "…" : li.itemName;
    ctx.fillText(nameText, padding + 8, y);

    ctx.fillStyle = "#64748B";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    const metaStr = li.assetName ? `Asset: ${li.assetName} · ${fmtMoney(li.unitPrice)} each` : `${fmtMoney(li.unitPrice)} each`;
    ctx.fillText(metaStr, padding + 8, y + 15);

    ctx.textAlign = "center";
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 13px monospace";
    ctx.fillText(String(li.quantity), width - padding - 150, y + 8);

    ctx.textAlign = "right";
    ctx.fillStyle = BRAND;
    ctx.font = "bold 13px monospace";
    ctx.fillText(fmtMoney(li.lineTotal), width - padding - 8, y + 8);

    y += 36;
    ctx.strokeStyle = BRAND_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding + 8, y - 6);
    ctx.lineTo(width - padding - 8, y - 6);
    ctx.stroke();
  }

  y += 10;

  // Totals Box (brand themed)
  ctx.fillStyle = BRAND_SOFT;
  ctx.fillRect(padding, y, contentWidth, 110 + (r.balance > 0 ? 22 : 0));
  ctx.strokeStyle = BRAND_LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(padding, y, contentWidth, 110 + (r.balance > 0 ? 22 : 0));
  let totalsY = y + 20;

  const drawTotalLine = (label: string, val: string, isBold = false, color = "#0F172A") => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#64748B";
    ctx.font = `${isBold ? "bold " : ""}13px system-ui, -apple-system, sans-serif`;
    ctx.fillText(label, padding + 16, totalsY);

    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.font = `${isBold ? "bold 15px" : "13px"} monospace`;
    ctx.fillText(val, width - padding - 16, totalsY);
    totalsY += 22;
  };

  drawTotalLine("Subtotal", fmtMoney(subtotal));
  if (totalDiscount > 0) drawTotalLine("Discount", fmtMoney(totalDiscount), false, "#059669");
  if (totalVat > 0) drawTotalLine("VAT", fmtMoney(totalVat));

  // Brand Divider line in Totals
  ctx.strokeStyle = BRAND_LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding + 16, totalsY - 14);
  ctx.lineTo(width - padding - 16, totalsY - 14);
  ctx.stroke();

  drawTotalLine("TOTAL SALE", fmtMoney(r.total), true, BRAND);
  if (r.balance > 0) drawTotalLine("Outstanding Balance", fmtMoney(r.balance), true, "#D97706");
  const changeDue = r.lineItems.length > 0 && t.saleDetails?.changeDue ? t.saleDetails.changeDue : 0;
  if (changeDue > 0) drawTotalLine("Change Due", fmtMoney(changeDue), false, "#059669");

  y = totalsY + 16;

  // Barcode Section (with brand top border)
  ctx.strokeStyle = BRAND_LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y - 4);
  ctx.lineTo(width - padding, y - 4);
  ctx.stroke();

  const barcodeBars = encodeCode128B(r.receipt);
  const barScale = 2.4;
  let barX = (width - barcodeBars.reduce((s, w) => s + w * barScale, 0)) / 2;

  ctx.fillStyle = "#000000";
  for (let i = 0; i < barcodeBars.length; i++) {
    const barWidth = barcodeBars[i] * barScale;
    if (i % 2 === 0) {
      ctx.fillRect(barX, y, barWidth, 42);
    }
    barX += barWidth;
  }
  y += 50;

  ctx.textAlign = "center";
  ctx.fillStyle = "#475569";
  ctx.font = "bold 12px monospace";
  ctx.fillText(r.receipt, width / 2, y);
  y += 20;

  // Slogan (brand colored)
  ctx.fillStyle = BRAND;
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  ctx.letterSpacing = "0.5px";
  ctx.fillText((companyInfo.receiptSlogan || "THANK YOU FOR YOUR BUSINESS.").toUpperCase(), width / 2, y);
  ctx.letterSpacing = "0px";

  // Resize canvas height accurately to fit drawn content
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = width;
  finalCanvas.height = y + padding;
  const finalCtx = finalCanvas.getContext("2d");
  if (finalCtx) {
    finalCtx.drawImage(canvas, 0, 0);
  }

  return finalCanvas;
}

/**
 * Creates a valid standalone PDF 1.4 Blob from JPEG canvas render.
 */
export function createPdfFromJpeg(jpegDataUrl: string, imgWidthPx: number, imgHeightPx: number): Blob {
  const base64Str = jpegDataUrl.split(",")[1];
  const binaryStr = atob(base64Str);
  const jpegBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    jpegBytes[i] = binaryStr.charCodeAt(i);
  }

  const pdfWidth = 288; // 4 inches standard thermal receipt width in points
  const pdfHeight = (imgHeightPx / imgWidthPx) * pdfWidth;

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const pushString = (str: string) => {
    parts.push(encoder.encode(str));
  };

  pushString("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  const offset1 = parts.reduce((acc, p) => acc + p.length, 0);

  pushString("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const offset2 = parts.reduce((acc, p) => acc + p.length, 0);

  pushString("2 0 obj\n<< /Type /Pages /Count 1 /Kids [ 3 0 R ] >>\nendobj\n");
  const offset3 = parts.reduce((acc, p) => acc + p.length, 0);

  pushString(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${pdfWidth.toFixed(2)} ${pdfHeight.toFixed(2)} ] /Contents 4 0 R /Resources << /XObject << /Img5 5 0 R >> >> >>\nendobj\n`);
  const offset4 = parts.reduce((acc, p) => acc + p.length, 0);

  const contentStream = `q ${pdfWidth.toFixed(2)} 0 0 ${pdfHeight.toFixed(2)} 0 0 cm /Img5 Do Q`;
  pushString(`4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);
  const offset5 = parts.reduce((acc, p) => acc + p.length, 0);

  pushString(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidthPx} /Height ${imgHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  parts.push(jpegBytes);
  pushString("\nendstream\nendobj\n");
  const offsetXref = parts.reduce((acc, p) => acc + p.length, 0);

  const xrefStr = `xref\n0 6\n0000000000 65535 f \n${String(offset1).padStart(10, "0")} 00000 n \n${String(offset2).padStart(10, "0")} 00000 n \n${String(offset3).padStart(10, "0")} 00000 n \n${String(offset4).padStart(10, "0")} 00000 n \n${String(offset5).padStart(10, "0")} 00000 n \n`;
  pushString(xrefStr);

  const trailerStr = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offsetXref}\n%%EOF\n`;
  pushString(trailerStr);

  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const pdfBuffer = new Uint8Array(totalLength);
  let currentOffset = 0;
  for (const part of parts) {
    pdfBuffer.set(part, currentOffset);
    currentOffset += part.length;
  }

  return new Blob([pdfBuffer], { type: "application/pdf" });
}

/**
 * Main helper to export or share receipt as PDF or PNG Image.
 */
export async function exportReceipt(
  t: GroupedTransaction,
  itemNameMap: Map<string, string>,
  company: CompanyDetails,
  format: "pdf" | "image",
  method: "download" | "share" | "copy" = "share",
  branch?: Location | null
) {
  try {
    const canvas = generateReceiptCanvas(t, itemNameMap, company, branch);
    const receiptNum = t.receiptNumber || "receipt";

    if (format === "image") {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Failed to render receipt image");
          return;
        }

        const fileName = `Receipt_${receiptNum}.png`;

        if (method === "copy") {
          try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            toast.success("Receipt image copied to clipboard");
            return;
          } catch {
            toast.error("Clipboard copy not supported on this browser");
          }
        }

        if (method === "share" && navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                title: `Receipt ${receiptNum}`,
                text: `Sales receipt ${receiptNum} from ${company.name}`,
                files: [file],
              });
              toast.success("Receipt shared successfully");
              return;
            } catch (e) {
              if ((e as Error).name === "AbortError") return;
            }
          }
        }

        // Fallback or explicit download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${fileName}`);
      }, "image/png");
    } else {
      // PDF format
      const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const pdfBlob = createPdfFromJpeg(jpegDataUrl, canvas.width, canvas.height);
      const fileName = `Receipt_${receiptNum}.pdf`;

      if (method === "share" && navigator.share && navigator.canShare) {
        const file = new File([pdfBlob], fileName, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Receipt ${receiptNum}`,
              text: `Sales receipt ${receiptNum} from ${company.name}`,
              files: [file],
            });
            toast.success("Receipt PDF shared successfully");
            return;
          } catch (e) {
            if ((e as Error).name === "AbortError") return;
          }
        }
      }

      // Fallback or explicit download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${fileName}`);
    }
  } catch (error) {
    console.error("Failed to export receipt:", error);
    toast.error("Could not generate receipt export");
  }
}
