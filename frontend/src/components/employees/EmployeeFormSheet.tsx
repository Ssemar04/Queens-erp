import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Info, CheckSquare, Square } from "lucide-react";
import type {
  Employee,
  EmployeeDraft,
  EmployeeStatus,
  EmploymentType,
} from "./employees-store";
import { useDepartments } from "./employees-store";
import { useBranch } from "@/contexts/BranchContext";
import {
  ALL_SYSTEM_MODULES,
  ACCESS_ROLE_PRESETS,
  getDefaultAllowedPagesForRole,
  SYSTEM_ROLES,
  getRoleInfo,
  type UserRoleType,
  type SystemModule,
} from "@/lib/roles";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Employee | null;
  onSave: (e: EmployeeDraft | Employee) => Promise<void>;
}

const EMPTY: EmployeeDraft = {
  name: "", email: "", phone: "", role: "Staff", department: "Sales and Marketing", location: "", branchId: "",
  employmentType: "full_time", status: "active", joinedAt: new Date().toISOString().slice(0, 10),
  salary: 0, skills: [], manager: "", bio: "",
};

export function EmployeeFormSheet({ open, onOpenChange, initial, onSave }: Props) {
  const { branches } = useBranch();
  const { departments } = useDepartments();
  const [f, setF] = useState<EmployeeDraft | Employee>(EMPTY);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [systemRole, setSystemRole] = useState<UserRoleType>("staff");
  const [jobTitle, setJobTitle] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("staff");

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

      const initialPages =
        initial.allowedPages && initial.allowedPages.length > 0
          ? initial.allowedPages
          : getDefaultAllowedPagesForRole(initial.role);
      setSelectedPages(initialPages);

      const matched = ACCESS_ROLE_PRESETS.find(
        (p) =>
          p.allowedModules.length === initialPages.length &&
          p.allowedModules.every((m) => initialPages.includes(m))
      );
      setSelectedPreset(matched ? matched.id : "custom");
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
      const defaultPages = getDefaultAllowedPagesForRole("staff");
      setSelectedPages(defaultPages);
      setSelectedPreset("staff");
    }
  }, [initial, open, branches]);

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = ACCESS_ROLE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      if (preset.id === "admin") {
        setSystemRole("admin");
      } else if (preset.id === "manager") {
        setSystemRole("manager");
      } else {
        setSystemRole("staff");
      }
      if (preset.allowedModules.length > 0) {
        setSelectedPages(preset.allowedModules);
      }
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
      allowedPages: selectedPages,
      location: finalLocation,
      branchId: selectedBranchId || f.branchId,
      skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
    });
  }

  const currentRoleInfo = SYSTEM_ROLES[systemRole] ?? SYSTEM_ROLES.staff;
  const groups = Array.from(new Set(ALL_SYSTEM_MODULES.map((m) => m.group)));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-white p-6">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit employee" : "Add new employee"}</SheetTitle>
          <SheetDescription>Set up employee profile, branch sub-database assignment, and page access role</SheetDescription>
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

          {/* Access Role & Page Access Customization */}
          <div className="col-span-2 rounded-xl border bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Employee Access Role & Page Permissions *
              </Label>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {selectedPages.length} / {ALL_SYSTEM_MODULES.length} Pages Allowed
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Role Preset</Label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select role preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_ROLE_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{preset.label}</span>
                          <span className="text-[11px] text-muted-foreground">{preset.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Job Designation / Title</Label>
                <Input
                  placeholder="e.g. Senior Manager"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>

            {/* Interactive Page Access Checkboxes */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
              <div className="flex items-center justify-between border-b pb-2 text-xs">
                <span className="font-medium text-slate-700 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-sky-600" />
                  Specific Page Access Permissions:
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" type="button" onClick={handleSelectAll} className="h-6 text-[11px] px-2 text-emerald-700 hover:bg-emerald-50">
                    <CheckSquare className="h-3 w-3 mr-1" /> Select All
                  </Button>
                  <Button variant="ghost" size="sm" type="button" onClick={handleClearAll} className="h-6 text-[11px] px-2 text-rose-700 hover:bg-rose-50">
                    <Square className="h-3 w-3 mr-1" /> Clear All
                  </Button>
                </div>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {groups.map((group) => {
                  const modulesInGroup = ALL_SYSTEM_MODULES.filter((m) => m.group === group);
                  return (
                    <div key={group} className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        {group}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {modulesInGroup.map((mod: SystemModule) => {
                          const isChecked = selectedPages.includes(mod.name);
                          return (
                            <label
                              key={mod.id}
                              className={`flex items-center gap-2 p-1.5 rounded-md border cursor-pointer text-xs transition-colors ${
                                isChecked ? "bg-emerald-50/60 border-emerald-200 font-medium text-emerald-900" : "bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => togglePage(mod.name)}
                              />
                              <span className="truncate">{mod.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <Label>Department</Label>
            <Select value={f.department} onValueChange={(v) => setF({ ...f, department: v })}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Manager / Supervisor</Label>
            <Input placeholder="e.g. Director Operations" value={f.manager ?? ""} onChange={(e) => setF({ ...f, manager: e.target.value })} />
          </div>

          <div className="col-span-2">
            <Label>Assigned Company Branch Sub-Database *</Label>
            <Select value={selectedBranchId} onValueChange={(v) => setSelectedBranchId(v)}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select company branch sub-database" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.address || b.street || "Main Branch"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Employee account will be strictly restricted to accessing this specific branch sub-database.
            </p>
          </div>

          <div>
            <Label>Employment Type</Label>
            <Select value={f.employmentType} onValueChange={(v) => setF({ ...f, employmentType: v as EmploymentType })}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full Time</SelectItem>
                <SelectItem value="part_time">Part Time</SelectItem>
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
                <SelectItem value="probation">Probation</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Joined date</Label>
            <Input type="date" value={f.joinedAt} onChange={(e) => setF({ ...f, joinedAt: e.target.value })} />
          </div>

          <div>
            <Label>Monthly Salary (UGX)</Label>
            <Input type="number" value={f.salary} onChange={(e) => setF({ ...f, salary: Number(e.target.value) })} />
          </div>

          <div className="col-span-2">
            <Label>Skills & Qualifications (comma separated)</Label>
            <Input placeholder="e.g. Sales, QuickBooks, Customer Care" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
          </div>

          <div className="col-span-2">
            <Label>Emergency Contact</Label>
            <Input placeholder="e.g. Next of kin (+256 770 000000)" value={f.emergencyContact ?? ""} onChange={(e) => setF({ ...f, emergencyContact: e.target.value })} />
          </div>

          <div className="col-span-2">
            <Label>Bio / Notes</Label>
            <Textarea placeholder="Short background, notes, responsibilities..." value={f.bio ?? ""} onChange={(e) => setF({ ...f, bio: e.target.value })} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Save Employee Profile
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
