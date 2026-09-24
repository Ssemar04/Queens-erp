import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus, Search, Users, Crown, TrendingUp, AlertTriangle, List as ListIcon,
  Building2, Sparkles, Mail, Phone, Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { useCustomers, type Customer } from "@/components/customers/customers-store";
import { CustomerFormSheet } from "@/components/customers/CustomerFormSheet";
import { CustomerDetailSheet } from "@/components/customers/CustomerDetailSheet";
import { LoyaltyTiersSheet } from "@/components/customers/LoyaltyTiersSheet";

export const Route = createFileRoute("/app/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers - Queenstech ERP" }] }),
});

const TIER_DOT: Record<Customer["tier"], string> = {
  bronze: "bg-amber-700",
  silver: "bg-slate-400",
  gold: "bg-amber-400",
  platinum: "bg-cyan-400",
};

function CustomersPage() {
  const { customers, loading, add, update, remove, addInteraction } = useCustomers();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [active, setActive] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.reference.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [customers, query]);

  const kpis = useMemo(() => {
    const total = customers.length;
    const vip = customers.filter((c) => c.tier === "platinum" || c.tier === "gold").length;
    const ltv = customers.reduce((s, c) => s + c.lifetimeValue, 0);
    const overdue = customers.filter(
      (c) => c.creditLimit > 0 && c.outstandingBalance / c.creditLimit > 0.8,
    ).length;
    const dormant = customers.filter((c) => !c.lastOrderAt || new Date(c.lastOrderAt) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).length;
    return { total, vip, ltv, overdue, dormant };
  }, [customers]);

  async function handleSave(customer: Customer) {
    setSaving(true);
    try {
      const saved = editing ? await update(customer.id, customer) : await add(customer);
      toast.success(editing ? `${saved.name} updated` : `${saved.name} added - ${saved.reference}`);
      setFormOpen(false);
      setEditing(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save customer";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function openDetail(customer: Customer) {
    setActive(customer);
  }

  const newThisWeek = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const iso = weekAgo.toISOString().slice(0, 10);
    return customers.filter((c) => (c.createdAt || "").slice(0, 10) >= iso).length;
  }, [customers]);

  const sectionIndex = (key: string) => Math.max(0, ["hero"].indexOf(key));

  return (
    <div className="w-full min-w-0 space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 * sectionIndex("hero"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[#003399]/15 bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white p-6 shadow-[0_10px_40px_-18px_rgba(0,51,153,0.45)]"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-28 h-72 w-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute right-6 top-1/2 hidden md:block -translate-y-1/2 pointer-events-none">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.06)] -rotate-3">
              <Users className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-amber-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <Crown className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Customers hub
              {newThisWeek > 0 && (
                <span className="ml-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                  +{newThisWeek} new this week
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {kpis.total.toLocaleString()} customers · UGX {(kpis.ltv / 1_000_000).toFixed(2)}M lifetime value
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              {kpis.vip} gold/platinum VIPs · {kpis.overdue} on credit watch · {kpis.dormant} dormant 90+ days
              {filtered.length !== customers.length && <> · showing {filtered.length} filtered results</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTiersOpen(true)}
              className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white ring-1 ring-white/15"
            >
              <Settings className="mr-1.5 h-4 w-4" /> Loyalty tiers
            </Button>
            <Button
              size="sm"
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="bg-white text-[#003399] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_-2px_rgba(0,0,0,0.25)] hover:bg-white/95 active:scale-[0.98] transition-all"
            >
              <Plus className="mr-1.5 h-4 w-4 text-[#003399]" />
              New customer
            </Button>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Total" value={kpis.total} icon={Users} accent="bg-primary/10 text-primary" />
        <Kpi label="Gold/Platinum" value={kpis.vip} icon={Crown} accent="bg-amber-500/10 text-amber-600" />
        <Kpi
          label="Lifetime value"
          value={`UGX ${(kpis.ltv / 1_000_000).toFixed(2)}M`}
          icon={TrendingUp}
          accent="bg-emerald-500/10 text-emerald-600"
        />
        <Kpi
          label="Credit watch"
          value={kpis.overdue}
          icon={AlertTriangle}
          accent="bg-destructive/10 text-destructive"
        />
        <Kpi label="Dormant" value={kpis.dormant} icon={Sparkles} accent="bg-rose-500/10 text-rose-600" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, reference, email, phone, tag..."
            className="bg-white pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={loading ? "Loading customers" : customers.length === 0 ? "No customers yet" : "No matching customers"}
          description={
            loading
              ? "Fetching customer records from the database."
              : customers.length === 0
              ? "Add your first customer to start tracking relationships and lifetime value."
              : "Try a different search."
          }
          actionLabel={!loading && customers.length === 0 ? "New customer" : undefined}
          onAction={!loading && customers.length === 0 ? () => setFormOpen(true) : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Loyalty Points</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead>Sales rep</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((customer) => (
                <TableRow
                  key={customer.id}
                  onClick={() => openDetail(customer)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {customer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          {customer.type === "company" && <Building2 className="h-3 w-3 text-muted-foreground" />}
                          {customer.name}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">{customer.reference}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3 w-3" /> {customer.email || "-"}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3 w-3" /> {customer.phone || "-"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                      <span className={cn("h-2 w-2 rounded-full", TIER_DOT[customer.tier])} />
                      {customer.tier}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{customer.loyaltyPoints.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{customer.totalOrders}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    UGX {(customer.lifetimeValue / 1000).toFixed(0)}K
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{customer.salesRep || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CustomerFormSheet
        open={formOpen}
        onOpenChange={(value) => { setFormOpen(value); if (!value) setEditing(null); }}
        existing={customers}
        editing={editing}
        onSave={handleSave}
        saving={saving}
      />

      <CustomerDetailSheet
        customer={active}
        open={!!active}
        onOpenChange={(value) => !value && setActive(null)}
        onEdit={() => {
          if (!active) return;
          setEditing(active);
          setActive(null);
          setFormOpen(true);
        }}
        onDelete={async () => {
          if (!active) return;
          try {
            await remove(active.id);
            toast.success(`${active.name} removed`);
            setActive(null);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to remove customer";
            toast.error(message);
          }
        }}
        onLogInteraction={async (interaction) => {
          if (!active) return;
          try {
            const updated = await addInteraction(active.id, interaction);
            setActive(updated);
            toast.success("Activity logged");
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to log activity";
            toast.error(message);
          }
        }}
      />

      <LoyaltyTiersSheet
        open={tiersOpen}
        onOpenChange={setTiersOpen}
      />
    </div>
  );
}

function Kpi({
  label, value, icon: Icon, accent,
}: { label: string; value: string | number; icon: typeof Users; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", accent)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 font-mono text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
