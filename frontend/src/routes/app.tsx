import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { ShortcutsHelpDialog } from "@/components/command/ShortcutsHelpDialog";
import { PageTransition } from "@/components/shared/PageTransition";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { canAccessRoute } from "@/lib/route-guard";
import { toast } from "sonner";

import { SidebarProvider } from "@/components/ui/sidebar";
import { BranchProvider } from "@/contexts/BranchContext";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { role } = useRole();
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);

  // Global keyboard shortcuts
  useKeyboardShortcuts({ onHelpOpen: () => setHelpOpen(true) });

  // Role-based route guard
  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    navigate({ to: "/" });
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (!canAccessRoute(location.pathname, role)) {
      toast.error("You don't have permission to access that page.");
      navigate({ to: "/app/dashboard" });
    }
  }, [isAuthenticated, isLoading, location.pathname, role, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <BranchProvider>
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
          <div className="flex min-w-0 flex-1 overflow-hidden">
            <aside className="hidden w-[260px] shrink-0 md:block">
              <Sidebar />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 w-full min-w-0 overflow-y-auto p-4 pb-20 md:p-6 md:pb-8">
                <div className="w-full min-w-0">
                  <AnimatePresence mode="wait">
                    <PageTransition routeKey={location.pathname}>
                      <Outlet />
                    </PageTransition>
                  </AnimatePresence>
                </div>
              </main>
            </div>
          </div>
          <BottomNav />
          <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
        </div>
      </SidebarProvider>
    </BranchProvider>
  );
}

