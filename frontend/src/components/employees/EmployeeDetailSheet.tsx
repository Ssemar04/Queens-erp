import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  Wallet,
  Award,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Trash2,
  KeyRound,
  Copy,
  Check,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import type { Employee } from "./employees-store";
import { employeeInitials, STATUS_LABEL } from "./employees-store";
import { getRoleInfo, SYSTEM_ROLES, type UserRoleType } from "@/lib/roles";
import { Link } from "@tanstack/react-router";
import {
  getEmployeeCredentials,
  resetEmployeeCredentials,
  updateEmployeeAccount,
  type EmployeeOneTimeCredentials,
} from "@/services/api";

import { useBranch } from "@/contexts/BranchContext";

interface Props {
  employee: Employee | null;
  onClose: () => void;
  onEdit: (e: Employee) => void;
  onDelete?: (e: Employee) => void;
  onAccountUpdated?: (employee: Employee) => void;
}

function tenure(joined: string) {
  const d = new Date(joined);
  const now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y}y`, m && `${m}mo`].filter(Boolean).join(" ") || "<1mo";
}

export function EmployeeDetailSheet({ employee, onClose, onEdit, onDelete, onAccountUpdated }: Props) {
  if (!employee) return null;
  return (
    <EmployeeDetailSheetBody
      employee={employee}
      onClose={onClose}
      onEdit={onEdit}
      onDelete={onDelete}
      onAccountUpdated={onAccountUpdated}
    />
  );
}

function EmployeeDetailSheetBody({
  employee, onClose, onEdit, onDelete, onAccountUpdated,
}: Props & { employee: NonNullable<Props["employee"]> }) {
  const { branches } = useBranch();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [credentials, setCredentials] = useState<EmployeeOneTimeCredentials | null>(null);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountRole, setAccountRole] = useState<UserRoleType>("staff");
  const [accountActive, setAccountActive] = useState(true);
  const [accountBranchId, setAccountBranchId] = useState<string>("");
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    if (employee) {
      setLoadingCreds(true);
      setAccountBranchId(employee.branchId || "");
      getEmployeeCredentials(employee.id)
        .then((cred) => {
          setCredentials(cred);
          setAccountEmail(cred.email);
          setAccountRole(cred.role);
          setAccountActive(cred.isActive);
        })
        .catch(() => setCredentials(null))
        .finally(() => setLoadingCreds(false));
    } else {
      setCredentials(null);
      setAccountEmail("");
      setAccountRole("staff");
      setAccountActive(true);
      setAccountBranchId("");
    }
  }, [employee]);

  const handleCopyCredentials = () => {
    if (!employee || !credentials) return;
    const textToCopy = `Login Credentials for ${employee.name}:
