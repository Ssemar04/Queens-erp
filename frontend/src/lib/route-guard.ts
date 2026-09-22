import { ALL_SYSTEM_MODULES, type UserRoleType } from "@/lib/roles";

/** Maps route paths to default roles allowed */
const ROUTE_ACCESS: Record<string, UserRoleType[]> = {
  "/app/dashboard": ["admin", "manager", "staff"],
  "/app/catalog": ["admin", "manager", "staff"], // Inventory
  "/app/orders": ["admin", "manager", "staff"], // Orders
  "/app/customers": ["admin", "manager", "staff"], // Customers
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
  "/app/locations": ["admin", "manager"], // Branches (Admin + Branch Managers read-only view)
  "/app/settings": ["admin"], // System Settings (Admin only)
};

export function canAccessRoute(
  path: string,
  role: UserRoleType,
  userAllowedPages?: string[] | null
): boolean {
  if (role === "admin") return true;

  // If user has specific allowedPages assigned by admin
  if (userAllowedPages && Array.isArray(userAllowedPages) && userAllowedPages.length > 0) {
    const matchedModule = ALL_SYSTEM_MODULES.find(
      (m) => m.path === path || path.startsWith(m.path)
    );
    if (matchedModule) {
      const isAllowed = userAllowedPages.some(
        (p) =>
          p.toLowerCase() === matchedModule.name.toLowerCase() ||
          p.toLowerCase() === matchedModule.id.toLowerCase() ||
          p.toLowerCase() === matchedModule.path.toLowerCase()
      );
      if (isAllowed) return true;
      // If explicit custom allowedPages list is set and page is not in list, restrict access
      return false;
    }
  }

  const allowed = ROUTE_ACCESS[path];
  if (!allowed) return false;
  return allowed.includes(role);
}
