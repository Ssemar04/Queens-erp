import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, AlertCircle } from "lucide-react";
import type { ChatUser, Channel } from "./chat-store";

const EMOJI = ["📣", "📦", "💰", "🚀", "🛠", "🎯", "🤝", "🛒", "🧪", "🧾", "🚚", "🪙"];

interface Props {
  channel: Channel;
  users: ChatUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: Partial<Pick<Channel, "name" | "emoji" | "description">>) => Promise<void>;
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function EditChannelDialog({ channel, users, open, onOpenChange, onUpdate, onAddMember, onRemoveMember, onDelete }: Props) {
  const [name, setName] = useState(channel.name);
  const [desc, setDesc] = useState(channel.description || "");
  const [emoji, setEmoji] = useState(channel.emoji);
  const [members, setMembers] = useState<string[]>(channel.memberIds);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isChanged = name !== channel.name || desc !== channel.description || emoji !== channel.emoji || JSON.stringify(members) !== JSON.stringify(channel.memberIds);
  const isGeneral = channel.id === "general";

  async function handleUpdate() {
    if (!isChanged || updating) return;
    setUpdating(true);
    try {
      // Update channel metadata
      if (name !== channel.name || emoji !== channel.emoji || desc !== channel.description) {
        await onUpdate({ name, emoji, description: desc });
      }

      // Handle member changes
      const oldMembers = new Set(channel.memberIds);
      const newMembers = new Set(members);

      // Add new members
      for (const memberId of newMembers) {
        if (!oldMembers.has(memberId)) {
          await onAddMember(memberId);
        }
      }

      // Remove members
      for (const memberId of oldMembers) {
        if (!newMembers.has(memberId)) {
          await onRemoveMember(memberId);
        }
      }

      onOpenChange(false);
      // Reset form
      setName(channel.name);
      setDesc(channel.description || "");
      setEmoji(channel.emoji);
      setMembers(channel.memberIds);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete "${channel.name}"? This action cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete();
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Channel</DialogTitle>
          <DialogDescription>Update channel settings and members</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Emoji Section */}
          <div>
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`h-8 w-8 rounded-md text-lg ${emoji === e ? "bg-emerald-100 ring-1 ring-emerald-400" : "hover:bg-muted"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Name Section */}
          <div>
            <Label>Channel name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" disabled={isGeneral} />
            {isGeneral && <p className="text-xs text-muted-foreground mt-1">General channel name cannot be changed</p>}
          </div>

          {/* Description Section */}
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's this channel about?" disabled={isGeneral} />
          </div>

          {/* Members Section */}
          {!isGeneral && (
            <div>
              <Label>Members ({members.length})</Label>
              <ScrollArea className="mt-1 max-h-48 rounded-md border p-2">
                <div className="space-y-1">
                  {users.map((u) => {
                    const checked = members.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setMembers((p) => v ? [...p, u.id] : p.filter((x) => x !== u.id))
                          }
                        />
                        <span className={`grid h-6 w-6 place-items-center rounded bg-gradient-to-br ${u.color} text-[10px] font-semibold text-white`}>
                          {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </span>
                        <span className="text-sm">{u.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{u.role}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* General Channel Warning */}
          {isGeneral && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2 text-sm text-amber-900">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>The general channel is system-managed and cannot be edited or deleted.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between gap-2">
            <div>
              {!isGeneral && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                  size="sm"
                  className="gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={!isChanged || updating || isGeneral}>
                {updating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
