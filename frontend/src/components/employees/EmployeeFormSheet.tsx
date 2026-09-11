import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Info } from "lucide-react";
import type {
  Employee,
  EmployeeDraft,
  EmployeeStatus,
  EmploymentType,
} from "./employees-store";
import { DEPARTMENTS } from "./employees-store";
import { useBranch } from "@/contexts/BranchContext";
import { SYSTEM_ROLES, getRoleInfo, type UserRoleType } from "@/lib/roles";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Employee | null;
  onSave: (e: EmployeeDraft | Employee) => Promise<void>;
}

const EMPTY: EmployeeDraft = {
  name: "", email: "", phone: "", role: "Staff", department: "Operations", location: "", branchId: "",
  employmentType: "full_time", status: "active", joinedAt: new Date().toISOString().slice(0, 10),
  salary: 0, skills: [], manager: "", bio: "",
};

export function EmployeeFormSheet({ open, onOpenChange, initial, onSave }: Props) {
  const { branches } = useBranch();
  const [f, setF] = useState<EmployeeDraft | Employee>(EMPTY);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [systemRole, setSystemRole] = useState<UserRoleType>("staff");
  const [jobTitle, setJobTitle] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  useEffect(() => {
    if (initial) {
      setF(initial);
      const parts = initial.name.trim().split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
      const info = getRoleInfo(initial.role);
      setSystemRole(info.key);
      setJobTitle(initial.role);
      setSkillsText(initial.skills.join(", "));
      setSelectedBranchId(initial.branchId || "");
    } else {
      setF(EMPTY);
      setFirstName("");
      setLastName("");
      setSystemRole("staff");
      setJobTitle("Staff");
      setSkillsText("");
      setSelectedBranchId(branches.length > 0 ? branches[0].id : "");
      if (branches.length > 0) {
        setF((prev) => ({ ...prev, location: branches[0].name, branchId: branches[0].id }));
      }
    }
  }, [initial, open, branches]);

  const handleRoleChange = (selected: UserRoleType) => {
    setSystemRole(selected);
    const info = SYSTEM_ROLES[selected];
    if (!jobTitle || jobTitle === "Admin" || jobTitle === "Manager" || jobTitle === "Requestor" || jobTitle === "Staff") {
      setJobTitle(info.label);
    }
  };

  async function submit() {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName || !f.email) return;
    const finalRole = jobTitle.trim() || SYSTEM_ROLES[systemRole].label;
    const matchedBranch = branches.find((b) => b.id === selectedBranchId);
    const finalLocation = matchedBranch ? matchedBranch.name : f.location;
    await onSave({
      ...f,
      name: fullName,
      role: finalRole,
      systemRole,
      location: finalLocation,
      branchId: selectedBranchId || f.branchId,
      skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
    });
  }

  const currentRoleInfo = SYSTEM_ROLES[systemRole] ?? SYSTEM_ROLES.requestor;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit employee" : "Add new employee"}</SheetTitle>
          <SheetDescription>Set up employee profile, department, and system access role</SheetDescription>
        </SheetHeader>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <Label>First name *</Label>
            <Input placeholder="e.g. Wamala" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>

          <div>
            <Label>Last name *</Label>
            <Input placeholder="e.g. Leo" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>

          <div>
            <Label>Email *</Label>
            <Input type="email" placeholder="leo@queenstech.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>

          <div>
            <Label>Phone</Label>
            <Input placeholder="+256 700 000000" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </div>

          {/* System Role Selector */}
          <div className="col-span-2 rounded-xl border bg-slate-50/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Employee Access Role *
              </Label>
              <Badge className={currentRoleInfo.badgeColor}>
                {currentRoleInfo.label}
              </Badge>
            </div>

            <Select value={systemRole} onValueChange={(v) => handleRoleChange(v as UserRoleType)}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select access role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex flex-col">
                    <span className="font-medium text-destructive">Admin (Full Access)</span>
                    <span className="text-xs text-muted-foreground">Full access to all system modules, finances, & settings</span>
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div className="flex flex-col">
                    <span className="font-medium">Manager</span>
                    <span className="text-xs text-muted-foreground">Inventory, Orders, Customers, Transactions, Bank, Debtors, Creditors, Expenses, Chat, Assets, Reports, Supplies, POs, Help</span>
                  </div>
                </SelectItem>
                <SelectItem value="staff">
                  <div className="flex flex-col">
                    <span className="font-medium">Staff</span>
                    <span className="text-xs text-muted-foreground">Transactions, Orders, Chatroom, Assets, Reports, Help</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Granted Modules Preview */}
            <div className="rounded-lg border border-border/70 bg-white p-3 space-y-2 text-xs">
              <p className="text-muted-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                {currentRoleInfo.description}
              </p>
              <div>
                <p className="font-medium text-slate-700 mb-1">Permitted Modules ({currentRoleInfo.accessibleModules.length}):</p>
                <div className="flex flex-wrap gap-1">
                  {currentRoleInfo.accessibleModules.map((m) => (
                    <Badge key={m} variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label>Job Designation / Title</Label>
            <Input
              placeholder="e.g. Senior Manager"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>

          <div>
            <Label>Department</Label>
            <Select value={f.department} onValueChange={(v) => setF({ ...f, department: v })}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Manager / Supervisor</Label>
            <Input value={f.manager ?? ""} onChange={(e) => setF({ ...f, manager: e.target.value })} placeholder="Supervisor name" />
          </div>

          <div>
            <Label>Assigned Company Branch</Label>
            {branches.length > 0 ? (
              <Select
                value={selectedBranchId}
                onValueChange={(val) => {
                  setSelectedBranchId(val);
                  const b = branches.find((item) => item.id === val);
                  if (b) {
                    setF((prev) => ({ ...prev, location: b.name, branchId: b.id }));
                  }
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={f.location}
                onChange={(e) => setF({ ...f, location: e.target.value })}
                placeholder="Branch location"
              />
            )}
          </div>

          <div>
            <Label>Employment Type</Label>
            <Select value={f.employmentType} onValueChange={(v) => setF({ ...f, employmentType: v as EmploymentType })}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full-time</SelectItem>
                <SelectItem value="part_time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as EmployeeStatus })}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_leave">On leave</SelectItem>
                <SelectItem value="probation">Probation</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Joined Date</Label>
            <Input type="date" value={f.joinedAt} onChange={(e) => setF({ ...f, joinedAt: e.target.value })} />
          </div>

          <div>
            <Label>Salary (UGX)</Label>
            <Input type="number" value={f.salary} onChange={(e) => setF({ ...f, salary: Number(e.target.value) })} />
          </div>

          <div className="col-span-2">
            <Label>Skills (comma separated)</Label>
            <Input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="e.g. Inventory Control, QuickBooks, Procurement" />
          </div>

          <div className="col-span-2">
            <Label>Bio / Notes</Label>
            <Textarea rows={2} value={f.bio ?? ""} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Additional personnel notes" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{initial ? "Save changes" : "Create employee"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
