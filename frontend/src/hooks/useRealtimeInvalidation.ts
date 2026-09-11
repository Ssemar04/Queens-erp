import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { DATA_SYNC_EVENT } from "@/services/api";

const REALTIME_TABLES = [
  "categories",
  "suppliers",
  "locations",
  "items",
  "stock_movements",
  "purchase_orders",
  "purchase_order_items",
  "inventory_requests",
  "request_items",
] as const;

export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const session = auth.session;

  // 1. Instant event-driven data sync for Flask backend + active background polling
  useEffect(() => {
    const handleSync = () => {
      queryClient.invalidateQueries();
    };

    window.addEventListener(DATA_SYNC_EVENT, handleSync);
    window.addEventListener("focus", handleSync);
    window.addEventListener("online", handleSync);

    // 5-second background auto-sync polling when window is visible
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries();
      }
    }, 5_000);

    return () => {
      window.removeEventListener(DATA_SYNC_EVENT, handleSync);
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("online", handleSync);
      clearInterval(timer);
    };
  }, [queryClient]);

  // 2. Optional Supabase real-time subscriptions if configured
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }
    const client = supabase;

    if (!session?.access_token) {
      void client.realtime.setAuth(null);
      return;
    }

    void client.realtime.setAuth(session.access_token);

    const channel = client.channel(`stackwise-db-changes:${session.user.id}`);

    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryClient.invalidateQueries();
        },
      );
    }

    channel.subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient, session?.access_token, session?.user?.id]);
}
