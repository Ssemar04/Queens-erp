import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import type { ChatUser, Channel } from "./chat-store";

const EMOJI = ["📣", "📦", "💰", "🚀", "🛠", "🎯", "🤝", "🛒", "🧪", "🧾", "🚚", "🪙"];

interface Props {
  users: ChatUser[];
  meId: string;
  onCreate: (c: Omit<Channel, "id" | "createdAt" | "pinnedMessageIds">) => void | Promise<void>;
}

export function NewChannelDialog({ users, meId, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [members, setMembers] = useState<string[]>([meId]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setMembers((prev) => prev.includes(meId) ? prev : [meId, ...prev]);
  }, [meId]);

  async function submit() {
    const trimmedName = name.trim();
    if (!trimmedName || creating) return;

    setCreating(true);
    try {
      const memberIds = members.includes(meId) ? members : [meId, ...members];
      await onCreate({ name: trimmedName, description: desc.trim() || undefined, emoji, type: "group", memberIds });
      setOpen(false); setName(""); setDesc(""); setMembers([meId]);
    } finally {
      setCreating(false);
    }
  }

  const canCreate = name.trim().length > 0 && !creating;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="New channel"><Plus className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a channel</DialogTitle></DialogHeader>
        <DialogDescription className="sr-only">
          Create a group chat channel and choose the members who should be included.
        </DialogDescription>
        <div className="space-y-3">
          <div>
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {EMOJI.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} className={`h-8 w-8 rounded-md text-lg ${emoji === e ? "bg-emerald-100 ring-1 ring-emerald-400" : "hover:bg-muted"}`}>{e}</button>
              ))}
            </div>
          </div>
          <div><Label>Channel name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" /></div>
          <div><Label>Description</Label><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's this channel about?" /></div>
          <div>
            <Label>Members ({members.length})</Label>
            <div className="mt-1 max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
              {users.map((u) => {
                const checked = members.includes(u.id);
                const isMe = u.id === meId;
                return (
                  <label key={u.id} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={checked} disabled={isMe} onCheckedChange={(v) => setMembers((p) => v ? [...p, u.id] : p.filter((x) => x !== u.id))} />
                    <span className={`grid h-6 w-6 place-items-center rounded bg-gradient-to-br ${u.color} text-[10px] font-semibold text-white`}>{u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                    <span className="text-sm">{u.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{u.role}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-1.5"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={!canCreate}>{creating ? "Creating..." : "Create"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
