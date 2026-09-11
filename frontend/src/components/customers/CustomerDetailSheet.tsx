import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Mail, Phone, MapPin, Building2, CreditCard, Crown, TrendingUp, AlertTriangle,
  MessageSquare, PhoneCall, Calendar, Sparkles, Edit, Trash2, Plus, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer, CustomerInteraction } from "./customers-store";

const TIER_META: Record<Customer["tier"], { cls: string; label: string }> = {
  bronze: { cls: "bg-amber-700/15 text-amber-700", label: "Bronze" },
  silver: { cls: "bg-slate-400/20 text-slate-600", label: "Silver" },
  gold: { cls: "bg-amber-400/20 text-amber-600", label: "Gold" },
  platinum: { cls: "bg-cyan-400/20 text-cyan-700", label: "Platinum" },
};

const INTERACTION_ICON = {
  call: PhoneCall, email: Mail, meeting: Calendar, order: TrendingUp, note: MessageSquare,
} as const;

export function CustomerDetailSheet({
  customer,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onLogInteraction,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onLogInteraction: (i: CustomerInteraction) => void;
}) {
  const [noteText, setNoteText] = useState("");

  if (!customer) return null;

  const tier = TIER_META[customer.tier];
  const creditUsed = customer.creditLimit > 0
    ? Math.min(100, (customer.outstandingBalance / customer.creditLimit) * 100)
    : 0;
  const daysSinceOrder = customer.lastOrderAt
    ? Math.floor((Date.now() - new Date(customer.lastOrderAt).getTime()) / 86400000)
    : null;

  const nextAction = computeNextAction(customer, daysSinceOrder);

  function logNote() {
    if (!noteText.trim()) return;
    onLogInteraction({
      id: crypto.randomUUID(),
      type: "note",
      summary: noteText.trim(),
      at: new Date().toISOString(),
    });
    setNoteText("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[640px] overflow-y-auto p-0">
        <div className="relative h-28 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <div className="absolute -bottom-8 left-6 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-background bg-primary/10 text-lg font-semibold text-primary shadow-sm">
            {initials(customer.name)}
          </div>
        </div>

        <SheetHeader className="px-6 pt-12">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <SheetTitle className="flex items-center gap-2">
                {customer.name}
                {customer.tier === "platinum" && <Crown className="h-4 w-4 text-cyan-500" />}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {customer.reference} · {customer.type === "company" ? "Company" : "Individual"}
              </SheetDescription>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline" className={cn("border-0", tier.cls)}>
              <Star className="mr-1 h-3 w-3" /> {tier.label}
            </Badge>
            <Badge variant="outline" className="capitalize">{customer.stage}</Badge>
            {customer.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        </SheetHeader>

        <div className="px-6 pb-6 mt-5 space-y-5">
          {nextAction && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="text-sm">
                <div className="font-medium text-foreground">Next best action</div>
                <div className="text-muted-foreground">{nextAction}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Lifetime value" value={`UGX ${(customer.lifetimeValue / 1000).toFixed(0)}K`} />
            <Stat label="Orders" value={String(customer.totalOrders)} />
            <Stat label="Avg order" value={`UGX ${(customer.avgOrderValue / 1000).toFixed(1)}K`} />
          </div>

          {customer.creditLimit > 0 && (
            <div className="rounded-xl border border-border bg-white p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" /> Credit utilization
                </span>
                <span className="font-mono">
                  UGX {customer.outstandingBalance.toLocaleString()} / {customer.creditLimit.toLocaleString()}
                </span>
              </div>
              <Progress value={creditUsed} className={cn("mt-2 h-1.5", creditUsed > 80 && "[&>div]:bg-destructive")} />
              {creditUsed > 80 && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Approaching credit limit
                </div>
              )}
            </div>
          )}

          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-2 text-sm">
              <InfoRow icon={Mail} label="Email" value={customer.email || "—"} />
              <InfoRow icon={Phone} label="Phone" value={customer.phone || "—"} />
              <InfoRow icon={MapPin} label="Address" value={[customer.address, customer.city, customer.country].filter(Boolean).join(", ")} />
              <InfoRow icon={Building2} label="Industry" value={customer.industry || "—"} />
              <InfoRow icon={CreditCard} label="Payment terms" value={customer.paymentTerms.replace("_", " ").toUpperCase()} />
              {customer.contactPerson && <InfoRow icon={Building2} label="Contact" value={customer.contactPerson} />}
              {customer.taxId && <InfoRow icon={Building2} label="Tax ID" value={customer.taxId} />}
              {customer.notes && (
                <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">{customer.notes}</div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-4 space-y-3">
              <div className="space-y-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Log a note, call, or follow-up…"
                  rows={2}
                />
                <Button size="sm" onClick={logNote} disabled={!noteText.trim()} className="w-full">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Log activity
                </Button>
              </div>
              <div className="relative space-y-3 border-l border-border pl-4">
                {customer.interactions.length === 0 && (
                  <div className="py-4 text-center text-xs text-muted-foreground">No activity yet</div>
                )}
                {customer.interactions.map((i) => {
                  const Icon = INTERACTION_ICON[i.type];
                  return (
                    <div key={i.id} className="relative">
                      <span className="absolute -left-[1.4rem] flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="rounded-lg bg-white border border-border p-2.5">
                        <div className="text-sm text-foreground">{i.summary}</div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{new Date(i.at).toLocaleString()}</span>
                          {i.by && <span>· {i.by}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="loyalty" className="mt-4">
              <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-transparent to-primary/5 p-4 text-center">
                <Crown className="mx-auto h-6 w-6 text-primary" />
                <div className="mt-1 font-mono text-2xl font-semibold">{customer.loyaltyPoints.toLocaleString()}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Loyalty points · {tier.label} tier</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-left text-xs">
                  <div className="rounded-lg bg-white p-2">
                    <div className="text-muted-foreground">Sales rep</div>
                    <div className="font-medium">{customer.salesRep || "—"}</div>
                  </div>
                  <div className="rounded-lg bg-white p-2">
                    <div className="text-muted-foreground">Last order</div>
                    <div className="font-medium">
                      {daysSinceOrder !== null ? `${daysSinceOrder}d ago` : "Never"}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function computeNextAction(c: Customer, daysSinceOrder: number | null): string | null {
  if (c.stage === "lead") return `Reach out to ${c.contactPerson || c.name} · introductory call.`;
  if (c.stage === "dormant") return `Re-engage with a win-back offer · ${daysSinceOrder}+ days since last order.`;
  if (c.outstandingBalance > 0 && c.creditLimit > 0 && c.outstandingBalance / c.creditLimit > 0.8)
    return `Send payment reminder · credit utilization at ${Math.round((c.outstandingBalance / c.creditLimit) * 100)}%.`;
  if (c.stage === "vip") return `Schedule QBR · top-tier account.`;
  if (daysSinceOrder !== null && daysSinceOrder > 45) return `Check in · last order was ${daysSinceOrder} days ago.`;
  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-2.5 text-center">
      <div className="font-mono text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-white px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground w-24">{label}</span>
      <span className="flex-1 truncate text-sm">{value}</span>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
