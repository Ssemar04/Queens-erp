import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Users, UserCheck, UserMinus, MapPin, LayoutGrid, List as ListIcon, Mail, Phone, Trash2, Building2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import {
  useEmployees,
  useDepartments,
  employeeInitials,
  STATUS_LABEL,
  type Employee,
  type EmployeeDraft,
  type EmployeeStatus,
} from "@/components/employees/employees-store";
import { EmployeeFormSheet } from "@/components/employees/EmployeeFormSheet";
import { EmployeeDetailSheet } from "@/components/employees/EmployeeDetailSheet";
import { OneTimeCredentialsModal } from "@/components/employees/OneTimeCredentialsModal";
import { DepartmentManagerModal } from "@/components/employees/DepartmentManagerModal";
import { PageAccessModal } from "@/components/employees/PageAccessModal";
import type { EmployeeOneTimeCredentials } from "@/services/api";

import { useBranch } from "@/contexts/BranchContext";

export const Route = createFileRoute("/app/employees")({
  component: EmployeesPage,
  head: () => ({ meta: [{ title: "Employees · Queenstech ERP" }] }),
});

const STATUS_CLS: Record<EmployeeStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  on_leave: "bg-amber-500/10 text-amber-700",
  probation: "bg-blue-500/10 text-blue-700",
  inactive: "bg-slate-500/10 text-slate-600",
};

