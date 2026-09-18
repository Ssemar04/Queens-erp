import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, CheckSquare, Square, Info } from "lucide-react";
import {
  ALL_SYSTEM_MODULES,
  ACCESS_ROLE_PRESETS,
  getDefaultAllowedPagesForRole,
  type SystemModule,
} from "@/lib/roles";
import type { Employee } from "./employees-store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSave: (employeeId: string, allowedPages: string[]) => Promise<void>;
}

export function PageAccessModal({ open, onOpenChange, employee, onSave }: Props) {
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      const initialPages =
        employee.allowedPages && employee.allowedPages.length > 0
          ? employee.allowedPages
          : getDefaultAllowedPagesForRole(employee.role);
      setSelectedPages(initialPages);

      // Check if matches preset
      const matched = ACCESS_ROLE_PRESETS.find(
        (p) =>
          p.allowedModules.length === initialPages.length &&
          p.allowedModules.every((m) => initialPages.includes(m))
      );
      setSelectedPreset(matched ? matched.id : "custom");
    }
  }, [employee, open]);

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = ACCESS_ROLE_PRESETS.find((p) => p.id === presetId);
    if (preset && preset.allowedModules.length > 0) {
      setSelectedPages(preset.allowedModules);
    }
  };

  const togglePage = (moduleName: string) => {
    setSelectedPreset("custom");
    setSelectedPages((prev) =>
      prev.includes(moduleName)
        ? prev.filter((p) => p !== moduleName)
        : [...prev, moduleName]
    );
  };

  const handleSelectAll = () => {
    setSelectedPreset("admin");
    setSelectedPages(ALL_SYSTEM_MODULES.map((m) => m.name));
  };

  const handleClearAll = () => {
    setSelectedPreset("custom");
    setSelectedPages([]);
  };

  const handleSave = async () => {
    if (!employee) return;
    try {
      setSaving(true);
      await onSave(employee.id, selectedPages);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  // Group modules by category
  const groups = Array.from(new Set(ALL_SYSTEM_MODULES.map((m) => m.group)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl">Manage Page Access Roles</DialogTitle>
              <DialogDescription>
                Configure accessible ERP system pages for {employee?.name} ({employee?.email})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 my-2">
          {/* Preset Selector */}
          <div className="rounded-xl border bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-slate-800 text-sm">Access Role Preset</Label>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {selectedPages.length} / {ALL_SYSTEM_MODULES.length} Pages Permitted
              </Badge>
            </div>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select access role preset" />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_ROLE_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">{preset.label}</span>
                      <span className="text-xs text-muted-foreground">{preset.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-sky-600" />
                Select a preset or customize individual pages below.
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-7 text-xs gap-1 text-emerald-700 hover:bg-emerald-50">
                  <CheckSquare className="h-3.5 w-3.5" /> Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-7 text-xs gap-1 text-rose-700 hover:bg-rose-50">
                  <Square className="h-3.5 w-3.5" /> Clear All
                </Button>
              </div>
            </div>
          </div>

          {/* Module Categories Grid */}
          <div className="space-y-4">
            {groups.map((group) => {
              const modulesInGroup = ALL_SYSTEM_MODULES.filter((m) => m.group === group);
              const allowedCount = modulesInGroup.filter((m) => selectedPages.includes(m.name)).length;

              return (
                <div key={group} className="rounded-xl border border-slate-200 p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                      {group}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600">
                      {allowedCount} / {modulesInGroup.length} Allowed
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {modulesInGroup.map((mod: SystemModule) => {
                      const isChecked = selectedPages.includes(mod.name);
                      return (
                        <div
                          key={mod.id}
                          onClick={() => togglePage(mod.name)}
                          className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-emerald-50/50 border-emerald-200"
                              : "bg-slate-50/30 border-slate-100 hover:bg-slate-50"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => togglePage(mod.name)}
                            className="mt-0.5"
                          />
                          <div className="space-y-0.5">
                            <p className={`text-xs font-semibold ${isChecked ? "text-emerald-900" : "text-slate-700"}`}>
                              {mod.name}
                            </p>
                            <p className="text-[11px] text-slate-500 leading-tight">
                              {mod.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Save Page Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
