import { useMemo, useState, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Pin, Bell, Phone, Video, Info, MessageSquare, Megaphone, Sparkles, Users, Settings, Lock, ShieldCheck, Building2, Loader2, Activity, CircleDot, X, Plus, UserPlus, Trash2, Crown, Check, Briefcase, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useChat, formatTime, type Attachment, type Channel, type ChatUser, type Message } from "@/components/chat/chat-store";
import { MessageList } from "@/components/chat/MessageList";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { NewChannelDialog } from "@/components/chat/NewChannelDialog";
import { EditChannelDialog } from "@/components/chat/EditChannelDialog";
import { NewDMDialog } from "@/components/chat/NewDMDialog";
import { AddChannelMemberDialog } from "@/components/chat/AddChannelMemberDialog";
import { useRole } from "@/hooks/useRole";
import { getChannelMembers, getChatEmployees, type EnrichedChatMember, type TypingState } from "@/services/api";

export const Route = createFileRoute("/app/chat")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "Chatroom · Queenstech ERP" }] }),
});

type ChatTab = "all" | "groups" | "dms";

type ResponseError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

function errorMessage(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null) return fallback;
  return (error as ResponseError).response?.data?.message || fallback;
}

function shortCode(code: string | null | undefined, fallback = "ADM") {
  return (code || fallback).slice(-3);
}

