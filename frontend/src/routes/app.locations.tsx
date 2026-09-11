import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, MapPin, Plus, UserRound, Database, CheckCircle2, ArrowRightLeft } from "lucide-react";
import { useItems, useLocations as useLocationsData } from "@/hooks/useInventoryData";
import { LocationSummary } from "@/components/locations/LocationSummary";
import { LocationFormSheet } from "@/components/locations/LocationFormSheet";
import { PermissionGate } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";
import type { Location } from "@/types/inventory";

export const Route = createFileRoute("/app/locations")({
  component: LocationsPage,
  head: () => ({ meta: [{ title: "branches — Queenstech ERP" }] }),
});

function formatShortAddress(branch: Location) {
  const address = [branch.street, branch.building, branch.floor, branch.roomNumber]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(", ");
  return address || (typeof branch.address === "string" ? branch.address.trim() : "");
}

function LocationsPage() {
  const { data: items } = useItems();
  const { data: branches } = useLocationsData();
  const { currentBranchId, switchBranch, isLocked } = useBranch();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Location | null>(null);

  useEffect(() => {
    if (!branches.length) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !branches.some((branch) => branch.id === selectedId)) {
      setSelectedId(currentBranchId || branches[0].id);
    }
  }, [branches, selectedId, currentBranchId]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedId) ?? null,
    [branches, selectedId],
  );

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Company Branches</h1>
          <p className="text-sm text-muted-foreground">
            {branches.length} branch{branches.length !== 1 && "es"} with isolated sub-databases & shared company chat
          </p>
        </div>
        <PermissionGate permission="create_item">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => {
              setEditingBranch(null);
              setFormOpen(true);
            }}>
              <Plus className="mr-1.5 h-4 w-4" />
              New branch
            </Button>
          </div>
        </PermissionGate>
      </div>

      <ErrorBoundary>
      {branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No branches configured"
          description="Add your first branch. Each branch gets its own isolated SQLite sub-database automatically!"
          actionLabel="Add branch"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-3">
              {branches.map((branch) => {
                const isActiveContext = currentBranchId === branch.id;
                const cleanBranchId = branch.id.toLowerCase().replace(/[^a-z0-9_-]/g, "");

                return (
                  <div
                    key={branch.id}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      selectedId === branch.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(branch.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <p className="truncate font-medium text-foreground">{branch.name}</p>
                            {isActiveContext && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                Active Sub-DB Context
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {formatShortAddress(branch) || "Address details not set yet"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {branch.street || "No street"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5" />
                          {branch.branchManager || "No manager"}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground/80">
                          <Database className="h-3 w-3 text-sky-500" />
                          branch_{cleanBranchId}.db
                        </span>
                      </div>
                    </button>

                    {!isLocked && !isActiveContext && (
                      <div className="mt-3 pt-2 border-t border-border/50 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            switchBranch(branch.id);
                            toast.success(`Switched active database context to ${branch.name}`);
                          }}
                          className="h-7 text-xs text-primary hover:bg-primary/10"
                        >
                          <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                          Switch context to this branch
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            {selectedBranch ? (
              <LocationSummary
                branch={selectedBranch}
                items={items}
                onEdit={() => {
                  setEditingBranch(selectedBranch);
                  setFormOpen(true);
                }}
              />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Select a branch to view details
              </p>
            )}
          </div>
        </div>
      )}
      </ErrorBoundary>

      <LocationFormSheet open={formOpen} onOpenChange={(open) => {
        setFormOpen(open);
        if (!open) setEditingBranch(null);
      }} editLocation={editingBranch} />
    </div>
  );
}
