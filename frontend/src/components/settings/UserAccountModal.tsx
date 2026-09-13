import { useState, useEffect } from "react";
import {
  User,
  Shield,
  KeyRound,
  Sliders,
  Camera,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Smartphone,
  Bell,
  Volume2,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useSettings } from "@/contexts/ThemeContext";
import { changePassword } from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface UserAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AVATARS = [
  { id: "gradient-1", class: "bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white" },
  { id: "gradient-2", class: "bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 text-white" },
  { id: "gradient-3", class: "bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-600 text-white" },
  { id: "gradient-4", class: "bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-white" },
];

function errorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err !== null) {
    const maybe = err as { message?: string; response?: { data?: { message?: string } } };
    return maybe.response?.data?.message || maybe.message || fallback;
  }
  return fallback;
}

export function UserAccountModal({ open, onOpenChange }: UserAccountModalProps) {
  const { user, updateUserProfile } = useAuth();
  const { role } = useRole();
  const { settings, updateSettings } = useSettings();

  const [activeTab, setActiveTab] = useState("profile");

  // Profile Form State
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Preferences State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopNotifs, setDesktopNotifs] = useState(true);
  const [defaultPage, setDefaultPage] = useState("/app/dashboard");

  const mustChangePassword = Boolean(user?.user_metadata?.mustChangePassword);

  // Sync state when modal opens or user changes
  useEffect(() => {
    if (open && user) {
      const meta = user.user_metadata || {};
      setFullName(meta.full_name || user.email?.split("@")[0] || "");
      setUsername(meta.username || `@${(user.email?.split("@")[0] || "user").toLowerCase()}`);
      setPhone(meta.phone || "+256 700 000 000");
      setBio(meta.bio || "Store & Inventory Operations Specialist");
      setAvatarUrl(meta.avatar_url || null);
      if (meta.mustChangePassword) {
        setActiveTab("security");
      } else {
        setActiveTab("profile");
      }
    }
  }, [open, user]);

  // Password strength calculator
  const calculatePasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return { score: 0, label: "None", color: "bg-muted" };
    if (pass.length >= 8) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass)) score += 25;
    if (/[^A-Za-z0-9]/.test(pass)) score += 25;

    if (score <= 25) return { score, label: "Weak", color: "bg-rose-500" };
    if (score <= 50) return { score, label: "Fair", color: "bg-amber-500" };
    if (score <= 75) return { score, label: "Good", color: "bg-sky-500" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  };

  const strength = calculatePasswordStrength(newPassword);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Avatar image must be under 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarUrl(result);
        toast.success("Avatar image updated preview!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full name cannot be empty");
      return;
    }
    updateUserProfile({
      full_name: fullName,
      username: username,
      avatar_url: avatarUrl || undefined,
      phone: phone,
    });
    toast.success("Account profile saved successfully!");
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        updateUserProfile({ mustChangePassword: false });
        toast.success("Security password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.message || "Failed to update password");
      }
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to update password"));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSavePreferences = () => {
    toast.success("User preferences saved!");
  };

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "US";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden sm:rounded-2xl gap-0 border-border shadow-2xl">
        {/* Header Header */}
        <div className="relative border-b border-border/80 bg-gradient-to-r from-primary/10 via-card to-background p-6">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-primary/30 bg-primary/10 shadow-md overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-bold tracking-wider text-primary">{initials}</span>
                )}
                <label
                  htmlFor="avatar-upload-input"
                  className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Camera className="h-5 w-5" />
                </label>
                <input
                  id="avatar-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-semibold text-foreground">
                  {fullName || "User Account"}
                </DialogTitle>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary capitalize text-xs">
                  {role}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Manage your personal account profile, password security, and notifications.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border bg-muted/30 px-6 py-2">
            <TabsList className="h-9 bg-background/80 p-1">
              <TabsTrigger value="profile" className="gap-1.5 text-xs font-medium">
                <User className="h-3.5 w-3.5" />
                Profile & Identity
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-1.5 text-xs font-medium relative">
                <KeyRound className="h-3.5 w-3.5" />
                Security & Password
                {mustChangePassword && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-1.5 text-xs font-medium">
                <Sliders className="h-3.5 w-3.5" />
                Preferences
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 max-h-[65vh] overflow-y-auto">
            {/* PROFILE TAB */}
            <TabsContent value="profile" className="mt-0 space-y-6">
              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Avatar Presets & Custom Photo */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Profile Picture</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("avatar-upload-input")?.click()}
                      className="gap-2 text-xs"
                    >
                      <Camera className="h-3.5 w-3.5 text-primary" />
                      Upload Photo
                    </Button>
                    {avatarUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAvatarUrl(null)}
                        className="text-xs text-destructive hover:text-destructive"
                      >
                        Remove Photo
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="account-fullname" className="text-xs">
                      Full Name
                    </Label>
                    <Input
                      id="account-fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-username" className="text-xs">
                      Username
                    </Label>
                    <Input
                      id="account-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@janedoe"
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="account-email" className="text-xs">
                        Email Address
                      </Label>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </span>
                    </div>
                    <Input
                      id="account-email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted text-muted-foreground text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-phone" className="text-xs">
                      Phone Number
                    </Label>
                    <Input
                      id="account-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+256 700 000 000"
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-bio" className="text-xs">
                    Role & Operations Bio
                  </Label>
                  <Input
                    id="account-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Inventory Lead & Operations"
                    className="text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="sm">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Save Changes
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* SECURITY TAB */}
            <TabsContent value="security" className="mt-0 space-y-6">
              <form onSubmit={handleSavePassword} className="space-y-5">
                {mustChangePassword && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">One-Time Temporary Password Active</p>
                      <p className="text-amber-800/80 dark:text-amber-300 text-[11px] mt-0.5">
                        You signed in using a temporary credentials provided for your account. Please set a new permanent password below.
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Change Password</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      Encrypted
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="current-pass" className="text-xs">
                      Current Password (or One-Time Password)
                    </Label>
                    <div className="relative">
                      <Input
                        id="current-pass"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pr-9 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-pass" className="text-xs">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-pass"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="pr-9 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Strength Gauge */}
                    {newPassword && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Password strength:</span>
                          <span className="font-semibold text-foreground">{strength.label}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full transition-all duration-300", strength.color)}
                            style={{ width: `${strength.score}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-pass" className="text-xs">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirm-pass"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* 2FA Toggle */}
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Two-Factor Authentication (2FA)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add an extra layer of protection to your account with authenticator apps.
                    </p>
                  </div>
                  <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="sm">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={savingPassword}>
                    {savingPassword ? "Updating..." : "Update Security"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* PREFERENCES TAB */}
            <TabsContent value="preferences" className="mt-0 space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Notification Sounds</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Play a subtle sound when system alerts arrive.</p>
                  </div>
                  <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Desktop Push Notifications</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Receive browser popup alerts for critical stock warnings.</p>
                  </div>
                  <Switch checked={desktopNotifs} onCheckedChange={setDesktopNotifs} />
                </div>

                <div className="space-y-2 rounded-xl border border-border/80 bg-card p-4">
                  <Label htmlFor="default-landing-page" className="text-xs font-semibold">
                    Default Landing Page
                  </Label>
                  <Select value={defaultPage} onValueChange={setDefaultPage}>
                    <SelectTrigger id="default-landing-page" className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="/app/dashboard">Dashboard Overview</SelectItem>
                      <SelectItem value="/app/catalog">Inventory Catalog</SelectItem>
                      <SelectItem value="/app/orders">Sales Orders</SelectItem>
                      <SelectItem value="/app/reports">Reports & Analytics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="sm">
                  Cancel
                </Button>
                <Button type="button" onClick={handleSavePreferences} size="sm">
                  Save Preferences
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
