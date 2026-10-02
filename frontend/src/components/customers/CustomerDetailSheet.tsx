import { useState, useMemo } from "react";
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
  MessageSquare, PhoneCall, Calendar, Sparkles, Edit, Trash2, Plus, Star, ShoppingBag, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer, CustomerInteraction } from "./customers-store";
import type { StockMovement } from "@/types/inventory";

const TIER_META: Record<Customer["tier"], { cls: string; label: string }> = {
  bronze: { cls: "bg-amber-700/15 text-amber-700", label: "Bronze" },
  silver: { cls: "bg-slate-400/20 text-slate-600", label: "Silver" },
  gold: { cls: "bg-amber-400/20 text-amber-600", label: "Gold" },
  platinum: { cls: "bg-cyan-400/20 text-cyan-700", label: "Platinum" },
};

const INTERACTION_ICON = {
  call: PhoneCall, email: Mail, meeting: Calendar, order: TrendingUp, note: MessageSquare,
} as const;

interface CustomerDetailSheetProps {
  customer: Customer | null;
  movements?: StockMovement[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onLogInteraction: (i: CustomerInteraction) => void;
}

export function CustomerDetailSheet(props: CustomerDetailSheetProps) {
  if (!props.customer) return null;
  return <CustomerDetailSheetBody {...props} customer={props.customer} />;
}

function CustomerDetailSheetBody({
  customer,
  movements = [],
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onLogInteraction,
}: CustomerDetailSheetProps & { customer: NonNullable<CustomerDetailSheetProps["customer"]> }) {
  const [noteText, setNoteText] = useState("");

  const tier = TIER_META[customer.tier];
  const creditUsed = customer.creditLimit > 0
    ? Math.min(100, (customer.outstandingBalance / customer.creditLimit) * 100)
    : 0;
  const daysSinceOrder = customer.lastOrderAt
    ? Math.floor((Date.now() - new Date(customer.lastOrderAt).getTime()) / 86400000)
    : null;

  const nextAction = computeNextAction(customer, daysSinceOrder);

  const customerOrders = useMemo(() => {
    if (!movements || movements.length === 0) return [];
    const map = new Map<string, {
      receiptNumber: string;
      date: string;
      totalAmount: number;
      deposit: number;
      balance: number;
      paymentMethod: string;
      status: string;
      items: string[];
    }>();

    const cName = (customer.name || "").toLowerCase().trim();
    const cRef = (customer.reference || "").toLowerCase().trim();
    const cPhone = (customer.phone || "").replace(/\D/g, "");

    for (const m of movements) {
      const sale = m.sale;
      if (!sale) continue;
      const sCustId = sale.customerId;
      const sName = (sale.customer || "").toLowerCase().trim();
      const sPhone = (sale.telephone || "").replace(/\D/g, "");

      const isMatch =
        (sCustId && sCustId === customer.id) ||
        (sName && (sName === cName || sName === cRef)) ||
        (cPhone && sPhone && (sPhone.length >= 6 && (sPhone.includes(cPhone) || cPhone.includes(sPhone))));

      if (!isMatch) continue;

      const receiptNumber = sale.receiptNumber || m.reference || m.id;
      const existing = map.get(receiptNumber);
      const itemName = sale.itemName || m.notes || "Item";
      const itemDesc = `${itemName}${m.quantity ? ` (x${Math.abs(m.quantity)})` : ""}`;

      if (existing) {
        if (!existing.items.includes(itemDesc)) {
          existing.items.push(itemDesc);
        }
      } else {
        map.set(receiptNumber, {
          receiptNumber,
          date: m.createdAt,
          totalAmount: sale.totalAmount || 0,
          deposit: sale.deposit || 0,
          balance: sale.balance || 0,
          paymentMethod: sale.paymentMethod || "cash",
          status: sale.status || "paid",
          items: [itemDesc],
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [movements, customer]);

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
            <Stat label="Orders" value={String(customerOrders.length || customer.totalOrders)} />
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

          <Tabs defaultValue="activity">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">
                Activity & Orders {customerOrders.length > 0 && `(${customerOrders.length})`}
              </TabsTrigger>
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

            <TabsContent value="activity" className="mt-4 space-y-4">
              {/* Customer Orders Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <ShoppingBag className="h-3.5 w-3.5 text-primary" /> Customer Orders & Purchases ({customerOrders.length})
                  </span>
                </div>

                {customerOrders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    No orders placed by this customer yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerOrders.map((order) => (
                      <div key={order.receiptNumber} className="rounded-xl border border-border bg-white p-3 text-xs space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-mono font-semibold text-foreground">
                            <Receipt className="h-3.5 w-3.5 text-primary" /> {order.receiptNumber}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "capitalize text-[10px]",
                              order.status === "paid" && "border-emerald-300 bg-emerald-50 text-emerald-700",
                              order.status === "partial" && "border-amber-300 bg-amber-50 text-amber-700",
                              order.status === "pending" && "border-sky-300 bg-sky-50 text-sky-700",
                              order.status === "void" && "border-rose-300 bg-rose-50 text-rose-700",
                            )}
                          >
                            {order.status}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
                          {order.items.join(" · ")}
                        </div>
                        <div className="flex flex-wrap items-center justify-between pt-1 border-t border-border/60 text-muted-foreground">
                          <span className="font-mono">{new Date(order.date).toLocaleDateString()}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-foreground">UGX {order.totalAmount.toLocaleString()}</span>
                            {order.balance > 0 && (
                              <span className="font-mono text-amber-700">bal: UGX {order.balance.toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual Activity Logger & Timeline */}
              <div className="pt-3 border-t border-border space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Manual Notes & Interaction History
                </div>
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
                <div className="relative space-y-3 border-l border-border pl-4 pt-1">
                  {customer.interactions.length === 0 && (
                    <div className="py-2 text-center text-xs text-muted-foreground">No notes logged yet</div>
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
