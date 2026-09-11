import { useState } from "react";
import { Info, Save, Palette, Building } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useItems, useSuppliers, useLocations } from "@/hooks/useInventoryData";
import { useSettings } from "@/contexts/ThemeContext";
import { toast } from "sonner";

export function SystemSettings() {
  const { data: items = [] } = useItems();
  const { data: suppliers = [] } = useSuppliers();
  const { data: locations = [] } = useLocations();
  const { settings, updateSettings } = useSettings();
  const [companyForm, setCompanyForm] = useState(settings.companyDetails);
  const [themeForm, setThemeForm] = useState(settings.theme);

  const handleCompanySave = () => {
    updateSettings({ companyDetails: companyForm });
    toast.success("Company details saved!");
  };

  const handleThemeSave = () => {
    updateSettings({ theme: themeForm });
    toast.success("Theme settings saved!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace data</CardTitle>
          <CardDescription>Review workspace totals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-semibold text-foreground">{items.length}</p>
              <p className="text-xs text-muted-foreground">Items</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-semibold text-foreground">{suppliers.length}</p>
              <p className="text-xs text-muted-foreground">Suppliers</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-semibold text-foreground">{locations.length}</p>
              <p className="text-xs text-muted-foreground">Locations</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Company Details
          </CardTitle>
          <CardDescription>Update your company information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email">Email</Label>
              <Input
                id="company-email"
                value={companyForm.email}
                onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-phone">Phone</Label>
              <Input
                id="company-phone"
                value={companyForm.phone}
                onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-tax">Tax ID</Label>
              <Input
                id="company-tax"
                value={companyForm.taxId}
                onChange={(e) => setCompanyForm({ ...companyForm, taxId: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="company-address">Address</Label>
              <Input
                id="company-address"
                value={companyForm.address}
                onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-location">Receipt Location</Label>
              <Input
                id="company-location"
                value={companyForm.location}
                onChange={(e) => setCompanyForm({ ...companyForm, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-contact-line">Receipt Contact</Label>
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
            <div className="space-y-2 col-span-2">
              <Label htmlFor="receipt-slogan">Receipt Slogan</Label>
              <Input
                id="receipt-slogan"
                value={companyForm.receiptSlogan}
                onChange={(e) => setCompanyForm({ ...companyForm, receiptSlogan: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="receipt-verify-url">Receipt Verification Base URL</Label>
              <Input
                id="receipt-verify-url"
                value={companyForm.receiptVerificationBaseUrl}
                onChange={(e) => setCompanyForm({ ...companyForm, receiptVerificationBaseUrl: e.target.value })}
                placeholder="Leave blank to use this app URL"
              />
            </div>
          </div>
          <Button onClick={handleCompanySave} className="mt-2">
            <Save className="h-4 w-4 mr-2" />
            Save Company Details
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Theme Settings
          </CardTitle>
          <CardDescription>Customize the app appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="theme-mode">Color Mode</Label>
              <Select
                value={themeForm.mode}
                onValueChange={(v: "light" | "dark" | "system") => setThemeForm({ ...themeForm, mode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <Input
                id="primary-color"
                type="color"
                value={themeForm.primaryColor}
                onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={handleThemeSave} className="mt-2">
            <Save className="h-4 w-4 mr-2" />
            Save Theme Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-medium">1.0.0</dd>
            <dt className="text-muted-foreground">Platform</dt>
            <dd className="font-medium">Queenstech Inventory</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
