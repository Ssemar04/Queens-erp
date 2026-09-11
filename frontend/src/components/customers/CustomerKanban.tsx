import { Crown, Sparkles, Heart, Snowflake, UserPlus, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer, CustomerStage } from "./customers-store";

const STAGES: { key: CustomerStage; label: string; cls: string; icon: typeof Crown }[] = [
  { key: "lead", label: "Leads", cls: "from-slate-400/15 to-slate-400/5 text-slate-600", icon: UserPlus },
  { key: "prospect", label: "Prospects", cls: "from-blue-400/15 to-blue-400/5 text-blue-600", icon: Sparkles },
  { key: "active", label: "Active", cls: "from-emerald-400/15 to-emerald-400/5 text-emerald-600", icon: Heart },
  { key: "vip", label: "VIP", cls: "from-amber-400/20 to-amber-400/5 text-amber-600", icon: Crown },
  { key: "dormant", label: "Dormant", cls: "from-rose-400/15 to-rose-400/5 text-rose-600", icon: Snowflake },
];

const TIER_DOT: Record<Customer["tier"], string> = {
  bronze: "bg-amber-700",
  silver: "bg-slate-400",
  gold: "bg-amber-400",
  platinum: "bg-cyan-400",
};

export function CustomerKanban({
  customers,
  onOpen,
  onMove,
}: {
  customers: Customer[];
  onOpen: (c: Customer) => void;
  onMove: (id: string, stage: CustomerStage) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {STAGES.map((stage) => {
        const items = customers.filter((c) => c.stage === stage.key);
        const total = items.reduce((s, c) => s + c.lifetimeValue, 0);
        const Icon = stage.icon;
        return (
          <div
            key={stage.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/customer-id");
              if (id) onMove(id, stage.key);
            }}
            className="flex flex-col rounded-xl border border-border bg-white"
          >
            <div className={cn("flex items-center justify-between rounded-t-xl bg-gradient-to-b p-3", stage.cls)}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-sm font-semibold">{stage.label}</span>
                <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-mono text-foreground">
                  {items.length}
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {total > 0 ? `${(total / 1000).toFixed(0)}K` : "—"}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-2 min-h-[120px]">
              {items.length === 0 && (
                <div className="flex flex-1 items-center justify-center py-6 text-xs text-muted-foreground">
                  Drop customers here
                </div>
              )}
              {items.map((c) => (
                <button
                  key={c.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/customer-id", c.id)}
                  onClick={() => onOpen(c)}
                  className="group rounded-lg border border-border bg-white p-2.5 text-left transition-all hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{c.industry || c.city}</div>
                      </div>
                    </div>
                    <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", TIER_DOT[c.tier])} title={c.tier} />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-mono">{c.totalOrders} orders</span>
                    <span className="font-mono">UGX {(c.lifetimeValue / 1000).toFixed(0)}K</span>
                  </div>

                  {c.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.tags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 border-t border-border pt-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate font-mono text-[10px] text-muted-foreground">{c.phone}</span>
                    <Mail className="ml-1 h-3 w-3 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
