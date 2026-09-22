import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getBranches, getStoredActiveBranch, setStoredActiveBranch } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { Location } from "@/types/inventory";
import { Lock } from "lucide-react";
import { toast } from "sonner";

interface BranchContextType {
  currentBranchId: string | null;
  branches: Location[];
  selectedBranch: Location | null;
  switchBranch: (branchId: string) => void;
  isLocked: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType>({
  currentBranchId: null,
  branches: [],
  selectedBranch: null,
  switchBranch: () => {},
  isLocked: false,
  isAdmin: false,
  isLoading: true,
  refreshBranches: async () => {},
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [branches, setBranches] = useState<Location[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(getStoredActiveBranch());
  const [isLoading, setIsLoading] = useState(true);

  const userExtra = user as (typeof user & { role?: string; branchId?: string }) | null;
  const appRole = (user?.user_metadata?.role || userExtra?.role)?.toLowerCase();
  const isAdmin = appRole === "admin";
  const userAssignedBranchId = user?.user_metadata?.branchId || userExtra?.branchId || null;
  const isLocked = !isAdmin;

  const refreshBranches = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getBranches();
      setBranches(data);

      if (data.length > 0) {
        if (isLocked) {
          const pinnedId = userAssignedBranchId && data.some((b) => b.id === userAssignedBranchId)
            ? userAssignedBranchId
            : data[0].id;
          setCurrentBranchId(pinnedId);
          setStoredActiveBranch(pinnedId);
        } else {
          const stored = getStoredActiveBranch();
          const valid = stored && data.some((b) => b.id === stored);
          const targetId = valid ? stored : data[0].id;
          setCurrentBranchId(targetId);
          setStoredActiveBranch(targetId);
        }
      }
    } catch (error) {
      console.error("Failed to load branches:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isLocked, userAssignedBranchId]);

  useEffect(() => {
    refreshBranches();
  }, [refreshBranches]);

  const switchBranch = useCallback(
    (branchId: string) => {
      if (!isAdmin) {
        toast.error("Branch switching is restricted to Admin users.", {
          description: "Contact an administrator to change your active sub-database context.",
          icon: <Lock className="h-4 w-4" />,
          classNames: {
            toast: "group-[.toaster]:border-rose-200",
          },
        });
        return;
      }

      setCurrentBranchId(branchId);
      setStoredActiveBranch(branchId);

      queryClient.clear();
      queryClient.resetQueries();
      queryClient.invalidateQueries();

      window.dispatchEvent(new CustomEvent("qterp:branch-changed", { detail: { branchId } }));
    },
    [isAdmin, queryClient],
  );

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === currentBranchId) || null,
    [branches, currentBranchId],
  );

  return (
    <BranchContext.Provider
      value={{
        currentBranchId,
        branches,
        selectedBranch,
        switchBranch,
        isLocked,
        isAdmin,
        isLoading,
        refreshBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
