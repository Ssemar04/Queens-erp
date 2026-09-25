import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Truck,
  ShoppingBag,
  MapPin,
  Settings,
  ChevronRight,
  HelpCircle,
  Landmark,
  Receipt,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  UserSquare2,
  MessageSquare,
  Boxes,
  FileBarChart2,
} from "lucide-react";

import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import { canAccessRoute } from "@/lib/route-guard";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
      { label: "Inventory", href: "/app/catalog", icon: Package },
      { label: "Orders", href: "/app/orders", icon: ShoppingBag },
      { label: "Customers", href: "/app/customers", icon: Users },
      { label: "Transactions", href: "/app/movements", icon: ArrowLeftRight },
      { label: "Branches", href: "/app/locations", icon: MapPin },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Bank", href: "/app/bank", icon: Landmark },
      { label: "Debtors", href: "/app/debtors", icon: ArrowDownToLine },
      { label: "Creditors", href: "/app/creditors", icon: ArrowUpFromLine },
      { label: "Expenses", href: "/app/expenses", icon: Receipt },
    ],
  },
  {
    label: "Workplace",
    items: [
      { label: "Employees", href: "/app/employees", icon: UserSquare2 },
      { label: "Chatroom", href: "/app/chat", icon: MessageSquare },
      { label: "Assets", href: "/app/assets", icon: Boxes },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Reports", href: "/app/reports", icon: FileBarChart2 },
    ],
  },
  {
    label: "Procurement",
    items: [
      { label: "Purchases", href: "/app/purchases", icon: ShoppingBag },
      { label: "Suppliers", href: "/app/suppliers", icon: Truck },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Settings", href: "/app/settings", icon: Settings },
    ],
  },
];

const standaloneLinks: NavItem[] = [
  { label: "Help", href: "/app/help", icon: HelpCircle },
];

interface SidebarProps {
  onNavigate?: () => void;
  allowCollapse?: boolean;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { role, allowedPages } = useRole();

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (href: string) => location.pathname === href;

  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => canAccessRoute(i.href, role, allowedPages)),
    }))
    .filter((g) => g.items.length > 0);

  const visibleStandalone = standaloneLinks.filter((i) => canAccessRoute(i.href, role, allowedPages));

  return (
    <nav data-tour="sidebar" className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 px-5">
        <Package className="h-5 w-5 text-sidebar-primary" />
        <span className="text-lg font-semibold tracking-tight text-sidebar-primary-foreground">Queens tech ERP</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {visibleGroups.map((group, idx) => {
          const isCollapsed = collapsed[group.label] ?? false;
          return (
            <div key={group.label}>
              {idx > 0 && <div className="mx-2 my-2 border-t border-sidebar-border" />}
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="flex w-full items-center gap-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors"
              >
                <ChevronRight className={cn("h-3 w-3 transition-transform duration-150", !isCollapsed && "rotate-90")} />
                {group.label}
              </button>

              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive(item.href)
                          ? "bg-sidebar-accent font-medium text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {visibleStandalone.length > 0 && (
          <>
            <div className="mx-2 my-2 border-t border-sidebar-border" />
            <div className="space-y-0.5">
              {visibleStandalone.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive(item.href)
                      ? "bg-sidebar-accent font-medium text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

