import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FACTORY = { reorderPoint: 10, leadTimeDays: 7, safetyMultiplier: 1.5, orderQuantity: 25 };
type ReorderDefaultsValue = typeof FACTORY;

export function ReorderDefaults() {
  const [values, setValues] = useState<ReorderDefaultsValue>(FACTORY);

  const [saving, setSaving] = useState(false);

  const set = (key: keyof ReorderDefaultsValue, v: string) => {
    setValues((prev) => ({ ...prev, [key]: Number(v) || 0 }));
  };

  const handleSave = () => {
    if (values.reorderPoint < 0 || values.leadTimeDays < 1 || values.safetyMultiplier < 1 || values.orderQuantity < 1) {
      toast.error("Please fix validation errors"); return;
    }
    setSaving(true);
    setTimeout(() => { setSaving(false); toast.info("Reorder defaults are no longer stored in the browser."); }, 300);
  };

  const handleReset = () => {
    setValues(FACTORY);
    toast.success("Defaults restored");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reorder Defaults</CardTitle>
        <CardDescription>Global defaults applied to new items unless overridden.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Default Reorder Point</Label>
            <Input type="number" min={0} value={values.reorderPoint} onChange={(e) => set("reorderPoint", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Default Lead Time (days)</Label>
            <Input type="number" min={1} value={values.leadTimeDays} onChange={(e) => set("leadTimeDays", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Safety Stock Multiplier</Label>
            <Input type="number" min={1} step={0.1} value={values.safetyMultiplier} onChange={(e) => set("safetyMultiplier", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Default Order Quantity</Label>
            <Input type="number" min={1} value={values.orderQuantity} onChange={(e) => set("orderQuantity", e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          <Button variant="ghost" onClick={handleReset}>Reset to Defaults</Button>
        </div>
      </CardContent>
    </Card>
  );
}
