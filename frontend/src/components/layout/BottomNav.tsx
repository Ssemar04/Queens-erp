import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingBag, ArrowLeftRight, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";

import { useRole } from "@/hooks/useRole";
import { canAccessRoute } from "@/lib/route-guard";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Inventory", href: "/app/catalog", icon: Package },
  { label: "Orders", href: "/app/orders", icon: ShoppingBag },
  { label: "Transactions", href: "/app/movements", icon: ArrowLeftRight },
] as const;

export function BottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { role, allowedPages } = useRole();

  const isActive = (href: string) => location.pathname === href;

  const visibleItems = NAV_ITEMS.filter((item) => canAccessRoute(item.href, role, allowedPages));

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-border/80 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
        style={{
          height: "calc(56px + env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "group relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-all duration-200 min-h-[44px]",
              isActive(item.href)
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <div className="relative flex flex-col items-center">
              <item.icon
                className={cn(
                  "h-5 w-5 transition-all duration-200",
                  isActive(item.href) && "scale-110",
                  isActive(item.href) && "drop-shadow-[0_0_6px_rgba(var(--primary),0.35)]",
                )}
              />
              {isActive(item.href) && (
                <span className="absolute -top-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
              )}
            </div>
            <span
              className={cn(
                "font-medium tracking-tight",
                isActive(item.href) ? "scale-105" : "opacity-90",
              )}
            >
              {item.label}
            </span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          <MoreHorizontal className="h-5 w-5 transition-transform hover:rotate-90 duration-300" />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[82vh] p-0 overflow-hidden rounded-t-[var(--radius-fluid-card)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <SheetTitle className="sr-only">More navigation</SheetTitle>
          <Sidebar onNavigate={() => setMoreOpen(false)} allowCollapse={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
