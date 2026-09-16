import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { SystemSettings } from "@/components/settings/SystemSettings";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "System Settings — Queenstech ERP" }] }),
});

function SettingsPage() {
  const { can } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!can("access_settings")) {
      toast.error("Access denied");
      navigate({ to: "/app/dashboard" });
    }
  }, [can, navigate]);

  if (!can("access_settings")) return null;

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">System configuration and workspace management</p>
      </div>

      <ErrorBoundary>
        <SystemSettings />
      </ErrorBoundary>
    </div>
  );
}
