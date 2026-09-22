import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, MapPin, Plus, UserRound, Database, CheckCircle2, ArrowRightLeft, Lock, Info, Sparkles, ShieldCheck } from "lucide-react";
import { useItems, useLocations as useLocationsData } from "@/hooks/useInventoryData";
import { LocationSummary } from "@/components/locations/LocationSummary";
import { LocationFormSheet } from "@/components/locations/LocationFormSheet";
import { PermissionGate } from "@/hooks/usePermissions";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";
import type { Location } from "@/types/inventory";

function sectionIndex(index: number, visibleSections: number[]) {
  return Math.max(0, visibleSections.indexOf(index));
}

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
  const { isAdmin } = useRole();
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

  const visibleCardIndices = useMemo(
    () => branches.map((_, i) => i),
    [branches],
  );

  return (
    <TooltipProvider delayDuration={250}>
      <div className="w-full min-w-0 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Company Branches</h1>
              <p className="text-sm text-muted-foreground">
                {branches.length} branch{branches.length !== 1 && "es"} with isolated sub-databases & shared company chat
              </p>
            </div>
            {isAdmin && (
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
            )}
          </div>

          {!isAdmin && (
            <Tooltip delayDuration={180}>
              <TooltipTrigger asChild>
                <div
                  className="group relative w-full overflow-hidden rounded-xl border border-[#003399]/25 bg-gradient-to-r from-[#003399]/[0.09] via-[#003399]/[0.05] to-transparent px-4 py-3 cursor-default transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#003399]/45 hover:from-[#003399]/[0.13] shadow-[0_0_0_1px_rgba(0,51,153,0.05),0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#003399]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="pointer-events-none absolute -left-20 top-1/2 h-24 w-48 -translate-y-1/2 rotate-12 bg-[#003399]/[0.06] blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700 ease-out" />
                  <div className="flex items-start gap-3 relative">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#003399]/12 ring-1 ring-[#003399]/20 shadow-[0_0_0_2px_rgba(255,255,255,0.6)] transition-all duration-300 group-hover:bg-[#003399]/18 group-hover:ring-[#003399]/30">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#003399] transition-transform duration-300 ease-out group-hover:scale-110" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          Viewing as Branch Manager
                          <Sparkles className="h-3 w-3 text-[#003399] opacity-70" />
                        </span>
                        <Badge className="bg-[#003399]/12 text-[#003399] border-[#003399]/25 text-[10px] px-1.5 py-0 h-4">
                          <Info className="mr-1 h-2.5 w-2.5" />
                          View Mode
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                        Branch creation, edits, and sub-database context switching are <span className="font-medium text-[#003399]/90">Admin-only features</span>. Your view is limited to read-only information.
                      </div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                className="max-w-sm text-xs border-[#003399]/20 shadow-[0_10px_40px_-10px_rgba(0,51,153,0.3)]"
              >
                <div className="space-y-1.5">
                  <p className="font-medium text-[#003399] flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Branch Context Locked
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Your account is strictly restricted to the branch sub-database assigned by an administrator. This data isolation ensures each branch operates independently.
                  </p>
                  <p className="text-muted-foreground leading-relaxed pt-1 border-t border-border/60 mt-1.5">
                    <span className="font-medium text-foreground">💡 To change your context:</span> ask an Admin to switch your active sub-database assignment.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
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
              <style>{`
                @keyframes cardFadeInUp {
                  from { opacity: 0; transform: translateY(10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                @keyframes assignedBranchPulse {
                  0%, 100% { box-shadow: 0 0 0 1px rgba(0,51,153,0.08), 0 12px 40px -14px rgba(0,51,153,0.45); }
                  50% { box-shadow: 0 0 0 1px rgba(0,51,153,0.12), 0 16px 50px -14px rgba(0,51,153,0.55); }
                }
              `}</style>
              {branches.map((branch, idx) => {
                const isActiveContext = currentBranchId === branch.id;
                const isAssignedBranch = !isAdmin && isActiveContext;
                const isSisterBranch = !isAdmin && !isActiveContext;
                const cleanBranchId = branch.id.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                const stagger = sectionIndex(idx, visibleCardIndices);

                const card = (
                  <div
                    key={branch.id}
                    className={`w-full relative rounded-lg border p-4 text-left transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      selectedId === branch.id
                        ? "border-[#003399]/60 bg-[#003399]/[0.05] shadow-[0_0_0_1px_rgba(0,51,153,0.08),0_8px_30px_-14px_rgba(0,51,153,0.35)]"
                        : "border-border hover:border-[#003399]/35 hover:bg-muted/50 hover:shadow-[0_0_0_1px_rgba(0,51,153,0.04),0_4px_20px_-12px_rgba(0,0,0,0.1)]"
                    } ${
                      isAssignedBranch
                        ? "ring-2 ring-[#003399]/50"
                        : ""
                    } ${
                      isSisterBranch
                        ? "opacity-85"
                        : ""
                    }`}
                    style={{
                      animation: [
                        `cardFadeInUp 520ms cubic-bezier(0.22, 1, 0.36, 1) ${stagger * 55}ms forwards`,
                        isAssignedBranch ? "assignedBranchPulse 3.6s cubic-bezier(0.22, 1, 0.36, 1) 700ms infinite" : undefined,
                      ].filter(Boolean).join(", "),
                      opacity: 0,
                      transform: "translateY(10px)",
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-lg opacity-0 pointer-events-none transition-opacity duration-700 ease-out"
                      style={{
                        background: isAssignedBranch
                          ? "radial-gradient(circle at 0% 0%, rgba(0,51,153,0.08) 0%, transparent 55%), radial-gradient(circle at 100% 100%, rgba(0,51,153,0.05) 0%, transparent 50%)"
                          : undefined,
                      }}
                      onLoad={(e) => {
                        if (isAssignedBranch) {
                          (e.currentTarget as HTMLElement).style.opacity = "1";
                        }
                      }}
                      ref={(el) => {
                        if (el && isAssignedBranch) {
                          requestAnimationFrame(() => {
                            el.style.opacity = "1";
                          });
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedId(branch.id)}
                      className="w-full text-left relative"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`relative ${isAssignedBranch ? "text-[#003399]" : "text-primary"}`}>
                              <Building2 className="h-4 w-4" />
                              {isAssignedBranch && (
                                <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-[#003399] shadow-[0_0_0_2px_rgba(255,255,255,0.95)] animate-ping" style={{ animationDuration: "2.2s" }} />
                              )}
                            </div>
                            <p className={`truncate font-medium ${isAssignedBranch ? "text-foreground" : "text-foreground"}`}>{branch.name}</p>
                            {isActiveContext && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] shadow-[0_0_0_1px_rgba(16,185,129,0.05)]">
                                <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                                Active Sub-DB Context
                              </Badge>
                            )}
                            {isAssignedBranch && (
                              <Badge className="bg-[#003399]/15 text-[#003399] border-[#003399]/30 text-[10px] shadow-[0_0_0_1px_rgba(0,51,153,0.06)]">
                                <Sparkles className="mr-1 h-2.5 w-2.5" />
                                Your Branch Hub
                              </Badge>
                            )}
                            {isSisterBranch && (
                              <Badge variant="outline" className="border-border/80 bg-muted/40 text-muted-foreground text-[10px]">
                                <Lock className="mr-1 h-2.5 w-2.5" />
                                Sister Branch
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                            {formatShortAddress(branch) || "Address details not set yet"}
                          </p>
                        </div>
                        {isSisterBranch && (
                          <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md bg-muted/60 border border-border/60">
                            <Lock className="h-3.5 w-3.5 text-muted-foreground/80" />
                          </div>
                        )}
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

                    {isAdmin && !isActiveContext && (
                      <div className="mt-3 pt-2 border-t border-border/50 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            switchBranch(branch.id);
                            toast.success(`Switched active database context to ${branch.name}`);
                          }}
                          className="h-7 text-xs text-[#003399] hover:bg-[#003399]/10 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_0_0_1px_rgba(0,51,153,0.08)]"
                        >
                          <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                          Switch context to this branch
                        </Button>
                      </div>
                    )}
                  </div>
                );

                if (isSisterBranch) {
                  return (
                    <Tooltip key={branch.id} delayDuration={220}>
                      <TooltipTrigger asChild>
                        {card}
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        align="start"
                        className="max-w-[220px] text-xs border-[#003399]/15 shadow-[0_8px_32px_-10px_rgba(0,0,0,0.15)]"
                      >
                        <div className="space-y-1.5">
                          <p className="font-medium text-foreground flex items-center gap-1.5">
                            <Lock className="h-3 w-3 text-muted-foreground" />
                            Sister Branch — Read-Only
                          </p>
                          <p className="text-muted-foreground leading-relaxed">
                            This is a sister company branch with its own isolated sub-database.
                          </p>
                          <p className="text-muted-foreground/90 leading-relaxed pt-1 border-t border-border/60 mt-1.5">
                            <span className="font-medium text-[#003399]">🔒 Context switch:</span> only Admins can change your active branch assignment.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return card;
              })}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            {selectedBranch ? (
              <LocationSummary
                branch={selectedBranch}
                items={items}
                canEdit={isAdmin}
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
    </TooltipProvider>
  );
}
