import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dismissNotification,
  getNotificationPreferences,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/services/api";
import { useBranch } from "@/contexts/BranchContext";
import type { Notification } from "@/types/inventory";

interface QueryResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
}

function useNotificationKey() {
  const { currentBranchId } = useBranch();
  return useMemo(() => [currentBranchId || "default", "notifications"] as const, [currentBranchId]);
}

export function useNotifications(): QueryResult<Notification[]> {
  const queryKey = useNotificationKey();
  const query = useQuery({
    queryKey,
    queryFn: getNotifications,
    refetchInterval: 10_000,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
}

export function useUnreadCount(): number {
  const { data } = useNotifications();
  return data.filter((n) => !n.isRead).length;
}

function useNotificationMutation<TData>(handler: (data: TData) => Promise<unknown>) {
  const queryClient = useQueryClient();
  const queryKey = useNotificationKey();
  const mutation = useMutation({
    mutationFn: handler,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return useCallback((data: TData) => {
    mutation.mutate(data);
  }, [mutation]);
}

export function useMarkAsRead() {
  return useNotificationMutation<string>(markNotificationRead);
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const queryKey = useNotificationKey();
  const mutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return useCallback(() => {
    mutation.mutate();
  }, [mutation]);
}

export function useDismissNotification() {
  return useNotificationMutation<string>(dismissNotification);
}

export function useNotificationPreferences(): QueryResult<NotificationPreferences> {
  const queryKey = useNotificationKey();
  const query = useQuery({
    queryKey: [...queryKey, "preferences"],
    queryFn: getNotificationPreferences,
  });

  return {
    data: query.data ?? {
      low_stock: true,
      zero_stock: true,
      po_reminder: true,
      po_overdue: true,
      request_update: true,
      system: true,
    },
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const queryKey = useNotificationKey();
  return useMutation({
    mutationFn: (prefs: Partial<NotificationPreferences>) => updateNotificationPreferences(prefs),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: [...queryKey, "preferences"] });
    },
  });
}
