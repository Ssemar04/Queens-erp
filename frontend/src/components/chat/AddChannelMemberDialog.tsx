import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, Search, Building2, Check } from "lucide-react";
import { getChatEmployees, type EnrichedChatMember } from "@/services/api";
import type { Channel } from "./chat-store";

interface Props {
  channel: Channel;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAddMember: (userId: string, name: string) => Promise<void>;
  trigger?: React.ReactNode;
}

export function AddChannelMemberDialog({ channel, open: controlledOpen, onOpenChange: setControlledOpen, onAddMember, trigger }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<EnrichedChatMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getChatEmployees()
      .then((data) => {
        // Filter out employees who are already members of this channel
        const memberSet = new Set(channel.memberIds);
        setEmployees(data.filter((e) => !memberSet.has(e.userId)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, channel.memberIds, channel.id]);

  const filtered = employees.filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const nameMatch = e.name.toLowerCase().includes(q);
    const deptMatch = e.employee?.department?.toLowerCase().includes(q);
    const posMatch = e.employee?.position?.toLowerCase().includes(q);
    const codeMatch = e.employee?.code?.toLowerCase().includes(q);
    return nameMatch || deptMatch || posMatch || codeMatch;
  });

  async function handleAdd(userId: string, name: string) {
    if (addingId) return;
    setAddingId(userId);
    try {
      await onAddMember(userId, name);
      setEmployees((prev) => prev.filter((e) => e.userId !== userId));
    } catch (err) {
      console.error("Failed to add member", err);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white">
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-emerald-600" />
            Add Employee to {channel.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Admin tool: Select an active employee from the database to add them to this channel.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 pb-2 border-b bg-muted/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter non-member employees..."
              className="pl-8 h-9 text-sm bg-white"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="h-72 p-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading employee directory...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
              <Building2 className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="font-medium">All eligible employees are in this channel</p>
              <p className="text-[11px] text-muted-foreground/70">
                {query ? "No matching employees found." : "There are no non-member employees left to add."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((emp) => {
                const isAdding = addingId === emp.userId;
                return (
                  <div
                    key={emp.userId}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-emerald-50/70 transition-colors border border-transparent hover:border-emerald-100"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className={`grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br text-xs font-semibold text-white shadow-sm ${emp.color}`}>
                          {emp.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </div>
                        {emp.online && (
                          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border-2 border-white" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">{emp.name}</span>
                          {emp.employee?.code && (
                            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{emp.employee.code}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.employee?.department || emp.role} {emp.employee?.position ? `· ${emp.employee.position}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAdd(emp.userId, emp.name)}
                      disabled={isAdding}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shrink-0"
                    >
                      {isAdding ? "Adding..." : "+ Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
