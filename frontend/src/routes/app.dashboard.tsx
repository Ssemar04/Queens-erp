import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Package, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { NeedsAttention } from "@/components/dashboard/NeedsAttention";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { DashboardReorderSection } from "@/components/insights/DashboardReorderSection";
import { DashboardAnomalySection } from "@/components/insights/DashboardAnomalySection";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";

import { useStockSummary } from "@/hooks/useInventoryData";
import { useItems, useMovements, useSuppliers } from "@/hooks/useInventoryData";
import { useAlertGenerator } from "@/hooks/useStockAlertGenerator";
import { useOnboarding, type TourStep } from "@/hooks/useOnboarding";

const TOUR_STEPS: TourStep[] = [
  { title: "Welcome to Queenstech ERP!", description: "Let's take a quick tour of the key features. This will only take a minute." },
  { target: "sidebar", title: "Navigation", description: "Use the sidebar to switch between sections — catalog, movements, suppliers, and more." },
  { target: "metrics", title: "Stock health", description: "Your inventory health at a glance — total SKUs, in-stock, low-stock, and out-of-stock counts." },
  { target: "needs-attention", title: "Needs attention", description: "Items that need action appear here — low stock and overdue POs." },
  { target: "search", title: "Command palette", description: "Press CMD+K (or Ctrl+K) to search anything — items, suppliers, orders, and more." },
  { title: "You're all set!", description: "Explore the app or try the guided walkthrough to learn the core workflow. Happy managing!" },
];

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Queenstech ERP" }] }),
});

function DashboardPage() {
  const { data: summary } = useStockSummary();
  const { data: items } = useItems();
  const { data: movements } = useMovements();
  const { data: suppliers } = useSuppliers();
  useAlertGenerator();

  const {
    hasCompleted,
    currentStep,
    isActive,
    startTour,
    skipTour,
    completeTour,
    next,
    back,
  } = useOnboarding("dashboard");
  

  // Auto-start tour on first dashboard visit
  useEffect(() => {
    if (!hasCompleted) {
      const timer = setTimeout(() => startTour(), 500);
      return () => clearTimeout(timer);
    }
  }, [hasCompleted, startTour]);

  const handleTourComplete = () => {
    completeTour();
    toast.success("Tour complete! Explore freely or start the walkthrough.");
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back — here's your inventory overview.</p>
      </div>

      <div data-tour="metrics" className="rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total SKUs" value={summary.total} accentColor="neutral" icon={Package} />
          <MetricCard label="In stock" value={summary.inStock} accentColor="healthy" icon={CheckCircle2} />
          <MetricCard label="Low stock" value={summary.lowStock} accentColor="warning" icon={AlertTriangle} />
          <MetricCard label="Out of stock" value={summary.outOfStock} accentColor="danger" icon={XCircle} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div data-tour="needs-attention" className="min-h-0"><NeedsAttention /></div>
        <div className="min-h-0"><RecentActivity /></div>
      </div>

      <DashboardAnomalySection movements={movements} items={items} />
      <DashboardReorderSection items={items} movements={movements} suppliers={suppliers} />

      <OnboardingTour
        steps={TOUR_STEPS}
        currentStep={currentStep}
        isActive={isActive}
        onNext={next}
        onBack={back}
        onSkip={skipTour}
        onComplete={handleTourComplete}
      />

      
    </div>
  );
}