function ChatPage() {
  const store = useChat();
  const {
    users, meId, channels, messages, send, react, pin, createChannel, startDM, updateChannel,
    deleteChannel, addChannelMember, removeChannelMember, editMessage, deleteMessage,
    typingByChannel, unreadCounts, markChannelAsRead, setLocalTyping,
    accessDenied, accessMessage, accessCheckLoading, employeeInfo, loading,
  } = store;

  const { isAdmin } = useRole();
  const [activeId, setActiveId] = useState(channels.find(c => c.id === "general")?.id ?? channels[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "groups" | "dms">("all");
  const [showInfo, setShowInfo] = useState(true);
  const [showEditChannel, setShowEditChannel] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [enrichedMembers, setEnrichedMembers] = useState<Record<string, EnrichedChatMember>>({});
  const [employeeDir, setEmployeeDir] = useState<EnrichedChatMember[]>([]);
  const toastTimer = useRef<number | null>(null);

  const pushToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  // Refresh enriched members whenever active channel changes or poll fires
  useEffect(() => {
    if (!activeId || accessDenied || accessCheckLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const members = await getChannelMembers(activeId);
        if (cancelled) return;
        const map: Record<string, EnrichedChatMember> = {};
        for (const m of members) map[m.userId] = m;
        setEnrichedMembers(map);
      } catch {
        setEnrichedMembers({});
      }
    })();
    return () => { cancelled = true; };
  }, [activeId, channels.length, accessDenied, accessCheckLoading, users.length]);

  // Fetch employees directory when add member dialog opens
  useEffect(() => {
    if (!showAddMember) return;
    getChatEmployees().then(setEmployeeDir).catch(() => {});
  }, [showAddMember]);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const active = channels.find((c) => c.id === activeId) ?? channels[0];
  const activeMessages = useMemo(() => messages.filter((m) => m.channelId === active?.id), [messages, active?.id]);
  const lastByChannel = useMemo(() => {
    const map = new Map<string, Message>();
    messages.forEach((m) => {
      const cur = map.get(m.channelId);
      if (!cur || new Date(m.createdAt) > new Date(cur.createdAt)) map.set(m.channelId, m);
    });
    return map;
  }, [messages]);

  const filteredChannels = useMemo(() => channels.filter((c) => {
    if (tab === "groups" && c.type === "dm") return false;
    if (tab === "dms" && c.type !== "dm") return false;
    if (!query) return true;
    return c.name.toLowerCase().includes(query.toLowerCase());
  }), [channels, tab, query]);

  const pinned = activeMessages.filter((m) => m.pinned);
  const myMentions = activeMessages.filter((m) => m.mentions.includes(meId)).length;
  const totalUnread = useMemo(() => Object.values(unreadCounts).reduce((s, n) => s + n, 0), [unreadCounts]);

  useEffect(() => { scrollEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeMessages.length]);

  useEffect(() => {
    if (activeId) markChannelAsRead(activeId);
  }, [activeId, activeMessages.length, markChannelAsRead]);

  function handleSend(body: string, attachments: Attachment[], mentions: string[]) {
    if (!active) return;
    send(active.id, body, attachments, mentions, replyTo?.id);
    setReplyTo(null);
  }

  function handleEdit(m: Message) {
    const next = prompt("Edit message", m.body);
    if (next !== null && next.trim()) editMessage(m.id, next.trim());
  }

  function handleTyping(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (!active) return;
    if (e.target.value.length > 0) setLocalTyping(active.id, true);
    else setLocalTyping(active.id, false);
  }

  async function doAddMember(userId: string, name: string) {
    if (!active) return;
    setAddingIds(prev => new Set(prev).add(userId));
    try {
      await addChannelMember(active.id, userId);
      pushToast("ok", `Added ${name} to ${active.name}`);
    } catch (e: unknown) {
      pushToast("err", errorMessage(e, "Could not add member"));
    } finally {
      setAddingIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
    }
  }

  async function doRemoveMember(userId: string, name: string) {
    if (!active) return;
    setRemovingIds(prev => new Set(prev).add(userId));
    try {
      await removeChannelMember(active.id, userId);
      pushToast("ok", `Removed ${name} from ${active.name}`);
    } catch (e: unknown) {
      pushToast("err", errorMessage(e, "Could not remove member"));
    } finally {
      setRemovingIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
      setPendingRemove(null);
    }
  }

  // === Access denied / Loading views ===
  if (accessCheckLoading) {
    return (
      <div className="-m-4 sm:-m-6 h-[calc(100vh-3.5rem)] flex items-center justify-center bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/50">
        <div className="flex flex-col items-center gap-4 animate-[fadeIn_0.4s_ease-out]">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-emerald-400/20 blur-xl animate-pulse" />
            <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying employee access...
          </div>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="-m-4 sm:-m-6 h-[calc(100vh-3.5rem)] flex items-center justify-center bg-gradient-to-br from-rose-50/40 via-white to-amber-50/40 p-6">
        <Card className="max-w-md w-full overflow-hidden border-rose-200/60 shadow-xl animate-[scaleIn_0.4s_cubic-bezier(0.22,1,0.36,1)]">
          <div className="relative h-32 bg-gradient-to-br from-rose-500 via-rose-600 to-amber-600">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
            <div className="absolute top-6 left-1/2 -translate-x-1/2">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-white/15 blur-md" />
                <div className="relative grid h-16 w-16 place-items-center rounded-full bg-white/95 shadow-lg ring-4 ring-white/30">
                  <Lock className="h-8 w-8 text-rose-600" />
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 pt-10 text-center space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Employee Access Required</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{accessMessage || "This chatroom is for company employees only."}</p>
            </div>
            <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/60 p-4 text-left space-y-2">
              <div className="flex items-start gap-2.5 text-sm">
                <Building2 className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-rose-900">Company Directory</p>
                  <p className="text-xs text-rose-800/80">Only employees with an active record in the Queenstech HR database can access the chatroom.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <ShieldCheck className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-rose-900">Need Access?</p>
                  <p className="text-xs text-rose-800/80">Contact your HR administrator or department manager to be added as an employee.</p>
                </div>
              </div>
            </div>
            {employeeInfo ? (
              <div className="rounded-lg bg-emerald-50 p-3 text-left">
                <p className="text-xs text-emerald-700 font-medium">Verified identity</p>
                <p className="text-sm text-emerald-900 font-semibold">{employeeInfo.name} · {employeeInfo.code}</p>
                <p className="text-xs text-emerald-800/80">{employeeInfo.department} · {employeeInfo.position}</p>
              </div>
            ) : null}
          </div>
        </Card>
        <style>{`
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.94) translateY(6px);} to {opacity:1; transform: scale(1) translateY(0);} }
          @keyframes fadeIn { from {opacity:0} to {opacity:1} }
        `}</style>
      </div>
    );
  }

  return (
    <div className="-m-4 sm:-m-6 h-[calc(100vh-3.5rem)] flex bg-muted/30">
      <style>{`
        @keyframes msgIn { from { opacity: 0; transform: translateY(6px) scale(0.98);} to {opacity:1; transform: translateY(0) scale(1);} }
        @keyframes slideInL { from { opacity: 0; transform: translateX(-10px);} to {opacity:1; transform: translateX(0);} }
        @keyframes pulseDot { 0%,100%{transform:scale(1); opacity:1} 50%{transform:scale(1.5); opacity:.5} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .msg-enter { animation: msgIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .channel-enter { animation: slideInL 0.25s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .typing-dot { animation: pulseDot 1s ease-in-out infinite; }
      `}</style>

      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r bg-white flex flex-col">
        <div className="p-3 border-b relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-40 h-40 rounded-full bg-gradient-to-br from-emerald-400/10 to-teal-400/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <span className="relative">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: "pulseDot 2s ease-in-out infinite" }} />
                </span>
                Chatroom
              </h2>
              <div className="flex items-center gap-0.5">
                <NewDMDialog meId={meId} onStartDM={startDM} onChannelSelected={setActiveId} />
                <NewChannelDialog users={users} meId={meId} onCreate={async (c) => {
                  const created = await createChannel(c);
                  setActiveId(created.id);
                }} />
              </div>
            </div>
            {employeeInfo && (
              <div className="mb-2.5 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 px-2.5 py-1.5 flex items-center gap-2">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white shadow-sm">
                  {shortCode(employeeInfo.code)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-emerald-900 truncate leading-tight">{employeeInfo.name}</p>
                  <p className="text-[10px] text-emerald-700 truncate leading-tight">{employeeInfo.department} · {employeeInfo.position}</p>
                </div>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="h-8 pl-8 bg-muted/40 border-0 text-sm" />
              {totalUnread > 0 && (
                <Badge className="absolute right-2 top-1/2 -translate-y-1/2 h-5 min-w-5 justify-center bg-gradient-to-br from-rose-500 to-pink-600 text-white border-0 shadow-[0_0_0_2px_rgba(244,63,94,0.1)]">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as ChatTab)} className="px-2 pt-2">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="groups" className="text-xs">Groups</TabsTrigger>
            <TabsTrigger value="dms" className="text-xs">DMs</TabsTrigger>
          </TabsList>
        </Tabs>
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {filteredChannels.map((c, idx) => {
              const last = lastByChannel.get(c.id);
              const isActive = c.id === active?.id;
              const lastAuthor = last ? userMap.get(last.authorId) : null;
              const unread = unreadCounts[c.id] ?? 0;
              const typingUsers = typingByChannel[c.id] ?? [];
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  style={{ animationDelay: `${Math.min(idx, 12) * 20}ms` }}
                  className={cn(
                    "channel-enter w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-200 relative group",
                    isActive ? "bg-emerald-500/10 shadow-[inset_2px_0_0_0_rgb(16,185,129)]" : "hover:bg-muted hover:translate-x-0.5",
                  )}
                >
                  <div className="shrink-0 relative">
                    <ChannelAvatar channel={c} userMap={userMap} meId={meId} />
                    {unread > 0 && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[9px] font-bold text-white border-2 border-white shadow-sm">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm truncate", isActive ? "font-semibold text-emerald-800" : "font-medium")}>{c.name}</span>
                      {last && <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(last.createdAt)}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {typingUsers.length > 0 ? (
                        <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                          <span className="inline-flex gap-0.5">
                            <span className="typing-dot h-1 w-1 rounded-full bg-emerald-500" />
                            <span className="typing-dot h-1 w-1 rounded-full bg-emerald-500" style={{ animationDelay: "0.2s" }} />
                            <span className="typing-dot h-1 w-1 rounded-full bg-emerald-500" style={{ animationDelay: "0.4s" }} />
                          </span>
                          {typingUsers.length === 1
                            ? `${userMap.get(typingUsers[0].userId)?.name.split(" ")[0] ?? "Someone"} is typing...`
                            : `${typingUsers.length} people typing...`}
                        </span>
                      ) : last ? (
                        <>
                          {c.type !== "dm" && lastAuthor && <span className="font-medium">{lastAuthor.id === meId ? "You" : lastAuthor.name.split(" ")[0]}: </span>}
                          {last.attachments.length > 0 && !last.body ? `📎 ${last.attachments.length} file${last.attachments.length > 1 ? "s" : ""}` : last.body || "—"}
                        </>
                      ) : "No messages yet"}
                    </p>
                  </div>
                </button>
              );
            })}
            {filteredChannels.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-muted">
                  <MessageSquare className="h-4 w-4" />
                </div>
                No conversations found
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Conversation */}
      <main className="flex-1 flex flex-col min-w-0">
        {active && (
          <>
            <header className="h-14 border-b bg-white px-4 flex items-center gap-3 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.05),transparent_70%)] pointer-events-none" />
              <div className="relative flex-1 flex items-center gap-3 min-w-0">
                <ChannelAvatar channel={active} userMap={userMap} meId={meId} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{active.name}</h3>
                    {active.type === "broadcast" && <Badge className="bg-amber-500/10 text-amber-700"><Megaphone className="h-3 w-3 mr-1" />Broadcast</Badge>}
                    {myMentions > 0 && <Badge className="bg-rose-500/10 text-rose-700">@ {myMentions}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {active.type === "dm" ? (() => {
                      const otherId = active.memberIds.find((id) => id !== meId);
                      const u = otherId ? userMap.get(otherId) : null;
                      if (!u) return "Direct message";
                      if (u.online) return (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <span className="relative inline-flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" style={{ animation: "pulseDot 1.5s ease-in-out infinite" }} />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                          Online
                        </span>
                      );
                      if (u.lastSeen) return `Last seen ${formatTime(u.lastSeen)}`;
                      return "Last seen recently";
                    })() : `${active.memberIds.length} members · ${active.description ?? "Team channel"}`}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="hover:bg-emerald-50 hover:text-emerald-700 transition-colors"><Phone className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="hover:bg-emerald-50 hover:text-emerald-700 transition-colors"><Video className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="hover:bg-emerald-50 hover:text-emerald-700 transition-colors"><Bell className="h-4 w-4" /></Button>
                  {isAdmin && active.type === "group" && (
                    <Button variant="ghost" size="icon" onClick={() => setShowEditChannel(true)} title="Channel settings" className="hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant={showInfo ? "secondary" : "ghost"} size="icon" onClick={() => setShowInfo((s) => !s)}><Info className="h-4 w-4" /></Button>
                </div>
              </div>
            </header>

            {pinned.length > 0 && (
              <div className="border-b bg-gradient-to-r from-amber-50 via-amber-50/70 to-white px-4 py-1.5 flex items-center gap-2 text-xs group hover:bg-amber-50 transition-colors cursor-pointer">
                <Pin className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="font-medium text-amber-900 shrink-0">Pinned:</span>
                <span className="truncate text-amber-800">{pinned[0].body}</span>
                {pinned.length > 1 && <Badge variant="secondary" className="ml-auto shrink-0 bg-amber-100 text-amber-800 border-0 h-5">+{pinned.length - 1} more</Badge>}
              </div>
            )}

            <MessageListWrapper
              messages={activeMessages}
              users={users}
              meId={meId}
              onReact={react}
              onPin={pin}
              onReply={(m: Message) => setReplyTo(m)}
              onEdit={handleEdit}
              onDelete={deleteMessage}
              loading={loading}
            />
            <div ref={scrollEndRef} />

            <TypingFooter active={active} typingByChannel={typingByChannel} userMap={userMap} meId={meId} />

            <MessageComposer
              members={users.filter((u) => active.memberIds.includes(u.id))}
              meId={meId}
              onSend={handleSend}
              onTyping={handleTyping}
              replyTo={replyTo ? { author: userMap.get(replyTo.authorId)?.name ?? "?", body: replyTo.body } : null}
              onClearReply={() => setReplyTo(null)}
            />
          </>
        )}
      </main>

      {/* Info panel */}
      {showInfo && active && (
        <aside className="hidden xl:flex w-72 shrink-0 border-l bg-white flex-col animate-[slideInL_0.25s_cubic-bezier(0.22,1,0.36,1)]">
          <div className="p-4 border-b relative overflow-hidden">
            <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-gradient-to-br from-emerald-300/10 to-teal-400/10 blur-3xl" />
            <div className="relative flex flex-col items-center text-center">
              <div className="mb-2"><ChannelAvatar channel={active} userMap={userMap} meId={meId} size="lg" /></div>
              <h3 className="font-semibold">{active.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{active.description ?? `${active.memberIds.length} members`}</p>
              {active.type === "group" && (
                <Badge className="mt-2 bg-emerald-50 text-emerald-700 border-emerald-100">
                  <Users className="h-3 w-3 mr-1" />{active.memberIds.length} members
                </Badge>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Sparkles className="h-3 w-3" />Channel insight</p>
                <div className="rounded-xl border bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white p-3 text-xs shadow-sm overflow-hidden relative">
                  <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-emerald-400/10 blur-xl" />
                  <div className="relative space-y-1.5">
                    <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 text-emerald-600" />
                      <span className="tabular-nums">{activeMessages.length}</span> <span className="font-normal">messages</span>
                    </p>
                    <p className="text-emerald-800/90">
                      {activeMessages.filter((m) => m.attachments.length).length} files shared · {activeMessages.reduce((s, m) => s + m.reactions.reduce((a, r) => a + r.userIds.length, 0), 0)} reactions
                    </p>
                    {employeeInfo && (
                      <div className="mt-2 pt-2 border-t border-emerald-100/80 flex items-center gap-2">
                        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-600 text-[9px] font-bold text-white">
                          {shortCode(employeeInfo.code).slice(-2)}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-emerald-900 leading-tight">{employeeInfo.name}</p>
                          <p className="text-[10px] text-emerald-700 leading-tight">{employeeInfo.department}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {pinned.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Pin className="h-3 w-3" />Pinned</p>
                  <div className="space-y-1.5">
                    {pinned.map((m) => (
                      <div key={m.id} className="rounded-lg border bg-amber-50/50 p-2 text-xs hover:bg-amber-50 transition-colors hover:shadow-sm">
                        <p className="font-medium flex items-center gap-1">
                          <Pin className="h-3 w-3 text-amber-600" />
                          {userMap.get(m.authorId)?.name}
                        </p>
                        <p className="text-muted-foreground line-clamp-2 mt-0.5">{m.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Users className="h-3 w-3" />Members ({active.memberIds.length})</p>
                  {isAdmin && active.type === "group" && active.id !== "general" && (
                    <AddChannelMemberDialog
                      channel={active}
                      onAddMember={doAddMember}
                      trigger={
                        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px] text-emerald-700 hover:bg-emerald-50 gap-1 font-medium">
                          <UserPlus className="h-3 w-3" /> Add
                        </Button>
                      }
                    />
                  )}
                </div>
                <div className="space-y-0.5">
                  {active.memberIds.map((id, i) => {
                    const u = userMap.get(id); if (!u) return null;
                    const canRemove = isAdmin && active.id !== "general" && active.type !== "dm" && id !== meId;
                    const isRemoving = removingIds.has(id);
                    return (
                      <div key={id} style={{ animationDelay: `${i * 30}ms` }} className="channel-enter flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted/70 transition-colors group">
                        <div className="relative shrink-0">
                          <div className={cn("grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white shadow-sm", u.color)}>
                            {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                          </div>
                          {u.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-[0_0_0_1px_rgba(16,185,129,0.3)]">
                              <span className="block h-full w-full rounded-full bg-emerald-400" style={{ animation: "pulseDot 1.8s ease-in-out infinite" }} />
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-tight truncate font-medium">{u.name} {u.id === meId && <span className="text-xs text-muted-foreground font-normal">(you)</span>}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{u.role}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {id !== meId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50"
                              title={`Direct message ${u.name}`}
                              onClick={async () => {
                                const dmChan = await startDM(id);
                                setActiveId(dmChan.id);
                              }}
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                          )}
                          {canRemove && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              title={`Remove ${u.name} from channel`}
                              disabled={isRemoving}
                              onClick={() => {
                                if (confirm(`Remove ${u.name} from ${active.name}?`)) {
                                  doRemoveMember(id, u.name);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Shared files</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(() => {
                    const files = activeMessages.flatMap((m) => m.attachments).slice(0, 9);
                    if (files.length === 0) return (
                      <div className="col-span-3 py-6 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-muted-foreground/20">
                        No files shared yet
                      </div>
                    );
                    return files.map((a) => (
                      <div key={a.id} className="aspect-square rounded-md bg-gradient-to-br from-emerald-100 to-teal-100 grid place-items-center text-[10px] text-emerald-800 font-medium p-1 text-center truncate overflow-hidden hover:scale-[1.03] transition-transform cursor-pointer shadow-sm">
                        {a.type === "image" && a.dataUrl ? <img src={a.dataUrl} alt="" className="h-full w-full object-cover rounded-md" /> : a.name.split(".").pop()?.toUpperCase()}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>
      )}

      {/* Edit Channel Dialog */}
      {active && isAdmin && (
        <EditChannelDialog
          channel={active}
          users={users}
          open={showEditChannel}
          onOpenChange={setShowEditChannel}
          onUpdate={async (data) => { await updateChannel(active.id, data); }}
          onAddMember={async (userId) => { await addChannelMember(active.id, userId); }}
          onRemoveMember={async (userId) => { await removeChannelMember(active.id, userId); }}
          onDelete={async () => {
            await deleteChannel(active.id);
            setActiveId(channels.find(c => c.id !== active.id)?.id ?? "");
          }}
        />
      )}
    </div>
  );
}

type MessageListWrapperProps = {
  messages: Message[];
  users: ChatUser[];
  meId: string;
  onReact: (id: string, emoji: string) => Promise<void>;
  onPin: (id: string) => Promise<void>;
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
};

function MessageListWrapper(props: MessageListWrapperProps) {
  const { messages, loading, ...rest } = props;
  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn("flex gap-2", i % 2 === 1 && "flex-row-reverse")}>
            <div className="h-8 w-8 rounded-full bg-muted shrink-0 animate-pulse" />
            <div className="space-y-2 flex-1 max-w-[70%]">
              <div className={cn("h-4 rounded bg-muted animate-pulse", i % 2 === 1 && "ml-auto")} style={{ width: `${60 + (i * 7) % 30}%` }} />
              <div className={cn("h-3 rounded bg-muted animate-pulse", i % 2 === 1 && "ml-auto")} style={{ width: `${30 + (i * 11) % 40}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-16 flex flex-col items-center justify-center text-center">
        <div className="relative mb-4">
          <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-emerald-400/10 to-teal-400/10 blur-xl animate-pulse" />
          <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 ring-1 ring-emerald-200/50">
            <MessageSquare className="h-7 w-7 text-emerald-600" />
          </div>
        </div>
        <h3 className="text-sm font-semibold text-foreground">Start the conversation</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">Be the first to say hello 👋 Messages are only visible to employees in this channel.</p>
      </div>
    );
  }
  return <MessageListWithAnimations messages={messages} {...rest} />;
}

function MessageListWithAnimations({ messages, ...rest }: Omit<MessageListWrapperProps, "loading">) {
  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.04),transparent_60%)] px-3 py-4 space-y-3">
      <MessageList messages={messages} {...rest} />
    </div>
  );
}

function TypingFooter({ active, typingByChannel, userMap, meId }: { active: Channel; typingByChannel: Record<string, TypingState[]>; userMap: Map<string, ChatUser>; meId: string }) {
  const typing = (typingByChannel[active.id] ?? []).filter((t) => t.userId !== meId);
  if (typing.length === 0) return null;
  const names = typing.map((t) => userMap.get(t.userId)?.name.split(" ")[0] ?? "Someone");
  const label = typing.length === 1
    ? `${names[0]} is typing...`
    : typing.length === 2
      ? `${names[0]} and ${names[1]} are typing...`
      : `${names.slice(0, 2).join(", ")} and ${typing.length - 2} more are typing...`;
  return (
    <div className="px-4 py-1.5 border-t border-b border-muted/60 bg-white/50 backdrop-blur-sm text-xs flex items-center gap-2">
      <div className="relative flex items-center gap-1">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animationDelay: "0.15s" }} />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animationDelay: "0.3s" }} />
      </div>
      <span className="text-emerald-700 font-medium">{label}</span>
    </div>
  );
}

function ChannelAvatar({ channel, userMap, meId, size = "md" }: { channel: Channel; userMap: Map<string, ChatUser>; meId: string; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-14 w-14 text-xl" : "h-9 w-9 text-base";
  if (channel.type === "dm") {
    const other = channel.memberIds.find((id) => id !== meId);
    const u = other ? userMap.get(other) : null;
    if (u) return (
      <div className="relative shrink-0">
        <div className={cn("grid place-items-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm ring-1 ring-black/5", dim, u.color)}>
          {u.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("")}
        </div>
        {u.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />}
      </div>
    );
  }
  return <div className={cn("grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 ring-1 ring-emerald-500/10", dim)}>{channel.emoji || "💬"}</div>;
}
