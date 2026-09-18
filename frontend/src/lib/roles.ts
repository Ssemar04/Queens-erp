export type UserRoleType = "admin" | "manager" | "staff";

export interface SystemModule {
  id: string;
  name: string;
  path: string;
  group: "Operations" | "Finance" | "Workplace & Procurement" | "Admin & System";
  description: string;
}

export const ALL_SYSTEM_MODULES: SystemModule[] = [
  // Operations
  { id: "dashboard", name: "Dashboard", path: "/app/dashboard", group: "Operations", description: "Executive overview & KPI metrics" },
  { id: "catalog", name: "Inventory", path: "/app/catalog", group: "Operations", description: "Stock catalog & items management" },
  { id: "orders", name: "Orders", path: "/app/orders", group: "Operations", description: "Sales orders & requisition tracking" },
  { id: "customers", name: "Customers", path: "/app/customers", group: "Operations", description: "Customer directory & debt histories" },
  { id: "movements", name: "Transactions", path: "/app/movements", group: "Operations", description: "POS sales & stock transaction logs" },
  { id: "locations", name: "Branches", path: "/app/locations", group: "Operations", description: "Multi-branch store location management" },

  // Finance
  { id: "bank", name: "Bank", path: "/app/bank", group: "Finance", description: "Bank accounts & cash flow transactions" },
  { id: "debtors", name: "Debtors", path: "/app/debtors", group: "Finance", description: "Customer outstanding debt balances" },
  { id: "creditors", name: "Creditors", path: "/app/creditors", group: "Finance", description: "Supplier payables & liability management" },
  { id: "expenses", name: "Expenses", path: "/app/expenses", group: "Finance", description: "Business operating expense tracking" },

  // Workplace & Procurement
  { id: "employees", name: "Employees", path: "/app/employees", group: "Workplace & Procurement", description: "Staff directory & access control" },
  { id: "chat", name: "Chatroom", path: "/app/chat", group: "Workplace & Procurement", description: "Internal staff team chat" },
  { id: "assets", name: "Assets", path: "/app/assets", group: "Workplace & Procurement", description: "Company hardware & asset registry" },
  { id: "suppliers", name: "Supplies", path: "/app/suppliers", group: "Workplace & Procurement", description: "Vendor & purchase orders" },
  { id: "reports", name: "Reports", path: "/app/reports", group: "Workplace & Procurement", description: "Business analytics & export reports" },

  // Admin & System
  { id: "settings", name: "Settings", path: "/app/settings", group: "Admin & System", description: "System setup & company details" },
  { id: "help", name: "Help", path: "/app/help", group: "Admin & System", description: "User guides & documentation" },
];

export interface AccessRolePreset {
  id: string;
  label: string;
  badgeColor: string;
  description: string;
  allowedModules: string[]; // List of module names or IDs
}

export const ACCESS_ROLE_PRESETS: AccessRolePreset[] = [
  {
    id: "admin",
    label: "Admin (Full Access)",
    badgeColor: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    description: "Unrestricted access to all system modules, finances, settings, and employees.",
    allowedModules: ALL_SYSTEM_MODULES.map((m) => m.name),
  },
  {
    id: "manager",
    label: "Manager",
    badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    description: "Operational management across sales, inventory, finance, suppliers, and reports.",
    allowedModules: [
      "Dashboard", "Inventory", "Orders", "Customers", "Transactions", "Branches",
      "Bank", "Debtors", "Creditors", "Expenses", "Chatroom", "Assets", "Reports", "Supplies", "Help"
    ],
  },
  {
    id: "cashier",
    label: "Sales / Cashier",
    badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    description: "Front-desk sales, customer transactions, order processing, and customer lookup.",
    allowedModules: ["Transactions", "Orders", "Customers", "Chatroom", "Help"],
  },
  {
    id: "inventory",
    label: "Inventory Clerk",
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    description: "Stock catalog, item movements, purchase orders, asset tracking, and supplies.",
    allowedModules: ["Inventory", "Orders", "Transactions", "Supplies", "Assets", "Chatroom", "Help"],
  },
  {
    id: "accountant",
    label: "Accountant",
    badgeColor: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
    description: "Full financial visibility: bank accounts, debtors, creditors, expenses, transactions, and reports.",
    allowedModules: ["Bank", "Debtors", "Creditors", "Expenses", "Transactions", "Reports", "Chatroom", "Help"],
  },
  {
    id: "custom",
    label: "Custom Access Role",
    badgeColor: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30",
    description: "Tailored page access permissions configured specifically by Admin.",
    allowedModules: [],
  },
];

export interface RoleInfo {
  key: UserRoleType;
  label: string;
  badgeColor: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  description: string;
  accessibleModules: string[];
}

export const SYSTEM_ROLES: Record<UserRoleType, RoleInfo> = {
  admin: {
    key: "admin",
    label: "Admin",
    badgeColor: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    badgeVariant: "destructive",
    description: "Full access to all system modules, financial management, settings, and employee administration.",
    accessibleModules: ALL_SYSTEM_MODULES.map((m) => m.name),
  },
  manager: {
    key: "manager",
    label: "Manager",
    badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    badgeVariant: "secondary",
    description: "Operational management of inventory, sales, customers, transactions, finance, procurement, and reports.",
    accessibleModules: [
      "Dashboard", "Inventory", "Orders", "Customers", "Transactions", "Branches",
      "Bank", "Debtors", "Creditors", "Expenses", "Chatroom", "Assets", "Reports", "Supplies", "Help"
    ],
  },
  staff: {
    key: "staff",
    label: "Staff",
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    badgeVariant: "outline",
    description: "Standard staff access for creating transactions, submitting orders, team chat, asset viewing, reports, and help.",
    accessibleModules: [
      "Transactions", "Orders", "Chatroom", "Assets", "Reports", "Help"
    ],
  },
};

export interface RolePermissions {
  canManageItems: boolean;
  canLogMovements: boolean;
  canManageSuppliers: boolean;
  canApproveRequests: boolean;
  canViewAnalytics: boolean;
  canAccessSettings: boolean;
  canManageUsers: boolean;
}

const ROLE_PERMISSIONS: Record<UserRoleType, RolePermissions> = {
  admin: {
    canManageItems: true,
    canLogMovements: true,
    canManageSuppliers: true,
    canApproveRequests: true,
    canViewAnalytics: true,
    canAccessSettings: true,
    canManageUsers: true,
  },
  manager: {
    canManageItems: true,
    canLogMovements: true,
    canManageSuppliers: true,
    canApproveRequests: true,
    canViewAnalytics: true,
    canAccessSettings: false,
    canManageUsers: false,
  },
  staff: {
    canManageItems: false,
    canLogMovements: true,
    canManageSuppliers: false,
    canApproveRequests: false,
    canViewAnalytics: true,
    canAccessSettings: false,
    canManageUsers: false,
  },
};

export function getPermissionsForRole(role: UserRoleType): RolePermissions {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.staff;
}

export function getRoleInfo(role: string): RoleInfo {
  const normalized = role.toLowerCase().trim() as UserRoleType;
  if (normalized in SYSTEM_ROLES) {
    return SYSTEM_ROLES[normalized];
  }
  if (normalized.includes("admin")) return SYSTEM_ROLES.admin;
  if (normalized.includes("manager") || normalized.includes("head") || normalized.includes("lead")) return SYSTEM_ROLES.manager;
  return SYSTEM_ROLES.staff;
}

export function getDefaultAllowedPagesForRole(role: string): string[] {
  const info = getRoleInfo(role);
  return info.accessibleModules;
}
