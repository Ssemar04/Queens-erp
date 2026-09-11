import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Search, UserPlus, Building2 } from "lucide-react";
import { getChatEmployees, type EnrichedChatMember } from "@/services/api";
import type { Channel } from "./chat-store";

interface Props {
  meId: string;
  onStartDM: (userId: string) => Promise<Channel>;
  onChannelSelected: (channelId: string) => void;
  trigger?: React.ReactNode;
}

export function NewDMDialog({ meId, onStartDM, onChannelSelected, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<EnrichedChatMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getChatEmployees()
      .then((data) => setEmployees(data.filter((e) => e.userId !== meId)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, meId]);

  const filtered = employees.filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const nameMatch = e.name.toLowerCase().includes(q);
    const deptMatch = e.employee?.department?.toLowerCase().includes(q);
    const posMatch = e.employee?.position?.toLowerCase().includes(q);
    const codeMatch = e.employee?.code?.toLowerCase().includes(q);
    return nameMatch || deptMatch || posMatch || codeMatch;
  });

  async function handleSelect(userId: string) {
    if (startingId) return;
    setStartingId(userId);
    try {
      const dmChan = await onStartDM(userId);
      setOpen(false);
      onChannelSelected(dmChan.id);
    } catch (err) {
      console.error("Failed to start DM", err);
    } finally {
      setStartingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-emerald-50 hover:text-emerald-700" title="Start Direct Message">
            <UserPlus className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-emerald-600" />
            New Direct Message
          </DialogTitle>
          <DialogDescription className="text-xs">
            Start a 1-on-1 private conversation with any employee in the company directory.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 pb-2 border-b bg-muted/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by employee name, code, or department..."
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
              <p className="font-medium">No employees found</p>
              <p className="text-[11px] text-muted-foreground/70">
                {query ? "Try searching with a different name or department." : "Only active employees in the HR database are listed."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((emp) => {
                const isStarting = startingId === emp.userId;
                return (
                  <button
                    key={emp.userId}
                    onClick={() => handleSelect(emp.userId)}
                    disabled={isStarting}
                    className="w-full flex items-center justify-between gap-3 p-2 rounded-lg text-left hover:bg-emerald-50/70 transition-colors group border border-transparent hover:border-emerald-100"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br text-xs font-semibold text-white shadow-sm ${emp.color}`}>
                          {emp.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </div>
                        {emp.online && (
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate group-hover:text-emerald-900">{emp.name}</span>
                          {emp.employee?.code && (
                            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{emp.employee.code}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.employee?.department || emp.role} {emp.employee?.position ? `· ${emp.employee.position}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity gap-1 hover:bg-emerald-100">
                      {isStarting ? "Starting..." : "Message"}
                    </Button>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
