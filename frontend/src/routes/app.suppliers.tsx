import { useState, useEffect, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Truck, Sparkles, Star } from "lucide-react";
import { motion } from "framer-motion";
import { SuppliersTable } from "@/components/suppliers/SuppliersTable";
import { SupplierFormSheet } from "@/components/suppliers/SupplierFormSheet";
import { SupplierDetailSheet } from "@/components/suppliers/SupplierDetailSheet";
import { CSVExportButton, type CSVColumn } from "@/components/data/CSVExportButton";
import { useSuppliers, useItems, usePurchaseOrders } from "@/hooks/useInventoryData";
import { usePermissions } from "@/hooks/usePermissions";
import { useDeleteSupplier, useUpdateItem } from "@/hooks/useInventoryMutations";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import type { Supplier } from "@/types/inventory";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

interface SuppliersSearch {
  supplier?: string;
}

export const Route = createFileRoute("/app/suppliers")({
  component: SuppliersPage,
  head: () => ({ meta: [{ title: "Suppliers — Queenstech ERP" }] }),
  validateSearch: (search: Record<string, unknown>): SuppliersSearch => ({
    supplier: typeof search.supplier === "string" ? search.supplier : undefined,
  }),
});

function SuppliersPage() {
  const { supplier: supplierParam } = Route.useSearch();
  const navigate = useNavigate();
  const { data: suppliers } = useSuppliers();
  const { data: items } = useItems();
  const { data: purchaseOrders } = usePurchaseOrders();
  const { can } = usePermissions();
  const { role } = useRole();
  const canManageSuppliers = can("manage_suppliers");
  const isAdmin = role === "admin";
  const deleteSupplier = useDeleteSupplier();
  const updateItem = useUpdateItem();

  const [formOpen, setFormOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);

  const supplierCsvColumns = useMemo<CSVColumn<Supplier>[]>(() => [
    { header: "Name", accessor: (s) => s.name },
    { header: "Contact Person", accessor: (s) => s.contactName },
    { header: "Email", accessor: (s) => s.email },
    { header: "Phone", accessor: (s) => s.phone },
    { header: "Address", accessor: (s) => s.address },
    { header: "Lead Time Days", accessor: (s) => s.leadTimeDays },
    { header: "Rating", accessor: (s) => s.rating },
    { header: "Notes", accessor: (s) => s.notes },
  ], []);

  useEffect(() => {
    if (supplierParam && suppliers.length > 0) {
      const found = suppliers.find((s) => s.id === supplierParam);
      if (found) {
        setDetailSupplier(found);
        setDetailOpen(true);
      }
    }
  }, [supplierParam, suppliers]);

  function openCreate() {
    setEditSupplier(null);
    setFormOpen(true);
  }

  function openDetail(s: Supplier) {
    setDetailSupplier(s);
    setDetailOpen(true);
    navigate({ to: "/app/suppliers", search: { supplier: s.id }, replace: true });
  }

  function handleDetailClose(open: boolean) {
    setDetailOpen(open);
    if (!open) {
      navigate({ to: "/app/suppliers", search: {}, replace: true });
    }
  }

  function openEdit(s: Supplier) {
    setEditSupplier(s);
    setFormOpen(true);
  }

  function handleDelete(id: string) {
    for (const item of items) {
      if (item.supplierId === id) {
        updateItem.mutate({ id: item.id, updates: { supplierId: null } });
      }
    }
    deleteSupplier.mutate(id);
  }

  const overview = useMemo(() => {
    const itemsWithSuppliers = items.filter((i) => i.supplierId).length;
    const avgLeadTime = suppliers.length > 0
      ? Math.round(suppliers.reduce((s, sp) => s + (sp.leadTimeDays || 0), 0) / suppliers.length)
      : 0;
    const topRated = suppliers.filter((s) => (s.rating || 0) >= 4).length;
    return { itemsWithSuppliers, avgLeadTime, topRated };
  }, [suppliers, items]);

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
              <Truck className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-amber-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <Star className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Suppliers hub
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {suppliers.length.toLocaleString()} vendor{suppliers.length !== 1 ? "s" : ""} in directory
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              {overview.itemsWithSuppliers} catalog items linked · {overview.avgLeadTime} day avg lead time
              {overview.topRated > 0 && <> · {overview.topRated} top-rated (4★+)</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <CSVExportButton
              data={suppliers}
              columns={supplierCsvColumns}
              filename="Queenstech ERP-suppliers"
            />
            {canManageSuppliers && (
              <Button
                size="sm"
                onClick={openCreate}
                className="bg-white text-[#003399] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_-2px_rgba(0,0,0,0.25)] hover:bg-white/95 active:scale-[0.98] transition-all"
              >
                <Plus className="mr-1.5 h-4 w-4 text-[#003399]" />
                New Supplier
              </Button>
            )}
          </div>
        </div>
      </motion.section>

      <ErrorBoundary>
      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers added yet"
          description="Add your suppliers to track lead times, contact info, and order history."
          actionLabel={canManageSuppliers ? "Add Supplier" : undefined}
          onAction={canManageSuppliers ? openCreate : undefined}
        />
      ) : (
        <SuppliersTable suppliers={suppliers} items={items} onRowClick={openDetail} />
      )}
      </ErrorBoundary>

      <SupplierDetailSheet
        open={detailOpen}
        onOpenChange={handleDetailClose}
        supplier={detailSupplier}
        items={items}
        purchaseOrders={purchaseOrders}
        canEdit={canManageSuppliers}
        canDelete={isAdmin}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <SupplierFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={editSupplier}
      />
    </div>
  );
}
