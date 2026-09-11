export type UserRoleType = "admin" | "manager" | "staff";

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
    accessibleModules: [
      "Dashboard", "Inventory", "Orders", "Customers", "Transactions", "Branches",
      "Bank", "Debtors", "Creditors", "Expenses", "Employees", "Chatroom",
      "Assets", "Reports", "Supplies", "Settings", "Help"
    ],
  },
  manager: {
    key: "manager",
    label: "Manager",
    badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    badgeVariant: "secondary",
    description: "Operational management of inventory, sales, customers, transactions, finance, procurement, and reports.",
    accessibleModules: [
      "Inventory", "Orders", "Customers", "Transactions", "Bank", "Debtors",
      "Creditors", "Expenses", "Chatroom", "Assets", "Reports", "Supplies",
      "Help"
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
