import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Send, Smile, AtSign, X, Image as ImageIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Attachment, ChatUser } from "./chat-store";

interface Props {
  members: ChatUser[];
  meId: string;
  onSend: (body: string, attachments: Attachment[], mentions: string[]) => void;
  replyTo?: { author: string; body: string } | null;
  onClearReply?: () => void;
}

const EMOJIS = ["👍", "🎉", "❤️", "🔥", "🙏", "😂", "👀", "✅", "🚀", "💯"];

export function MessageComposer({ members, meId, onSend, replyTo, onClearReply }: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Detect @ trigger
  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    const caret = ta.selectionStart ?? 0;
    const before = text.slice(0, caret);
    const m = before.match(/@(\w*)$/);
    if (m) { setMentionOpen(true); setMentionQuery(m[1].toLowerCase()); }
    else setMentionOpen(false);
  }, [text]);

  const candidates = useMemo(() => members.filter((u) => u.id !== meId && u.name.toLowerCase().includes(mentionQuery)).slice(0, 6), [members, meId, mentionQuery]);

  function insertMention(u: ChatUser) {
    const ta = taRef.current; if (!ta) return;
    const caret = ta.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@\w*$/, `@${u.name} `);
    const after = text.slice(caret);
    setText(before + after);
    setMentionOpen(false);
    requestAnimationFrame(() => ta.focus());
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: Attachment[] = [];
    Array.from(files).slice(0, 5).forEach((f) => {
      const type: Attachment["type"] = f.type.startsWith("image/") ? "image" : f.type === "application/pdf" ? "pdf" : f.type.startsWith("audio/") ? "audio" : f.name.match(/\.(xlsx|docx|csv)$/) ? "doc" : "other";
      const att: Attachment = { id: `a${Date.now()}-${f.name}`, name: f.name, size: f.size, type };
      if (type === "image") {
        const reader = new FileReader();
        reader.onload = () => {
          att.dataUrl = reader.result as string;
          setAttachments((p) => [...p.filter((x) => x.id !== att.id), att]);
        };
        reader.readAsDataURL(f);
      }
      next.push(att);
    });
    setAttachments((p) => [...p, ...next]);
  }

  function submit() {
    const body = text.trim();
    if (!body && attachments.length === 0) return;
    const mentions = members.filter((u) => body.includes(`@${u.name}`)).map((u) => u.id);
    onSend(body, attachments, mentions);
    setText(""); setAttachments([]);
    onClearReply?.();
  }

  return (
    <div className="border-t bg-white">
      {replyTo && (
        <div className="flex items-start gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs">
          <div className="flex-1 border-l-2 border-emerald-500 pl-2">
            <p className="font-medium text-emerald-700">Replying to {replyTo.author}</p>
            <p className="text-muted-foreground line-clamp-1">{replyTo.body}</p>
          </div>
          <button onClick={onClearReply} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b px-3 py-2">
          {attachments.map((a) => (
            <div key={a.id} className="relative shrink-0 rounded-lg border bg-white p-2 pr-7 flex items-center gap-2 text-xs">
              {a.type === "image" && a.dataUrl ? <img src={a.dataUrl} alt="" className="h-10 w-10 rounded object-cover" /> : a.type === "image" ? <ImageIcon className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-emerald-600" />}
              <span className="max-w-[120px] truncate font-medium">{a.name}</span>
              <button onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))} className="absolute right-1 top-1 rounded p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-1.5 p-2">
        <Popover open={mentionOpen}>
          <PopoverTrigger asChild><span /></PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-64 p-1">
            {candidates.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">No match</p> : candidates.map((u) => (
              <button key={u.id} onMouseDown={(e) => { e.preventDefault(); insertMention(u); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                <span className={`grid h-6 w-6 place-items-center rounded bg-gradient-to-br ${u.color} text-[10px] font-semibold text-white`}>{u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                <span className="flex-1 text-left truncate">{u.name}</span>
                <span className="text-[10px] text-muted-foreground">{u.role}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Button size="icon" variant="ghost" onClick={() => fileRef.current?.click()} title="Attach"><Paperclip className="h-4 w-4" /></Button>

        <Popover>
          <PopoverTrigger asChild><Button size="icon" variant="ghost" title="Emoji"><Smile className="h-4 w-4" /></Button></PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto p-1.5">
            <div className="grid grid-cols-10 gap-0.5">
              {EMOJIS.map((e) => <button key={e} onClick={() => setText((t) => t + e)} className="rounded p-1 text-lg hover:bg-muted">{e}</button>)}
            </div>
          </PopoverContent>
        </Popover>

        <Button size="icon" variant="ghost" onClick={() => setText((t) => `${t}@`)} title="Mention"><AtSign className="h-4 w-4" /></Button>

        <Textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Type a message · @ to mention · Shift+Enter for new line"
          rows={1}
          className="min-h-[40px] max-h-32 resize-none bg-muted/40 border-0 focus-visible:ring-1"
        />

        <Button size="icon" onClick={submit} disabled={!text.trim() && attachments.length === 0}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
