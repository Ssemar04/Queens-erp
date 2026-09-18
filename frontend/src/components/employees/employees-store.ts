
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import type { UserRoleType } from "@/lib/roles";
import {
  createEmployee,
  updateEmployee as updateEmployeeApi,
  deleteEmployee,
  getEmployees
} from "@/services/api";

export type EmployeeStatus = "active" | "on_leave" | "probation" | "inactive";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";

export interface Employee {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: string;
  department: string;
  manager?: string;
  location: string;
  branchId?: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  joinedAt: string;
  salary: number;
  skills: string[];
  emergencyContact?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export type EmployeeDraft = Omit<
  Employee,
  "id" | "code" | "createdAt" | "updatedAt"
> & {
  systemRole?: UserRoleType;
};

export const DEFAULT_DEPARTMENTS = ["Sales and Marketing", "Graphics Designer", "Procument", "Administration"];
export const DEPARTMENTS = DEFAULT_DEPARTMENTS;

const DEPARTMENTS_STORAGE_KEY = "qterp_departments_v1";

export function getStoredDepartments(): string[] {
  try {
    const raw = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_DEPARTMENTS;
}

export function useDepartments() {
  const [departments, setDepartments] = useState<string[]>(getStoredDepartments);

  useEffect(() => {
    try {
      localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(departments));
    } catch {}
  }, [departments]);

  const addDepartment = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    let added = false;
    setDepartments((prev) => {
      if (prev.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
        toast.error("Department already exists");
        return prev;
      }
      toast.success(`Department "${trimmed}" added`);
      added = true;
      return [...prev, trimmed];
    });
    return added;
  }, []);

  const editDepartment = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    let edited = false;
    setDepartments((prev) => {
      if (oldName !== trimmed && prev.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
        toast.error("Department with this name already exists");
        return prev;
      }
      toast.success(`Department updated to "${trimmed}"`);
      edited = true;
      return prev.map((d) => (d === oldName ? trimmed : d));
    });
    return edited;
  }, []);

  const deleteDepartment = useCallback((name: string) => {
    setDepartments((prev) => {
      if (prev.length <= 1) {
        toast.error("At least one department must remain");
        return prev;
      }
      toast.success(`Department "${name}" removed`);
      return prev.filter((d) => d !== name);
    });
  }, []);

  return {
    departments,
    addDepartment,
    editDepartment,
    deleteDepartment,
  };
}

export const STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: "Active",
  on_leave: "On leave",
  probation: "Probation",
  inactive: "Inactive",
};

export function employeeInitials(name: string): string {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export function useEmployees() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isAdmin } = useRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) {
      setReady(false);
      return () => { cancelled = true; };
    }

    if (!isAuthenticated || !isAdmin) {
      setEmployees([]);
      setReady(true);
      return () => { cancelled = true; };
    }

    const load = async () => {
      setReady(false);
      try {
        const emps = await getEmployees();
        if (!cancelled) setEmployees(emps);
      } catch {
        if (!cancelled) toast.error("Could not load employees");
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [authLoading, isAdmin, isAuthenticated]);

  const assertCanUseBackend = useCallback(() => {
    if (!isAuthenticated) throw new Error("Sign in to continue");
  }, [isAuthenticated]);

  const add = useCallback(
    async (emp: EmployeeDraft) => {
      assertCanUseBackend();
      const created = await createEmployee(emp);
      setEmployees((prev) => [created, ...prev]);
      return created;
    },
    [assertCanUseBackend]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Employee> & { systemRole?: UserRoleType }) => {
      assertCanUseBackend();
      const updated = await updateEmployeeApi(id, patch);
      setEmployees((prev) => prev.map((e) => e.id === id ? updated : e));
      return updated;
    },
    [assertCanUseBackend]
  );

  const remove = useCallback(
    async (id: string) => {
      assertCanUseBackend();
      await deleteEmployee(id);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    },
    [assertCanUseBackend]
  );

  const replace = useCallback((employee: Employee) => {
    setEmployees((prev) => prev.map((e) => e.id === employee.id ? employee : e));
  }, []);

  return {
    ready,
    employees,
    add,
    update,
    remove,
    replace
  };
}
