import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Plus, Menu, User, LogOut, Settings, ChevronDown, ScanBarcode, Command, KeyRound, AlertCircle, Building2, Check } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sidebar } from "./Sidebar";
import { QuickEntryMode } from "@/components/data/QuickEntryMode";
import { CommandPalette } from "@/components/command/CommandPalette";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { UserAccountModal } from "@/components/settings/UserAccountModal";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useBranch } from "@/contexts/BranchContext";
import { PermissionGate } from "@/hooks/usePermissions";
import { toast } from "sonner";

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: "bg-primary/15 text-primary border-primary/20",
  manager: "bg-secondary/15 text-secondary-foreground border-secondary/20",
  staff: "bg-muted text-muted-foreground border-border",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  
  const { role } = useRole();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.user_metadata?.full_name || user?.email || "Signed-in user";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  const handleExit = async () => {
    await signOut();
    await navigate({ to: "/" });
  };

  // CMD+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center justify-center border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="w-full px-[var(--sp-fluid-4)] md:px-[var(--sp-fluid-6)] xl:px-[var(--sp-fluid-8)]">
        <div className="flex h-14 w-full items-center justify-center gap-2 sm:h-16 sm:gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <SidebarTrigger className="hidden shrink-0 border border-border bg-white text-muted-foreground transition-transform hover:scale-110 hover:bg-muted md:inline-flex" />
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2 font-medium">
              <span>Toggle sidebar</span>
              <kbd className="flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                <Command className="h-2.5 w-2.5" />
                <span>B</span>
              </kbd>
            </TooltipContent>
          </Tooltip>

          <button data-tour="search" type="button" onClick={() => setPaletteOpen(true)} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 md:max-w-sm">
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search...</span>
            <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs md:inline-block">⌘K</kbd>
          </button>

          <BranchSwitcher />

          <PermissionGate permission="log_movement">
            <Button size="icon" variant="outline" className="shrink-0" aria-label="Quick entry" onClick={() => setQuickEntryOpen(true)}>
              <ScanBarcode className="h-4 w-4" />
            </Button>
          </PermissionGate>

          <PermissionGate permission="create_item">
            <Button size="icon" variant="outline" className="shrink-0" aria-label="New item" onClick={() => navigate({ to: "/app/catalog", search: { newItem: "true" } })}>
              <Plus className="h-4 w-4" />
            </Button>
          </PermissionGate>

          <NotificationBell onClick={() => setNotifOpen(true)} />

          {user?.user_metadata?.mustChangePassword && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAccountModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs animate-pulse"
            >
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              <span>Change Temp Password</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 hover:bg-muted transition-colors" aria-label="User menu">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden border border-primary/20">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <span className="hidden max-w-40 truncate text-sm font-medium lg:inline-block">{displayName}</span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:inline-block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="flex items-center justify-between font-normal text-xs text-muted-foreground">
                <span className="truncate max-w-[110px]">{displayName}</span>
                <Badge variant="outline" className={`ml-2 text-[10px] font-semibold uppercase ${ROLE_BADGE_STYLES[role]}`}>
                  {ROLE_LABELS[role]}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAccountModalOpen(true)}>
                <User className="mr-2 h-4 w-4 text-primary" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExit}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-[260px] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Sidebar onNavigate={() => setMobileOpen(false)} allowCollapse={false} />
            </SheetContent>
          </Sheet>

          <QuickEntryMode open={quickEntryOpen} onOpenChange={setQuickEntryOpen} />
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
          <NotificationCenter open={notifOpen} onOpenChange={setNotifOpen} onOpenPrefs={() => { setNotifOpen(false); setTimeout(() => setPrefsOpen(true), 300); }} />
          <NotificationPreferences open={prefsOpen} onOpenChange={setPrefsOpen} />
          <UserAccountModal open={accountModalOpen} onOpenChange={setAccountModalOpen} />
        </div>
      </div>
    </header>
  );
}

function BranchSwitcher() {
  const { currentBranchId, branches, selectedBranch, switchBranch, isLocked } = useBranch();

  if (isLocked) {
    return (
      <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border-primary/30 bg-primary/5 text-primary">
        <Building2 className="h-3.5 w-3.5" />
        <span className="font-medium max-w-[120px] truncate">{selectedBranch?.name || "Assigned Branch"}</span>
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium border-border hover:bg-muted">
          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="max-w-[120px] truncate">{selectedBranch?.name || "Select Branch"}</span>
          <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Company Branches (Sub-DB)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((b) => {
          const isSelected = b.id === currentBranchId;
          return (
            <DropdownMenuItem
              key={b.id}
              onClick={() => {
                switchBranch(b.id);
                toast.success(`Switched active database context to ${b.name}`);
              }}
              className="flex items-center justify-between text-xs cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <span className={isSelected ? "font-semibold text-foreground" : "text-muted-foreground"}>{b.name}</span>
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary ml-2 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
