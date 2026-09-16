import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Info,
  Save,
  Palette,
  Building,
  CheckCircle2,
  Database,
  Cpu,
  RefreshCw,
  Package,
  Truck,
  MapPin,
  Sparkles,
  RotateCcw,
  Download,
  HelpCircle,
  Heart,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useItems, useSuppliers, useLocations } from "@/hooks/useInventoryData";
import { useSettings, DEFAULT_PRIMARY_COLOR } from "@/contexts/ThemeContext";
import { toast } from "sonner";

const COLOR_PRESETS = [
  { name: "Sapphire (Default)", value: "#003399" },
  { name: "Royal Indigo", value: "#4f46e5" },
  { name: "Emerald Tech", value: "#059669" },
  { name: "Amethyst Violet", value: "#7c3aed" },
  { name: "Sunset Coral", value: "#ea580c" },
  { name: "Rose Crimson", value: "#e11d48" },
  { name: "Slate Dark", value: "#334155" },
];

export function SystemSettings() {
  const { data: items = [] } = useItems();
  const { data: suppliers = [] } = useSuppliers();
  const { data: locations = [] } = useLocations();
  const { settings, updateSettings, resetSettings } = useSettings();

  const [companyForm, setCompanyForm] = useState(settings.companyDetails);
  const [themeForm, setThemeForm] = useState(settings.theme);

  const handleCompanySave = () => {
    updateSettings({ companyDetails: companyForm });
    toast.success("Company details & receipt preferences updated successfully!");
  };

  const handleThemeSave = (overrideTheme?: typeof themeForm) => {
    const themeToSave = overrideTheme || themeForm;
    updateSettings({ theme: themeToSave });
    toast.success("Appearance & color theme updated!");
  };

  const handlePresetSelect = (hexColor: string) => {
    const updated = { ...themeForm, primaryColor: hexColor };
    setThemeForm(updated);
    handleThemeSave(updated);
  };

  const handleResetDefaults = () => {
    resetSettings();
    setCompanyForm(settings.companyDetails);
    setThemeForm(settings.theme);
    toast.info("System settings restored to default state.");
  };

  const handleExportDiagnostics = () => {
    const configData = {
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      company: companyForm.name,
      theme: themeForm,
      workspaceStats: {
        itemsCount: items.length,
        suppliersCount: suppliers.length,
        locationsCount: locations.length,
      },
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("System configuration diagnostics exported.");
  };

  return (
    <div className="space-y-6">
      {/* System Status Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-muted/30">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <Cpu className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">System Core & Health</h2>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Operational
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Queenstech ERP Engine • SQLite Multi-Tenant Architecture • Version 1.0.0
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExportDiagnostics}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export Config
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={handleResetDefaults}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset Defaults
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Data Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Workspace Data Totals
          </CardTitle>
          <CardDescription>Overview of active entities registered in the system database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 transition-all hover:border-primary/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{items.length}</p>
                <p className="text-xs text-muted-foreground">Catalog Items</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 transition-all hover:border-primary/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{suppliers.length}</p>
                <p className="text-xs text-muted-foreground">Active Suppliers</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 transition-all hover:border-primary/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{locations.length}</p>
                <p className="text-xs text-muted-foreground">Branch Locations</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Details & Receipt Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            Company Details & Receipt Branding
          </CardTitle>
          <CardDescription>Configure business identity, contact metadata, and printed receipt header info</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email">Email Address</Label>
              <Input
                id="company-email"
                type="email"
                value={companyForm.email}
                onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-phone">Phone Number</Label>
              <Input
                id="company-phone"
                value={companyForm.phone}
                onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-tax">Tax Registration ID</Label>
              <Input
                id="company-tax"
                value={companyForm.taxId}
                onChange={(e) => setCompanyForm({ ...companyForm, taxId: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company-address">HQ Street Address</Label>
              <Input
                id="company-address"
                value={companyForm.address}
                onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-location">Receipt Location Name</Label>
              <Input
                id="company-location"
                value={companyForm.location}
                onChange={(e) => setCompanyForm({ ...companyForm, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-contact-line">Receipt Contact Line</Label>
              <Input
                id="company-contact-line"
                value={companyForm.contactLine}
                onChange={(e) => setCompanyForm({ ...companyForm, contactLine: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-floor">Floor Number</Label>
              <Input
                id="company-floor"
                value={companyForm.floorNumber}
                onChange={(e) => setCompanyForm({ ...companyForm, floorNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-room">Room Number</Label>
              <Input
                id="company-room"
                value={companyForm.roomNumber}
                onChange={(e) => setCompanyForm({ ...companyForm, roomNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="receipt-slogan">Receipt Slogan / Footer Message</Label>
              <Input
                id="receipt-slogan"
                value={companyForm.receiptSlogan}
                onChange={(e) => setCompanyForm({ ...companyForm, receiptSlogan: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="receipt-verify-url">Receipt Verification Base URL</Label>
              <Input
                id="receipt-verify-url"
                value={companyForm.receiptVerificationBaseUrl}
                onChange={(e) => setCompanyForm({ ...companyForm, receiptVerificationBaseUrl: e.target.value })}
                placeholder="Leave blank to use default application URL"
              />
            </div>
          </div>
          <div className="pt-2">
            <Button onClick={handleCompanySave}>
              <Save className="h-4 w-4 mr-2" />
              Save Company Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Theme & Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Theme & Visual Preferences
          </CardTitle>
          <CardDescription>Personalize application color palette, dark mode preference, and visual accents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="theme-mode">Appearance Mode</Label>
              <Select
                value={themeForm.mode}
                onValueChange={(v: "light" | "dark" | "system") => {
                  const updated = { ...themeForm, mode: v };
                  setThemeForm(updated);
                  handleThemeSave(updated);
                }}
              >
                <SelectTrigger id="theme-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light Mode</SelectItem>
                  <SelectItem value="dark">Dark Mode</SelectItem>
                  <SelectItem value="system">Sync with System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="primary-color">Custom Hex Primary Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="primary-color"
                  type="color"
                  className="h-10 w-16 cursor-pointer p-1"
                  value={themeForm.primaryColor}
                  onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })}
                />
                <Input
                  type="text"
                  className="font-mono text-sm uppercase"
                  value={themeForm.primaryColor}
                  onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })}
                />
                <Button variant="secondary" onClick={() => handleThemeSave()}>
                  Apply
                </Button>
              </div>
            </div>
          </div>

          {/* Color Presets */}
          <div className="space-y-3 pt-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Quick Theme Presets
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => {
                const isSelected = themeForm.primaryColor.toLowerCase() === preset.value.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePresetSelect(preset.value)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-sm"
                      style={{ backgroundColor: preset.value }}
                    />
                    {preset.name}
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About Section */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              About Queenstech ERP
            </span>
            <Badge variant="secondary" className="font-mono text-xs">
              v1.0.0
            </Badge>
          </CardTitle>
          <CardDescription>
            Platform overview, version metadata, and system capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm font-bold text-lg">
                Q
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base">Queenstech ERP Solution</h3>
                <p className="text-xs text-muted-foreground">
                  Enterprise Inventory, Multi-Branch Database & Operational Management Suite
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link to="/app/help">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Documentation & Help
                </Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs"
                onClick={() => toast.info("Queenstech ERP v1.0.0 — All systems running smoothly.")}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                What's New
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-md border border-border/40 p-2.5 bg-background/50">
              <span className="text-muted-foreground block text-[11px]">Platform</span>
              <span className="font-medium text-foreground">Queenstech Inventory</span>
            </div>
            <div className="rounded-md border border-border/40 p-2.5 bg-background/50">
              <span className="text-muted-foreground block text-[11px]">Version</span>
              <span className="font-medium text-foreground">1.0.0 Stable</span>
            </div>
            <div className="rounded-md border border-border/40 p-2.5 bg-background/50">
              <span className="text-muted-foreground block text-[11px]">Architecture</span>
              <span className="font-medium text-foreground">Multi-Branch Sub-DB</span>
            </div>
            <div className="rounded-md border border-border/40 p-2.5 bg-background/50">
              <span className="text-muted-foreground block text-[11px]">Environment</span>
              <span className="font-medium text-foreground">Production Ready</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>© 2026 CodesmanHouse Inc. All rights reserved.</span>
            <span className="flex items-center gap-1 text-[11px]">
              Crafted with <Heart className="h-3 w-3 fill-rose-500 text-rose-500 inline" /> for modern enterprise operations
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
