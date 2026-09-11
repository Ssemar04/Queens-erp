import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanLine, Upload, Sparkles, Check, X } from "lucide-react";
import type { Expense } from "./expenses-store";

interface Props {
  onCapture: (data: Omit<Expense, "id" | "reference" | "createdAt">) => void;
}

const MOCK_RECEIPTS = [
  { merchant: "Java House", amount: 1450, desc: "Cappuccino · sandwich · service charge", type: "employee" as const },
  { merchant: "Total Energies", amount: 6800, desc: "Fuel top-up · Westlands station", type: "travel" as const },
  { merchant: "Naivas Supermarket", amount: 3240, desc: "Pantry restock · cleaning supplies", type: "employee" as const },
  { merchant: "Bolt", amount: 720, desc: "Trip · Kilimani → CBD", type: "travel" as const },
];

export function ReceiptScanner({ onCapture }: Props) {
  const [scanning, setScanning] = useState(false);
  const [parsed, setParsed] = useState<typeof MOCK_RECEIPTS[number] | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const handleFile = (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    setScanning(true);
    setParsed(null);
    window.setTimeout(() => {
      const pick = MOCK_RECEIPTS[Math.floor(Math.random() * MOCK_RECEIPTS.length)];
      setParsed(pick);
      setScanning(false);
    }, 1400);
  };

  const accept = () => {
    if (!parsed) return;
    onCapture({
      date: new Date().toISOString().slice(0, 10),
      type: parsed.type,
      employee: "You",
      department: "Operations",
      amount: parsed.amount,
      currency: "UGX",
      paymentMethod: "card",
      description: `${parsed.merchant} · ${parsed.desc}`,
      attachment: fileName,
      status: "submitted",
      reimbursable: true,
      reimbursed: false,
      approvedBy: null,
      rejectedReason: null,
    });
    setParsed(null);
    setFileName("");
  };

  return (
    <Card className="overflow-hidden rounded-xl border-dashed bg-gradient-to-br from-primary/5 via-white to-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="h-4 w-4 text-primary" /> Smart receipt capture
        </CardTitle>
        <p className="text-xs text-muted-foreground">Drop a receipt · we'll extract amount and build a draft</p>
      </CardHeader>
      <CardContent>
        {!parsed && !scanning && (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-white/60 px-6 py-8 text-center transition-colors hover:border-primary hover:bg-primary/5">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Drop a receipt or click to upload</span>
            <span className="text-xs text-muted-foreground">JPG · PNG · PDF · up to 10 MB</span>
            <Input type="file" accept="image/*,application/pdf" className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          </label>
        )}

        {scanning && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white/80 px-6 py-8">
            <div className="relative h-16 w-16">
              <ScanLine className="absolute inset-0 m-auto h-10 w-10 animate-pulse text-primary" />
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            </div>
            <p className="text-sm font-medium">Reading <span className="font-mono text-xs">{fileName}</span>…</p>
            <p className="text-xs text-muted-foreground">Extracting line items and totals</p>
          </div>
        )}

        {parsed && !scanning && (
          <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" /> Extracted from {fileName}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Row label="Merchant" value={parsed.merchant} />
              <Row label="Amount" value={`UGX ${parsed.amount.toLocaleString()}`} mono />
              <Row label="Type" value={parsed.type.charAt(0).toUpperCase() + parsed.type.slice(1)} />
              <Row label="Date" value={new Date().toLocaleDateString()} mono />
            </dl>
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{parsed.desc}</p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => { setParsed(null); setFileName(""); }}>
                <X className="h-3.5 w-3.5" /> Discard
              </Button>
              <Button size="sm" className="flex-1 gap-1.5" onClick={accept}>
                <Check className="h-3.5 w-3.5" /> Submit claim
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
