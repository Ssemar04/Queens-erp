import { createContext, useContext, useState, useEffect, useRef, type ReactNode, createElement, useCallback } from "react";
import { getChatUsers, getChatChannels, getChannelMessages, createChatMessage, updateChatMessage, deleteChatMessage, createChatChannel, startDirectMessage, updateChatChannel, deleteChatChannel, addChannelMember, removeChannelMember, heartbeatPresence, setPresenceOffline, setTyping, getTypingInChannel, markChannelRead, getUnreadCounts, getChannelMembers, getChatEmployees, type TypingState, type ReadReceipt, type EnrichedChatMember } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

export interface ChatUser {
  id: string;
  name: string;
  role: string;
  color: string;
  online: boolean;
  lastSeen?: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: "image" | "doc" | "pdf" | "audio" | "other";
  dataUrl?: string;
}

export interface Reaction { emoji: string; userIds: string[] }

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  createdAt: string;
  mentions: string[];
  attachments: Attachment[];
  reactions: Reaction[];
  replyTo?: string;
  edited?: boolean;
  pinned?: boolean;
  systemEvent?: string;
}

export type ChannelType = "group" | "dm" | "broadcast";

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  emoji: string;
  description?: string;
  memberIds: string[];
  pinnedMessageIds: string[];
  createdAt: string;
}

export const ME_ID = "me";

interface Ctx {
  users: ChatUser[];
  me: ChatUser | undefined;
  meId: string;
  channels: Channel[];
  messages: Message[];
  typingByChannel: Record<string, TypingState[]>;
  readReceiptsByChannel: Record<string, ReadReceipt[]>;
  unreadCounts: Record<string, number>;
  send: (channelId: string, body: string, attachments: Attachment[], mentions: string[], replyTo?: string) => Promise<void>;
  react: (messageId: string, emoji: string) => Promise<void>;
  pin: (messageId: string) => Promise<void>;
  createChannel: (c: Omit<Channel, "id" | "createdAt" | "pinnedMessageIds">) => Promise<Channel>;
  startDM: (targetUserId: string) => Promise<Channel>;
  updateChannel: (id: string, data: Partial<Pick<Channel, "name" | "emoji" | "description">>) => Promise<Channel>;
  deleteChannel: (id: string) => Promise<void>;
  addChannelMember: (channelId: string, userId: string) => Promise<Channel>;
  removeChannelMember: (channelId: string, userId: string) => Promise<Channel>;
  editMessage: (id: string, body: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  setLocalTyping: (channelId: string, typing: boolean) => void;
  markChannelAsRead: (channelId: string) => void;
  loading: boolean;
  accessDenied: boolean;
  accessMessage: string;
  accessCheckLoading: boolean;
  employeeInfo?: { id: string; code: string; name: string; department: string; position: string };
}

const ChatCtx = createContext<Ctx | null>(null);

function responseError(err: unknown) {
  if (typeof err !== "object" || err === null) return {};
  return err as { response?: { status?: number; data?: { message?: string } } };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const value = useChatStore();
  return createElement(ChatCtx.Provider, { value }, children);
}

function useChatStore(): Ctx {
  const { user } = useAuth();
  const meId = String(user?.user_metadata?.chatUserId ?? user?.id ?? ME_ID);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingByChannel, setTypingByChannel] = useState<Record<string, TypingState[]>>({});
  const [readReceiptsByChannel, setReadReceiptsByChannel] = useState<Record<string, ReadReceipt[]>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");
  const [accessCheckLoading, setAccessCheckLoading] = useState(true);
  const [employeeInfo, setEmployeeInfo] = useState<Ctx["employeeInfo"]>(undefined);
  const typingDebounceRef = useRef<Record<string, number>>({});

