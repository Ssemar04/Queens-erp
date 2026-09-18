import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Check, X, Building2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: string[];
  onAdd: (name: string) => boolean;
  onEdit: (oldName: string, newName: string) => boolean;
  onDelete: (name: string) => void;
}

export function DepartmentManagerModal({
  open,
  onOpenChange,
  departments,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const [newDept, setNewDept] = useState("");
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.trim()) return;
    if (onAdd(newDept)) {
      setNewDept("");
    }
  };

  const startEdit = (dept: string) => {
    setEditingDept(dept);
    setEditValue(dept);
  };

  const cancelEdit = () => {
    setEditingDept(null);
    setEditValue("");
  };

  const handleSaveEdit = (oldName: string) => {
    if (!editValue.trim()) return;
    if (onEdit(oldName, editValue)) {
      setEditingDept(null);
      setEditValue("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Building2 className="h-5 w-5 text-emerald-600" />
            Manage Departments
          </DialogTitle>
          <DialogDescription>
            Add, rename, or remove employee departments across the organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="mt-2 flex items-center gap-2">
          <Input
            placeholder="New department name..."
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </form>

        <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No departments found.</p>
          ) : (
            departments.map((dept) => (
              <div
                key={dept}
                className="flex items-center justify-between p-2.5 rounded-lg border bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                {editingDept === dept ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-8 text-sm bg-white"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveEdit(dept);
                        } else if (e.key === "Escape") {
                          cancelEdit();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
                      onClick={() => handleSaveEdit(dept)}
                      title="Save department name"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-500 hover:bg-slate-100 shrink-0"
                      onClick={cancelEdit}
                      title="Cancel edit"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-slate-800">{dept}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        onClick={() => startEdit(dept)}
                        title="Edit department"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(dept)}
                        title="Delete department"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
