import type { UserRoleType } from "@/lib/roles";

/** Maps route paths to the roles allowed */
const ROUTE_ACCESS: Record<string, UserRoleType[]> = {
  "/app/dashboard": ["admin", "manager", "staff"],
  "/app/catalog": ["admin", "manager"], // Inventory
  "/app/orders": ["admin", "manager", "staff"], // Orders
  "/app/customers": ["admin", "manager"], // Customers
  "/app/movements": ["admin", "manager", "staff"], // Transactions
  "/app/bank": ["admin", "manager"], // Bank
  "/app/debtors": ["admin", "manager"], // Debtors
  "/app/creditors": ["admin", "manager"], // Creditors
  "/app/expenses": ["admin", "manager"], // Expenses
  "/app/chat": ["admin", "manager", "staff"], // Chatroom
  "/app/assets": ["admin", "manager", "staff"], // Assets
  "/app/reports": ["admin", "manager", "staff"], // Reports
  "/app/suppliers": ["admin", "manager"], // Supplies / Suppliers
  "/app/help": ["admin", "manager", "staff"], // Help
  "/app/employees": ["admin"], // Employees (Admin only)
  "/app/locations": ["admin"], // Branches (Admin only)
  "/app/settings": ["admin"], // System Settings (Admin only)
};

export function canAccessRoute(path: string, role: UserRoleType): boolean {
  if (role === "admin") return true;
  const allowed = ROUTE_ACCESS[path];
  if (!allowed) return false;
  return allowed.includes(role);
}
