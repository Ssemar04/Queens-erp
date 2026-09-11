import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/hooks/useNotifications";
import { toast } from "sonner";

type NotificationPrefs = {
  low_stock: boolean;
  zero_stock: boolean;
  po_reminder: boolean;
  po_overdue: boolean;
  request_update: boolean;
  system: boolean;
};

const PREF_LABELS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "low_stock", label: "Low Stock Alerts", description: "When an item drops below its reorder point" },
  { key: "zero_stock", label: "Zero Stock Alerts", description: "When an item reaches zero stock" },
  { key: "po_reminder", label: "PO Reminders", description: "When a PO delivery date is within 3 days" },
  { key: "po_overdue", label: "PO Overdue", description: "When a PO passes its expected delivery date" },
  { key: "request_update", label: "Request Updates", description: "When an inventory request status changes" },
  { key: "system", label: "System Alerts", description: "Important operational alerts and deadlines" },
];

const DEFAULT_PREFS: NotificationPrefs = {
  low_stock: true,
  zero_stock: true,
  po_reminder: true,
  po_overdue: true,
  request_update: true,
  system: true,
};

interface NotificationPreferencesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPreferences({ open, onOpenChange }: NotificationPreferencesProps) {
  const { data: savedPrefs, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const [prefs, setPrefs] = useState<NotificationPrefs>(savedPrefs ?? DEFAULT_PREFS);

  useEffect(() => {
    if (open) setPrefs({ ...DEFAULT_PREFS, ...savedPrefs });
  }, [open, savedPrefs]);

  const handleToggle = (key: keyof NotificationPrefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  const handleSave = () => {
    updatePrefs.mutate(prefs, {
      onSuccess: () => {
        toast.success("Notification preferences saved");
        onOpenChange(false);
      },
      onError: (e) => toast.error(e.message || "Could not save notification preferences"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            Notification Preferences
          </DialogTitle>
          <DialogDescription>
            Choose which inventory and workflow notifications should appear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {PREF_LABELS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <Label htmlFor={`pref-${key}`} className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                id={`pref-${key}`}
                checked={prefs[key]}
                disabled={isLoading || updatePrefs.isPending}
                onCheckedChange={() => handleToggle(key)}
              />
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={isLoading || updatePrefs.isPending} className="w-full mt-2">
          {updatePrefs.isPending ? "Saving..." : "Save Preferences"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
