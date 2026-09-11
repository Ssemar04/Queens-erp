import { useMemo, useState } from "react";
import { Pin, Reply, Smile, MoreHorizontal, FileText, Image as ImageIcon, Download, CheckCheck, Trash2, Pencil, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type Message, type ChatUser, type Attachment, formatTime, formatBytes } from "./chat-store";

const QUICK = ["👍", "❤️", "😂", "🎉", "🔥", "🙏"];

interface Props {
  messages: Message[];
  users: ChatUser[];
  meId: string;
  onReact: (id: string, emoji: string) => void;
  onPin: (id: string) => void;
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  onDelete: (id: string) => void;
}

export function MessageList({ messages, users, meId, onReact, onPin, onReply, onEdit, onDelete }: Props) {
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Group by author for stacked bubbles
  const groups = useMemo(() => {
    const out: { authorId: string; messages: Message[] }[] = [];
    messages.forEach((m) => {
      const last = out[out.length - 1];
      if (last && last.authorId === m.authorId && new Date(m.createdAt).getTime() - new Date(last.messages[last.messages.length - 1].createdAt).getTime() < 5 * 60000) {
        last.messages.push(m);
      } else out.push({ authorId: m.authorId, messages: [m] });
    });
    return out;
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.04),transparent_60%)] px-3 py-4 space-y-3">
      {groups.map((g, gi) => {
        const author = userMap.get(g.authorId);
        const isMe = g.authorId === meId;
        if (!author) return null;
        return (
          <div key={gi} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
            {!isMe && (
              <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-semibold text-white self-end", author.color)}>
                {author.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
            )}
            <div className={cn("max-w-[78%] space-y-0.5", isMe ? "items-end" : "items-start", "flex flex-col")}>
              {!isMe && <span className="px-2 text-xs font-medium text-muted-foreground">{author.name} · {author.role}</span>}
              {g.messages.map((m) => (
                <Bubble key={m.id} m={m} isMe={isMe} meId={meId} userMap={userMap} onReact={onReact} onPin={onPin} onReply={() => onReply(m)} onEdit={() => onEdit(m)} onDelete={() => onDelete(m.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Bubble({ m, isMe, meId, userMap, onReact, onPin, onReply, onEdit, onDelete }: { m: Message; isMe: boolean; meId: string; userMap: Map<string, ChatUser>; onReact: (id: string, e: string) => void; onPin: (id: string) => void; onReply: () => void; onEdit: () => void; onDelete: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "group relative rounded-2xl px-3 py-2 shadow-sm transition-all",
        isMe ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-br-md" : "bg-white border rounded-bl-md",
      )}
    >
      {m.pinned && <Pin className={cn("absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full p-0.5", isMe ? "bg-white text-emerald-600" : "bg-amber-500 text-white")} />}

      <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
        {renderBody(m.body, isMe)}
      </div>

      {m.attachments.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {m.attachments.map((a) => <AttachmentPreview key={a.id} a={a} dark={isMe} />)}
        </div>
      )}

      <div className={cn("mt-1 flex items-center gap-1 text-[10px]", isMe ? "text-emerald-50/80 justify-end" : "text-muted-foreground")}>
        {m.edited && <span className="italic">edited</span>}
        <span>{formatTime(m.createdAt)}</span>
        {isMe && <CheckCheck className="h-3 w-3" />}
      </div>

      {m.reactions.length > 0 && (
        <div className={cn("absolute -bottom-2.5 flex gap-0.5", isMe ? "right-2" : "left-2")}>
          {m.reactions.map((r) => (
            <button key={r.emoji} onClick={() => onReact(m.id, r.emoji)} className={cn("rounded-full border bg-white px-1.5 py-0.5 text-[10px] shadow-sm hover:scale-110 transition-transform", r.userIds.includes(meId) && "ring-1 ring-emerald-400")}>
              {r.emoji} <span className="font-mono">{r.userIds.length}</span>
            </button>
          ))}
        </div>
      )}

      {hover && (
        <div className={cn("absolute -top-4 flex items-center gap-0.5 rounded-full border bg-white p-0.5 shadow-md", isMe ? "right-2" : "left-2")}>
          <Popover>
            <PopoverTrigger asChild><Button size="icon" variant="ghost" className="h-6 w-6"><Smile className="h-3.5 w-3.5" /></Button></PopoverTrigger>
            <PopoverContent className="w-auto p-1"><div className="flex gap-0.5">{QUICK.map((e) => <button key={e} onClick={() => onReact(m.id, e)} className="rounded p-1 hover:bg-muted">{e}</button>)}</div></PopoverContent>
          </Popover>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onReply}><Reply className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onPin(m.id)}><Pin className="h-3.5 w-3.5" /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-6 w-6"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onReply}><Reply className="h-3.5 w-3.5 mr-2" />Reply</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPin(m.id)}><Bookmark className="h-3.5 w-3.5 mr-2" />{m.pinned ? "Unpin" : "Pin"}</DropdownMenuItem>
              {m.authorId === meId && <DropdownMenuItem onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>}
              {m.authorId === meId && <DropdownMenuItem onClick={onDelete} className="text-rose-600"><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function renderBody(body: string, isMe: boolean) {
  const parts = body.split(/(@[A-Za-z][A-Za-z\s]*?(?=[\s,.!?]|$))/g);
  return parts.map((p, i) => {
    if (p.startsWith("@")) {
      return <span key={i} className={cn("rounded px-1 font-medium", isMe ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700")}>{p}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

function AttachmentPreview({ a, dark }: { a: Attachment; dark: boolean }) {
  if (a.type === "image") {
    return (
      <div className="overflow-hidden rounded-lg border bg-muted/30 max-w-xs">
        {a.dataUrl ? <img src={a.dataUrl} alt={a.name} className="block max-h-60 object-cover" /> : (
          <div className="flex h-32 items-center justify-center bg-gradient-to-br from-blue-100 to-cyan-100"><ImageIcon className="h-8 w-8 text-blue-500" /></div>
        )}
        <div className={cn("flex items-center justify-between px-2 py-1 text-[11px]", dark ? "text-emerald-50/80" : "text-muted-foreground")}>
          <span className="truncate">{a.name}</span><span>{formatBytes(a.size)}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs", dark ? "bg-white/10 border-white/20" : "bg-muted/40")}>
      <div className={cn("grid h-9 w-9 place-items-center rounded-md", dark ? "bg-white/15" : "bg-emerald-100 text-emerald-700")}>
        <FileText className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("truncate font-medium", dark ? "text-white" : "text-foreground")}>{a.name}</p>
        <p className={cn(dark ? "text-emerald-50/80" : "text-muted-foreground")}>{formatBytes(a.size)} · {a.type.toUpperCase()}</p>
      </div>
      <Button size="icon" variant={dark ? "secondary" : "ghost"} className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
    </div>
  );
}
