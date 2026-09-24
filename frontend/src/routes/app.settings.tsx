import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { SystemSettings } from "@/components/settings/SystemSettings";
import { motion } from "framer-motion";
import { Sparkles, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { useMemo } from "react";

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

  const sectionIndex = (key: string) => Math.max(0, ["hero"].indexOf(key));

  const settingsMeta = useMemo(() => ({
    modules: 14,
  }), []);

  return (
    <div className="w-full min-w-0 space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 * sectionIndex("hero"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[#003399]/15 bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white p-6 shadow-[0_10px_40px_-18px_rgba(0,51,153,0.45)]"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-28 h-72 w-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute right-6 top-1/2 hidden md:block -translate-y-1/2 pointer-events-none">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.06)] -rotate-3">
              <SettingsIcon className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-violet-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Workspace settings
          </div>
          <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
            System configuration
          </h2>
          <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
            Admin-only controls · customize company profile, numbering, taxes, roles, backup & restore, and integration preferences.
          </p>
        </div>
      </motion.section>

      <ErrorBoundary>
        <SystemSettings />
      </ErrorBoundary>
    </div>
  );
}