function EmployeesPage() {
  const { employees, add, update, remove, replace } = useEmployees();
  const { departments, addDepartment, editDepartment, deleteDepartment } = useDepartments();
  const { isAdmin } = useRole();
  const { branches: companyBranches } = useBranch();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState<string>("all");
  const [status, setStatus] = useState<EmployeeStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [active, setActive] = useState<Employee | null>(null);

  // Department Manager Modal State
  const [deptModalOpen, setDeptModalOpen] = useState(false);

  // Credentials Modal State
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<EmployeeOneTimeCredentials | null>(null);
  const [createdEmpName, setCreatedEmpName] = useState("");

  // Page Access Modal State
  const [pageAccessModalOpen, setPageAccessModalOpen] = useState(false);
  const [pageAccessEmp, setPageAccessEmp] = useState<Employee | null>(null);

  async function handleSavePageAccess(employeeId: string, allowedPages: string[]) {
    await update(employeeId, { allowedPages });
    toast.success("Page access permissions updated");
  }

  const branches = useMemo(() => {
    const set = new Set<string>();
    companyBranches.forEach((b) => set.add(b.name));
    employees.forEach((e) => {
      if (e.location) set.add(e.location);
    });
    return Array.from(set).sort();
  }, [employees, companyBranches]);

  const filtered = useMemo(() => employees.filter((e) => {
    if (branch !== "all" && e.location !== branch) return false;
    if (status !== "all" && e.status !== status) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q) ||
      e.code.toLowerCase().includes(q) ||
      e.location.toLowerCase().includes(q)
    );
  }), [employees, query, branch, status]);

  const kpis = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "active").length;
    const onLeave = employees.filter((e) => e.status === "on_leave").length;
    const branchCount = new Set(employees.map((e) => e.location)).size;
    const payroll = employees.filter((e) => e.status !== "inactive").reduce((s, e) => s + e.salary, 0);
    return { total, active, onLeave, branchCount, payroll };
  }, [employees]);

  const byBranch = useMemo(() => {
    const map = new Map<string, Employee[]>();
    filtered.forEach((e) => {
      const loc = e.location || "Unassigned";
      const arr = map.get(loc) ?? [];
      arr.push(e);
      map.set(loc, arr);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  async function save(emp: EmployeeDraft | Employee) {
    if ("id" in emp && emp.id) {
      await update(emp.id, emp);
      toast.success(`${emp.name} updated`);
    } else {
      const created = await add(emp);
      toast.success(`${created.name} added · ${created.code}`);

      if (created.credentials) {
        setCreatedEmpName(created.name);
        setCreatedCredentials(created.credentials);
        setCredModalOpen(true);
      }
    }
    setEditing(null);
    setFormOpen(false);
  }

  async function handleDelete(emp: Employee) {
    await remove(emp.id);
    setActive(null);
    toast.success(`${emp.name} deleted`);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">Personnel directory grouped by branch locations</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setDeptModalOpen(true)}>
              <Building2 className="h-4 w-4 mr-1.5" />
              Manage departments
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />Add employee</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={<Users className="h-4 w-4" />} label="Headcount" value={kpis.total} tint="from-emerald-500/15 to-teal-500/5" />
        <Kpi icon={<UserCheck className="h-4 w-4" />} label="Active" value={kpis.active} tint="from-blue-500/15 to-cyan-500/5" />
        <Kpi icon={<UserMinus className="h-4 w-4" />} label="On leave" value={kpis.onLeave} tint="from-amber-500/15 to-orange-500/5" />
        <Kpi icon={<MapPin className="h-4 w-4" />} label="Branches" value={kpis.branchCount} tint="from-slate-500/15 to-slate-300/5" />
        <Kpi icon={<Users className="h-4 w-4" />} label="Monthly payroll" value={`UGX ${(kpis.payroll / 1000).toFixed(0)}k`} tint="from-fuchsia-500/15 to-pink-500/5" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, role, code or branch" className="bg-white pl-9" />
        </div>
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger className="w-full sm:w-48 bg-white"><SelectValue placeholder="Branch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as EmployeeStatus | "all")}>
          <SelectTrigger className="w-full sm:w-40 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {(Object.keys(STATUS_LABEL) as EmployeeStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex rounded-md border bg-white p-0.5">
          <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => setView("grid")}><LayoutGrid className="h-4 w-4" /></Button>
          <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} onClick={() => setView("list")}><ListIcon className="h-4 w-4" /></Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No employees match" description="Try a different branch filter or add a new employee." />
      ) : view === "grid" ? (
        <div className="space-y-6">
          {byBranch.map(([loc, list]) => (
            <section key={loc}>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">{loc}</h2>
                <Badge variant="secondary" className="text-xs font-normal bg-slate-100">{list.length} {list.length === 1 ? "employee" : "employees"}</Badge>
                <div className="ml-2 h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {list.map((e) => (
                  <button key={e.id} onClick={() => setActive(e)} className="group rounded-xl border bg-white p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all relative">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold">
                        {employeeInitials(e.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{e.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{e.role}</p>
                      </div>
                      <span className={cn("h-2 w-2 rounded-full shrink-0", e.status === "active" ? "bg-emerald-500" : e.status === "on_leave" ? "bg-amber-500" : e.status === "probation" ? "bg-blue-500" : "bg-slate-400")} />
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{e.email}</p>
                      <p className="flex items-center gap-1.5 truncate"><Phone className="h-3 w-3" />{e.phone}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-1 flex-wrap">
                      <Badge variant="outline" className="font-mono text-[10px]">{e.code}</Badge>
                      {isAdmin && (
                        <Badge
                          variant="outline"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setPageAccessEmp(e);
                            setPageAccessModalOpen(true);
                          }}
                          className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-100 flex items-center gap-1"
                          title="Click to manage page access"
                        >
                          <ShieldCheck className="h-3 w-3" /> {e.allowedPages ? e.allowedPages.length : 17} Pages
                        </Badge>
                      )}
                      <Badge className={STATUS_CLS[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Branch / Location</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Page Access</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead className="w-20 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setActive(e)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">{employeeInitials(e.name)}</div>
                      <div><p className="font-medium leading-tight">{e.name}</p><p className="text-xs text-muted-foreground font-mono">{e.code}</p></div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {e.location}
                    </span>
                  </TableCell>
                  <TableCell>{e.role}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Badge
                        variant="outline"
                        onClick={(evt) => {
                          evt.stopPropagation();
                          setPageAccessEmp(e);
                          setPageAccessModalOpen(true);
                        }}
                        className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-100 flex items-center gap-1"
                        title="Click to manage page access"
                      >
                        <ShieldCheck className="h-3 w-3" /> {e.allowedPages ? e.allowedPages.length : 17} Pages Permitted
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">{e.allowedPages ? e.allowedPages.length : 17} Pages</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.department}</TableCell>
                  <TableCell><Badge className={STATUS_CLS[e.status]}>{STATUS_LABEL[e.status]}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{e.salary.toLocaleString()}</TableCell>
                  <TableCell className="text-center" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            setPageAccessEmp(e);
                            setPageAccessModalOpen(true);
                          }}
                          title="Manage Page Access"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(e)}
                        title="Delete employee"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EmployeeFormSheet open={formOpen} onOpenChange={setFormOpen} initial={editing} onSave={save} />
      <EmployeeDetailSheet
        employee={active}
        onClose={() => setActive(null)}
        onEdit={(e) => { setActive(null); setEditing(e); setFormOpen(true); }}
        onDelete={handleDelete}
        onAccountUpdated={(employee) => {
          replace(employee);
          setActive(employee);
        }}
      />
      <OneTimeCredentialsModal
        open={credModalOpen}
        onOpenChange={setCredModalOpen}
        employeeName={createdEmpName}
        credentials={createdCredentials}
      />
      <DepartmentManagerModal
        open={deptModalOpen}
        onOpenChange={setDeptModalOpen}
        departments={departments}
        onAdd={addDepartment}
        onEdit={editDepartment}
        onDelete={deleteDepartment}
      />
      <PageAccessModal
        open={pageAccessModalOpen}
        onOpenChange={setPageAccessModalOpen}
        employee={pageAccessEmp}
        onSave={handleSavePageAccess}
      />
    </div>
  );
}

function Kpi({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string | number; tint: string }) {
  return (
    <div className={cn("rounded-xl border bg-gradient-to-br p-3", tint)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-semibold font-mono">{value}</div>
    </div>
  );
}
