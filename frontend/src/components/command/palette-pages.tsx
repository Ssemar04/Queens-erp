import {
  LayoutDashboard,
  Package,
  ArrowRightLeft,
  Truck,
  ShoppingCart,
  ShoppingBag,
  ClipboardList,
  Inbox,
  MapPin,
  Settings,
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


export interface PageDef {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export const PAGES: PageDef[] = [
  { label: "Dashboard", path: "/app/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Inventory", path: "/app/catalog", icon: <Package className="h-4 w-4" /> },
  { label: "Orders", path: "/app/orders", icon: <ShoppingBag className="h-4 w-4" /> },
  { label: "Customers", path: "/app/customers", icon: <Users className="h-4 w-4" /> },
  { label: "Transactions", path: "/app/movements", icon: <ArrowRightLeft className="h-4 w-4" /> },
  { label: "Bank", path: "/app/bank", icon: <Landmark className="h-4 w-4" /> },
  { label: "Debtors", path: "/app/debtors", icon: <ArrowDownToLine className="h-4 w-4" /> },
  { label: "Creditors", path: "/app/creditors", icon: <ArrowUpFromLine className="h-4 w-4" /> },
  { label: "Expenses", path: "/app/expenses", icon: <Receipt className="h-4 w-4" /> },
  { label: "Employees", path: "/app/employees", icon: <UserSquare2 className="h-4 w-4" /> },
  { label: "Chatroom", path: "/app/chat", icon: <MessageSquare className="h-4 w-4" /> },
  { label: "Assets", path: "/app/assets", icon: <Boxes className="h-4 w-4" /> },
  { label: "Purchases", path: "/app/purchases", icon: <ShoppingCart className="h-4 w-4" /> },
  { label: "Reports", path: "/app/reports", icon: <FileBarChart2 className="h-4 w-4" /> },

  { label: "Suppliers", path: "/app/suppliers", icon: <Truck className="h-4 w-4" /> },
  { label: "Locations", path: "/app/locations", icon: <MapPin className="h-4 w-4" /> },
  { label: "System Settings", path: "/app/settings", icon: <Settings className="h-4 w-4" /> },
];
