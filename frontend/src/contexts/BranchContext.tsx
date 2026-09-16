import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getBranches, getStoredActiveBranch, setStoredActiveBranch } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { Location } from "@/types/inventory";

interface BranchContextType {
  currentBranchId: string | null;
  branches: Location[];
  selectedBranch: Location | null;
  switchBranch: (branchId: string) => void;
  isLocked: boolean;
  isLoading: boolean;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType>({
  currentBranchId: null,
  branches: [],
  selectedBranch: null,
  switchBranch: () => {},
  isLocked: false,
  isLoading: true,
  refreshBranches: async () => {},
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [branches, setBranches] = useState<Location[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(getStoredActiveBranch());
  const [isLoading, setIsLoading] = useState(true);

  const appRole = user?.user_metadata?.role as string | undefined;
  const isAdmin = appRole === "admin";
  const userAssignedBranchId = (user?.user_metadata?.branchId as string | undefined) || null;
  const isLocked = !isAdmin && Boolean(userAssignedBranchId);

  const refreshBranches = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getBranches();
      setBranches(data);

      if (data.length > 0) {
        // If employee locked to a branch:
        if (isLocked && userAssignedBranchId) {
          setCurrentBranchId(userAssignedBranchId);
          setStoredActiveBranch(userAssignedBranchId);
        } else {
          // If stored active branch is valid, keep it; otherwise default to first branch
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
      if (isLocked) {
        console.warn("Branch switching is restricted for assigned employees.");
        return;
      }
      setCurrentBranchId(branchId);
      setStoredActiveBranch(branchId);

      // Instantly clear/reset query cache so no stale branch data persists in React Query
      queryClient.clear();
      queryClient.resetQueries();
      queryClient.invalidateQueries();

      // Dispatch global event for non-react-query stores to re-fetch immediately
      window.dispatchEvent(new CustomEvent("qterp:branch-changed", { detail: { branchId } }));
    },
    [isLocked, queryClient],
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