Email: ${credentials.email}
${credentials.oneTimePassword ? `One-Time Password: ${credentials.oneTimePassword}` : "Password: User established personal password"}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Login credentials copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetCredentials = async () => {
    if (!employee) return;
    setResetting(true);
    try {
      const fresh = await resetEmployeeCredentials(employee.id);
      setCredentials(fresh);
      setAccountEmail(fresh.email);
      setAccountRole(fresh.role);
      setAccountActive(fresh.isActive);
      toast.success(`New one-time credentials issued for ${employee.name}!`);
    } catch {
      toast.error("Could not reset employee credentials");
    } finally {
      setResetting(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!employee) return;
    setSavingAccount(true);
    try {
      const result = await updateEmployeeAccount(employee.id, {
        email: accountEmail,
        role: accountRole,
        isActive: accountActive,
        branchId: accountBranchId || employee.branchId,
      });
      setCredentials(result.credentials);
      setAccountEmail(result.credentials.email);
      setAccountRole(result.credentials.role);
      setAccountActive(result.credentials.isActive);
      onAccountUpdated?.(result.employee);
      toast.success("Employee login account updated");
    } catch (error) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(message || "Could not update employee login account");
    } finally {
      setSavingAccount(false);
    }
  };

  const e = employee;
  const roleInfo = getRoleInfo(e.role);

  return (
    <>
      <Sheet open={!!employee} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white">
          <SheetHeader>
            <SheetTitle className="sr-only">{e.name}</SheetTitle>
          </SheetHeader>
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold text-lg">
              {employeeInitials(e.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold truncate">{e.name}</h2>
                <Badge variant="secondary" className="font-mono text-[10px]">{e.code}</Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{e.role} · {e.department}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge className="bg-emerald-500/10 text-emerald-700">{STATUS_LABEL[e.status]}</Badge>
                <Badge className={roleInfo.badgeColor}>{roleInfo.label} Role</Badge>
                <Badge variant="outline" className="capitalize">{e.employmentType.replace("_", " ")}</Badge>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email">{e.email}</Row>
            <Row icon={<Phone className="h-3.5 w-3.5" />} label="Phone">{e.phone}</Row>
            <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Branch / Location">{e.location}</Row>
            <Row icon={<Briefcase className="h-3.5 w-3.5" />} label="Manager">{e.manager || "—"}</Row>
            <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Tenure">{tenure(e.joinedAt)} · since {e.joinedAt}</Row>
            <Row icon={<Wallet className="h-3.5 w-3.5" />} label="Salary">UGX {e.salary.toLocaleString()}</Row>
          </div>

          {/* Account Credentials Card */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-amber-600" /> Account & Login Credentials
              </span>
              <div className="flex items-center gap-1.5">
                <Badge className={accountActive ? "bg-emerald-500/15 text-emerald-800 border-emerald-300 text-[10px]" : "bg-slate-500/15 text-slate-700 border-slate-300 text-[10px]"}>
                  {accountActive ? "Login Active" : "Suspended"}
                </Badge>
                {credentials?.mustChangePassword ? (
                  <Badge className="bg-amber-500/15 text-amber-800 border-amber-300 text-[10px]">
                    Temporary Password
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/15 text-blue-800 border-blue-300 text-[10px]">
                    Password Set
                  </Badge>
                )}
              </div>
            </div>

            {loadingCreds ? (
              <p className="text-xs text-muted-foreground animate-pulse">Loading login credentials...</p>
            ) : credentials ? (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border bg-white p-2.5">
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground font-medium">Login Email</Label>
                    <Input
                      value={accountEmail}
                      onChange={(event) => setAccountEmail(event.target.value)}
                      className="mt-1 h-8 bg-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground font-medium">Account Role</Label>
                    <Select value={accountRole} onValueChange={(value) => setAccountRole(value as UserRoleType)}>
                      <SelectTrigger className="mt-1 h-8 bg-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(SYSTEM_ROLES).map((role) => (
                          <SelectItem key={role.key} value={role.key}>{role.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-medium">Assigned Sub-DB Branch</Label>
                    <Select value={accountBranchId} onValueChange={(value) => setAccountBranchId(value)}>
                      <SelectTrigger className="mt-1 h-8 bg-white text-xs">
                        <SelectValue placeholder="Select branch assignment" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name} ({b.id})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {credentials.oneTimePassword ? (
                    <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">One-Time Password</p>
                      <p className="font-mono font-bold text-amber-700 select-all">{credentials.oneTimePassword}</p>
                    </div>
                  ) : (
                    <div className="sm:col-span-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">Password Status</p>
                      <p className="text-emerald-700 font-medium">Custom User Password</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <Button
                    size="sm"
                    variant={accountActive ? "outline" : "secondary"}
                    onClick={() => setAccountActive((current) => !current)}
                    className="h-8 gap-1.5 text-xs bg-white"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {accountActive ? "Suspend Login" : "Reactivate Login"}
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleSaveAccount}
                    disabled={savingAccount}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {savingAccount ? "Saving..." : "Save Account"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyCredentials}
                    className="h-8 gap-1.5 text-xs bg-white"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy & Share Credentials"}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetCredentials}
                    disabled={resetting}
                    className="h-8 gap-1.5 text-xs text-slate-600 hover:text-amber-700"
                  >
                    <RotateCcw className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} />
                    {resetting ? "Resetting..." : "Issue New Temporary Password"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No credentials information found.</p>
            )}
          </div>

          {/* System Module Permissions Card */}
          <div className="mt-4 rounded-xl border bg-slate-50/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> System Module Access ({roleInfo.accessibleModules.length})
              </span>
              <Badge variant="outline" className="text-[10px] bg-white">{roleInfo.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{roleInfo.description}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {roleInfo.accessibleModules.map((mod) => (
                <Badge key={mod} variant="secondary" className="text-[10px] px-1.5 py-0 bg-white border border-slate-200 text-slate-800">
                  {mod}
                </Badge>
              ))}
            </div>
          </div>

          {e.skills.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5"><Award className="h-3 w-3" /> Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {e.skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
              </div>
            </div>
          )}

          {e.bio && <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{e.bio}</p>}

          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <div className="flex gap-1.5">
              <Button onClick={() => onEdit(e)}><Pencil className="h-4 w-4 mr-1.5" />Edit</Button>
              <Button variant="outline" asChild><Link to="/app/chat"><MessageSquare className="h-4 w-4 mr-1.5" />Message</Link></Button>
            </div>
            {onDelete && (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete Employee Record
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong className="text-slate-900">{e.name}</strong> ({e.code})? This personnel record will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                setConfirmDelete(false);
                onDelete?.(e);
              }}
            >
              Delete Employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="mt-0.5 font-medium truncate">{children}</div>
    </div>
  );
}
