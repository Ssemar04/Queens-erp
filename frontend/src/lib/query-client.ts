import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3_000, // 3s stale time for quick automatic data sync
      gcTime: 10 * 60_000,
      refetchInterval: 5_000, // 5s automatic background sync polling
      refetchOnWindowFocus: true, // Sync instantly when switching back to tab
      refetchOnReconnect: "always",
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