  // Access check on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { checkChatAccess } = await import("@/services/api");
        const res = await checkChatAccess();
        if (cancelled) return;
        if (res.allowed) {
          setAccessDenied(false);
          setEmployeeInfo(res.employee);
        } else {
          setAccessDenied(true);
          setAccessMessage("Chat access is restricted to company employees only.");
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const { response } = responseError(e);
        const status = response?.status;
        const msg = response?.data?.message;
        if (status === 403) {
          setAccessDenied(true);
          setAccessMessage(msg || "Access restricted to active company employees only.");
        } else if (status === 401) {
          setAccessDenied(true);
          setAccessMessage("Please sign in to access the chatroom.");
        } else {
          setAccessDenied(false);
        }
      } finally {
        if (!cancelled) setAccessCheckLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Presence heartbeat
  useEffect(() => {
    if (accessDenied || accessCheckLoading) return;
    heartbeatPresence(meId).catch(() => {});
    const hb = setInterval(() => {
      heartbeatPresence(meId).catch(() => {});
    }, 30000);
    const onUnload = () => {
      void setPresenceOffline(meId).catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(hb);
      window.removeEventListener("beforeunload", onUnload);
      setPresenceOffline(meId).catch(() => {});
    };
  }, [meId, accessDenied, accessCheckLoading]);

  // Load initial data and set up polling
  useEffect(() => {
    if (accessDenied || accessCheckLoading) return;

    const fetchData = async () => {
      try {
        const [u, c] = await Promise.all([getChatUsers(), getChatChannels()]);
        setUsers(u);
        setChannels(c);
        const allMsgs: Message[] = [];
        for (const ch of c) {
          const msgs = await getChannelMessages(ch.id);
          allMsgs.push(...msgs);
        }
        setMessages(allMsgs);
        const counts = await getUnreadCounts().catch(() => ({}));
        setUnreadCounts(counts);
      } catch (e) {
        console.error("Failed to load chat data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const pollInterval = setInterval(async () => {
      try {
        const [u, c] = await Promise.all([getChatUsers(), getChatChannels()]);
        setUsers(u);
        setChannels(c);
        const allMsgs: Message[] = [];
        for (const ch of c) {
          const msgs = await getChannelMessages(ch.id);
          allMsgs.push(...msgs);
        }
        setMessages(allMsgs);
        const counts = await getUnreadCounts().catch(() => ({}));
        setUnreadCounts(counts);
        for (const ch of c) {
          const typing = await getTypingInChannel(ch.id).catch(() => []);
          setTypingByChannel(prev => ({ ...prev, [ch.id]: typing.filter(t => t.userId !== meId) }));
        }
      } catch (e) {
        console.error("Failed to poll chat messages", e);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [accessDenied, accessCheckLoading, meId]);

  const me = users.find(u => u.id === meId);

  const setLocalTyping = useCallback((channelId: string, typing: boolean) => {
    if (typingDebounceRef.current[channelId]) {
      window.clearTimeout(typingDebounceRef.current[channelId]);
    }
    if (typing) {
      setTyping(channelId, meId, true).catch(() => {});
      typingDebounceRef.current[channelId] = window.setTimeout(() => {
        setTyping(channelId, meId, false).catch(() => {});
      }, 3000);
    } else {
      setTyping(channelId, meId, false).catch(() => {});
    }
  }, [meId]);

  const markChannelAsRead = useCallback((channelId: string) => {
    markChannelRead(channelId, meId).then(() => {
      setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
    }).catch(() => {});
  }, [meId]);

  return {
    users, me, meId, channels, messages, loading, typingByChannel, readReceiptsByChannel, unreadCounts,
    accessDenied, accessMessage, accessCheckLoading, employeeInfo,
    setLocalTyping, markChannelAsRead,
    send: async (channelId, body, attachments, mentions, replyTo) => {
      const newMsg = await createChatMessage({
        channelId,
        authorId: meId,
        body,
        mentions,
        attachments,
        replyTo,
      });
      setMessages(p => [...p, newMsg]);
      setLocalTyping(channelId, false);
    },
    react: async (messageId, emoji) => {
      const currentMessage = messages.find(m => m.id === messageId);
      if (!currentMessage) return;
      const idx = currentMessage.reactions.findIndex(r => r.emoji === emoji);
      let nextReactions;
      if (idx === -1) {
        nextReactions = [...currentMessage.reactions, { emoji, userIds: [meId] }];
      } else {
        const r = currentMessage.reactions[idx];
        const has = r.userIds.includes(meId);
        const nextUsers = has ? r.userIds.filter(u => u !== meId) : [...r.userIds, meId];
        if (nextUsers.length === 0) {
          nextReactions = currentMessage.reactions.filter((_, i) => i !== idx);
        } else {
          nextReactions = currentMessage.reactions.map((r, i) => i === idx ? { ...r, userIds: nextUsers } : r);
        }
      }
      const updated = await updateChatMessage(messageId, { reactions: nextReactions });
      setMessages(p => p.map(m => m.id === messageId ? updated : m));
    },
    pin: async (messageId) => {
      const m = messages.find(m => m.id === messageId);
      if (!m) return;
      const updated = await updateChatMessage(messageId, { pinned: !m.pinned });
      setMessages(p => p.map(x => x.id === messageId ? updated : x));
    },
    createChannel: async (c) => {
      const newChan = await createChatChannel(c);
      setChannels(p => [newChan, ...p]);
      return newChan;
    },
    startDM: async (targetUserId) => {
      const dmChan = await startDirectMessage(targetUserId);
      setChannels(p => {
        const exists = p.some(c => c.id === dmChan.id);
        return exists ? p.map(c => c.id === dmChan.id ? dmChan : c) : [dmChan, ...p];
      });
      return dmChan;
    },
    updateChannel: async (id, data) => {
      const updated = await updateChatChannel(id, data);
      setChannels(p => p.map(c => c.id === id ? updated : c));
      return updated;
    },
    deleteChannel: async (id) => {
      await deleteChatChannel(id);
      setChannels(p => p.filter(c => c.id !== id));
    },
    addChannelMember: async (channelId, userId) => {
      const updated = await addChannelMember(channelId, userId);
      setChannels(p => p.map(c => c.id === channelId ? updated : c));
      return updated;
    },
    removeChannelMember: async (channelId, userId) => {
      const updated = await removeChannelMember(channelId, userId);
      setChannels(p => p.map(c => c.id === channelId ? updated : c));
      return updated;
    },
    editMessage: async (id, body) => {
      const updated = await updateChatMessage(id, { body });
      setMessages(p => p.map(x => x.id === id ? updated : x));
    },
    deleteMessage: async id => {
      await deleteChatMessage(id);
      setMessages(p => p.filter(x => x.id !== id));
    },
  };
}

export function useChat(): Ctx {
  const ctx = useContext(ChatCtx);
  const local = useChatStore();
  return ctx ?? local;
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
