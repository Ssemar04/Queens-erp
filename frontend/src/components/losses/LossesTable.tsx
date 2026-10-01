import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, CheckCheck, Pencil, Trash2, X } from "lucide-react";
import {
  LOSS_KIND_LABELS,
  LOSS_REASON_LABELS,
  LOSS_STATUS_LABELS,
  type LossKind,
  type LossRecord,
  type LossStatus,
} from "./loss-store";

interface Props {
  losses: LossRecord[];
  canManage: boolean;
  onEdit: (loss: LossRecord) => void;
  onDelete: (loss: LossRecord) => void;
  onStatus: (loss: LossRecord, status: LossStatus) => void;
}

const KIND_BADGE: Record<LossKind, string> = {
  inventory: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  asset: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  cash: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  other: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

const STATUS_BADGE: Record<LossStatus, string> = {
  reported: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  approved: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  written_off: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  rejected: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
};

const money = (n: number) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;

function subjectOf(l: LossRecord): string {
  if (l.kind === "inventory") return l.itemName || "Inventory item";
  if (l.kind === "asset") return l.assetName || "Asset";
  if (l.kind === "cash") return l.description || "Cash loss";
  return l.itemName || l.description || "General loss";
}

export function LossesTable({ losses, canManage, onEdit, onDelete, onStatus }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Reference</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {losses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManage ? 8 : 7} className="py-10 text-center text-sm text-muted-foreground">
                No losses recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            losses.map((l) => (
              <TableRow key={l.id} className="hover:bg-muted/40">
                <TableCell className="font-mono text-xs">{l.reference}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{l.date}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={KIND_BADGE[l.kind]}>
                    {LOSS_KIND_LABELS[l.kind]}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[240px]">
                  <div className="truncate text-sm font-medium">{subjectOf(l)}</div>
                  {l.kind !== "cash" && l.quantity > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {l.quantity} × {money(l.unitValue)}
                      {l.insuranceClaim ? " · insurance" : ""}
                    </div>
                  )}
                  {l.kind === "cash" && l.insuranceClaim && (
                    <div className="text-xs text-muted-foreground">insurance</div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {LOSS_REASON_LABELS[l.reasonCode] ?? l.reasonCode}
                </TableCell>
                <TableCell className="text-right text-sm font-semibold">{money(l.totalValue)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_BADGE[l.status]}>
                    {LOSS_STATUS_LABELS[l.status]}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {l.status === "reported" && (
                        <>
                          <IconAction title="Approve" onClick={() => onStatus(l, "approved")}>
                            <Check className="h-4 w-4 text-emerald-600" />
                          </IconAction>
                          <IconAction title="Reject" onClick={() => onStatus(l, "rejected")}>
                            <X className="h-4 w-4 text-red-600" />
                          </IconAction>
                        </>
                      )}
                      {l.status === "approved" && (
                        <IconAction title="Mark written off" onClick={() => onStatus(l, "written_off")}>
                          <CheckCheck className="h-4 w-4 text-blue-600" />
                        </IconAction>
                      )}
                      <IconAction title="Edit" onClick={() => onEdit(l)}>
                        <Pencil className="h-4 w-4" />
                      </IconAction>
                      <IconAction title="Delete" onClick={() => onDelete(l)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </IconAction>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function IconAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" title={title} onClick={onClick}>
      {children}
    </Button>
  );
}
