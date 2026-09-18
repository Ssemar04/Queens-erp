import { createContext, useCallback, useMemo, type ReactNode } from "react";
import { getPermissionsForRole, type RolePermissions, type UserRoleType } from "@/lib/roles";
import { useAuth } from "@/hooks/useAuth";

export interface RoleContextValue {
  role: UserRoleType;
  allowedPages?: string[] | null;
  permissions: RolePermissions;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  setRole: (role: UserRoleType) => void;
  setDemoRole: (role: UserRoleType) => void;
}

export const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const sessionRole = user?.user_metadata?.role as UserRoleType | undefined;
  const role = isAuthenticated && sessionRole ? sessionRole : "staff";
  const userExtra = user as (typeof user & { allowedPages?: string[] | null; allowed_pages?: string[] | null }) | null;
  const allowedPages = userExtra?.allowedPages || userExtra?.allowed_pages || null;

  const ignoreLocalRoleChange = useCallback((_role: UserRoleType) => {}, []);

  const value = useMemo<RoleContextValue>(() => {
    const permissions = getPermissionsForRole(role);
    return {
      role,
      allowedPages,
      permissions,
      isAdmin: role === "admin",
      isManager: role === "manager",
      isStaff: role === "staff",
      setRole: ignoreLocalRoleChange,
      setDemoRole: ignoreLocalRoleChange,
    };
  }, [allowedPages, ignoreLocalRoleChange, role]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
