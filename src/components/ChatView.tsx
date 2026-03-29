'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

/* ─── Types ─────────────────────────────────────────────── */
interface User { id: number; name: string; role: string; }
interface Message {
  id: number;
  senderId: number;
  text: string;
  mentions: number[];
  reactions: Record<string, number[]>;
  replyToId: number | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  sender: User;
  replyTo?: { id: number; text: string; sender: User } | null;
}

/* ─── Constants ─────────────────────────────────────────── */
const ROLE_COLOR: Record<string, string> = {
  admin:       'bg-purple-500',
  accountant:  'bg-blue-500',
  salesperson: 'bg-orange-500',
};
const ROLE_BADGE: Record<string, string> = {
  admin:       'bg-purple-100 text-purple-700',
  accountant:  'bg-blue-100 text-blue-700',
  salesperson: 'bg-orange-100 text-orange-700',
};
const QUICK_EMOJIS = ['👍','👎','❤️','😂','🎉','🔥','✅','👀'];

/* ─── Helpers ───────────────────────────────────────────── */
function timeStr(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yesterday.toDateString();
  const t = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (isToday)   return t;
  if (isYest)    return `Yesterday ${t}`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + t;
}

function dateDivider(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate()-1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
}

function avatar(name: string, role: string) {
  return (
    <div className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-white text-sm font-extrabold ${ROLE_COLOR[role] || 'bg-gray-500'}`}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

/* ─── Parsed text with @mentions highlighted ─────────────── */
function MsgText({ text, users }: { text: string; users: User[] }) {
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));
  const parts = text.split(/(@\[(\d+)\])/g);
  return (
    <span>
      {parts.map((part, i) => {
        const m = part.match(/^@\[(\d+)\]$/);
        if (m) {
          const name = userMap[parseInt(m[1])] || 'Unknown';
          return <span key={i} className="bg-orange-100 text-orange-700 font-semibold px-1 rounded text-sm">@{name}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

/* ─── Main Component ────────────────────────────────────── */
export default function ChatView() {
  const { data: session } = useSession();
  const me = {
    id:   parseInt((session?.user as any)?.id || '0'),
    name: (session?.user as any)?.name || '',
    role: (session?.user as any)?.role || '',
  };

  const [messages,    setMessages]    = useState<Message[]>([]);
  const [users,       setUsers]       = useState<User[]>([]);
  const [text,        setText]        = useState('');
  const [replyTo,     setReplyTo]     = useState<Message | null>(null);
  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [editText,    setEditText]    = useState('');
  const [emojiFor,    setEmojiFor]    = useState<number | null>(null);
  const [mentionQ,    setMentionQ]    = useState('');
  const [showMention, setShowMention] = useState(false);
  const [mentionIdx,  setMentionIdx]  = useState(0);
  const [sending,     setSending]     = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastMsgId  = useRef<string | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Initial load ── */
  const loadInitial = useCallback(async () => {
    const res = await fetch('/api/chat?limit=60');
    if (!res.ok) return;
    const d = await res.json();
    setMessages(d.messages || []);
    setUsers(d.users || []);
    if ((d.messages || []).length < 60) setHasMore(false);
    if (d.messages?.length) lastMsgId.current = d.messages[d.messages.length - 1].createdAt;
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
  }, []);

  /* ── Poll for new messages ── */
  const poll = useCallback(async () => {
    if (!lastMsgId.current) return;
    const res = await fetch(`/api/chat?since=${encodeURIComponent(lastMsgId.current)}`);
    if (!res.ok) return;
    const d = await res.json();
    if (d.messages?.length) {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newOnes = d.messages.filter((m: Message) => !existingIds.has(m.id));
        if (!newOnes.length) return prev;
        lastMsgId.current = d.messages[d.messages.length - 1].createdAt;
        const atBottom = scrollRef.current
          ? scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 120
          : true;
        if (atBottom) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        return [...prev, ...newOnes];
      });
    }
    // Refresh reactions on existing messages (lightweight update)
    if (d.messages?.length === 0) {
      // still refresh reactions by re-fetching last few
    }
  }, []);

  useEffect(() => {
    loadInitial();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadInitial, poll]);

  /* ── Load older messages ── */
  const loadMore = async () => {
    if (!messages.length || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const oldestId = messages[0].id;
    const res = await fetch(`/api/chat?cursor=${oldestId}&limit=40`);
    if (!res.ok) { setLoadingMore(false); return; }
    const d = await res.json();
    if (d.messages?.length < 40) setHasMore(false);
    setMessages(prev => [...d.messages, ...prev]);
    setLoadingMore(false);
  };

  /* ── Mention detection ── */
  const handleInput = (val: string) => {
    setText(val);
    const cursorPos = inputRef.current?.selectionStart || val.length;
    const beforeCursor = val.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQ(atMatch[1].toLowerCase());
      setShowMention(true);
      setMentionIdx(0);
    } else {
      setShowMention(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.id !== me.id && u.name.toLowerCase().includes(mentionQ)
  );

  const insertMention = (u: User) => {
    const cursorPos = inputRef.current?.selectionStart || text.length;
    const beforeCursor = text.slice(0, cursorPos);
    const afterCursor  = text.slice(cursorPos);
    const replaced = beforeCursor.replace(/@\w*$/, `@[${u.id}] `);
    setText(replaced + afterCursor);
    setShowMention(false);
    inputRef.current?.focus();
  };

  /* ── Parse mentions from text ── */
  const parseMentions = (t: string): number[] => {
    const matches = Array.from(t.matchAll(/@\[(\d+)\]/g));
    const ids = matches.map(m => parseInt(m[1]));
    return ids.filter((id, idx) => ids.indexOf(id) === idx);
  };

  /* ── Send ── */
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const mentions = parseMentions(text);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), replyToId: replyTo?.id, mentions }),
    });
    if (res.ok) {
      const d = await res.json();
      setMessages(prev => [...prev, d.message]);
      setText('');
      setReplyTo(null);
      lastMsgId.current = d.message.createdAt;
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } else {
      toast.error('Failed to send message');
    }
    setSending(false);
  };

  /* ── Keyboard ── */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMention && filteredUsers.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i+1, filteredUsers.length-1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => Math.max(i-1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredUsers[mentionIdx]); return; }
      if (e.key === 'Escape') { setShowMention(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  /* ── React ── */
  const react = async (msgId: number, emoji: string) => {
    const res = await fetch(`/api/chat/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'react', emoji }),
    });
    if (res.ok) {
      const d = await res.json();
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: d.message.reactions } : m));
    }
    setEmojiFor(null);
  };

  /* ── Edit ── */
  const submitEdit = async (msgId: number) => {
    if (!editText.trim()) return;
    const res = await fetch(`/api/chat/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', text: editText }),
    });
    if (res.ok) {
      const d = await res.json();
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: d.message.text, isEdited: true } : m));
      setEditingId(null);
    }
  };

  /* ── Delete ── */
  const deleteMsg = async (msgId: number) => {
    const res = await fetch(`/api/chat/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete' }),
    });
    if (res.ok) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, text: '' } : m));
    }
  };

  /* ── Group messages by date ── */
  const grouped: { divider?: string; msg: Message }[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const date = new Date(msg.createdAt).toDateString();
    if (date !== lastDate) {
      grouped.push({ divider: dateDivider(msg.createdAt), msg });
      lastDate = date;
    } else {
      grouped.push({ msg });
    }
  }

  /* ── Render message ── */
  const renderMsg = (msg: Message, showHeader: boolean) => {
    const isMine = msg.senderId === me.id;
    const reactions = (msg.reactions || {}) as Record<string, number[]>;
    const isEditing = editingId === msg.id;

    if (msg.isDeleted) {
      return (
        <div key={msg.id} className="flex items-center gap-2 px-4 py-1">
          <div className="w-8 h-8 shrink-0" />
          <span className="text-xs text-gray-400 italic">🗑️ This message was deleted</span>
        </div>
      );
    }

    return (
      <div
        key={msg.id}
        className={`group flex gap-3 px-4 py-1 hover:bg-gray-50/80 transition-colors ${showHeader ? 'mt-3' : 'mt-0.5'}`}
        onMouseLeave={() => setEmojiFor(null)}
      >
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {showHeader ? avatar(msg.sender.name, msg.sender.role) : <div className="w-8" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          {showHeader && (
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-gray-900 text-sm">{msg.sender.name}</span>
              <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-semibold capitalize ${ROLE_BADGE[msg.sender.role] || ''}`}>
                {msg.sender.role}
              </span>
              <span className="text-[10px] text-gray-400">{timeStr(msg.createdAt)}</span>
              {msg.isEdited && <span className="text-[10px] text-gray-400 italic">(edited)</span>}
            </div>
          )}

          {/* Reply preview */}
          {msg.replyTo && (
            <div className="flex items-start gap-2 mb-1 pl-3 border-l-2 border-orange-400 bg-orange-50/50 rounded-r-lg py-1 pr-2">
              <span className="text-[10px] text-orange-600 font-bold shrink-0">↩ {msg.replyTo.sender.name}</span>
              <span className="text-[11px] text-gray-500 truncate">{msg.replyTo.text.slice(0, 80)}</span>
            </div>
          )}

          {/* Message text or edit box */}
          {isEditing ? (
            <div className="flex gap-2">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id); } if (e.key === 'Escape') setEditingId(null); }}
                className="flex-1 border border-orange-400 rounded-xl px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                rows={2}
                autoFocus
              />
              <div className="flex flex-col gap-1">
                <button onClick={() => submitEdit(msg.id)} className="px-2 py-1 bg-orange-500 text-white rounded-lg text-xs font-bold">Save</button>
                <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-gray-200 text-gray-600 rounded-lg text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-800 leading-relaxed break-words whitespace-pre-wrap">
              <MsgText text={msg.text} users={users} />
            </p>
          )}

          {/* Reactions */}
          {Object.keys(reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(reactions).map(([emoji, uids]) => (
                <button key={emoji} onClick={() => react(msg.id, emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition ${
                    uids.includes(me.id)
                      ? 'bg-orange-100 border-orange-300 text-orange-700 font-bold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  <span>{emoji}</span>
                  <span>{uids.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action bar — shows on hover */}
        <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative mt-0.5">
          {/* Emoji picker trigger */}
          <div className="relative">
            <button onClick={() => setEmojiFor(emojiFor === msg.id ? null : msg.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 text-sm transition">
              😊
            </button>
            {emojiFor === msg.id && (
              <div className="absolute right-0 top-8 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 flex gap-1 z-20">
                {QUICK_EMOJIS.map(e => (
                  <button key={e} onClick={() => react(msg.id, e)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg transition">
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply */}
          <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 text-sm transition" title="Reply">
            ↩
          </button>

          {/* Edit (own messages only) */}
          {isMine && !isEditing && (
            <button onClick={() => { setEditingId(msg.id); setEditText(msg.text); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 text-xs transition" title="Edit">
              ✏️
            </button>
          )}

          {/* Delete (own or admin) */}
          {(isMine || me.role === 'admin') && (
            <button onClick={() => deleteMsg(msg.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 text-xs transition" title="Delete">
              🗑️
            </button>
          )}
        </div>
      </div>
    );
  };

  /* ── Detect consecutive messages from same sender ── */
  const shouldShowHeader = (i: number): boolean => {
    if (i === 0) return true;
    const prev = messages[i - 1];
    const curr = messages[i];
    if (prev.senderId !== curr.senderId) return true;
    const diff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
    return diff > 5 * 60 * 1000; // 5 min gap = new header
  };

  return (
    <div className="flex flex-col h-[calc(100vh-52px)] bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center text-white text-xl shadow-sm">
          💬
        </div>
        <div>
          <h1 className="font-extrabold text-gray-900 text-base">Team Chat</h1>
          <p className="text-xs text-gray-400">{users.length} members · One group for the whole team</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {users.slice(0, 5).map(u => (
            <div key={u.id} title={u.name}
              className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold ${ROLE_COLOR[u.role] || 'bg-gray-400'}`}>
              {u.name[0]?.toUpperCase()}
            </div>
          ))}
          {users.length > 5 && <span className="text-xs text-gray-400 ml-1">+{users.length - 5}</span>}
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center py-3">
            <button onClick={loadMore} disabled={loadingMore}
              className="px-4 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-full hover:bg-gray-100 transition disabled:opacity-50">
              {loadingMore ? 'Loading…' : '⬆ Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="text-5xl mb-4">💬</div>
            <p className="font-semibold">No messages yet</p>
            <p className="text-sm mt-1">Be the first to say something!</p>
          </div>
        )}

        {/* Grouped messages */}
        {(() => {
          const items: JSX.Element[] = [];
          let msgIdx = 0;
          for (const { divider, msg } of grouped) {
            if (divider) {
              items.push(
                <div key={`div-${msg.id}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-semibold bg-gray-100 px-3 py-1 rounded-full">{divider}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              );
            }
            items.push(renderMsg(msg, shouldShowHeader(msgIdx)));
            msgIdx++;
          }
          return items;
        })()}

        <div ref={bottomRef} className="h-4" />
      </div>

      {/* ── Reply banner ── */}
      {replyTo && (
        <div className="mx-4 mb-1 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
          <span className="text-orange-500 text-sm">↩</span>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-orange-700">{replyTo.sender.name}</span>
            <span className="text-xs text-gray-500 ml-2 truncate">{replyTo.text.slice(0, 60)}</span>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-500 text-lg leading-none transition">×</button>
        </div>
      )}

      {/* ── Input area ── */}
      <div className="px-4 pb-4 relative">
        {/* Mention dropdown */}
        {showMention && filteredUsers.length > 0 && (
          <div className="absolute bottom-full mb-2 left-4 right-4 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-20 max-h-48 overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-50">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tag a team member</span>
            </div>
            {filteredUsers.map((u, i) => (
              <button key={u.id} onClick={() => insertMention(u)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 transition text-left ${i === mentionIdx ? 'bg-orange-50' : ''}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold ${ROLE_COLOR[u.role] || 'bg-gray-400'}`}>
                  {u.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{u.name}</p>
                  <p className={`text-xs px-1.5 py-0.5 rounded-full w-fit capitalize ${ROLE_BADGE[u.role] || ''}`}>{u.role}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end bg-white border border-gray-200 rounded-2xl px-3 py-2 shadow-sm focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition">
          {/* My avatar */}
          <div className="shrink-0 mb-1">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ${ROLE_COLOR[me.role] || 'bg-gray-400'}`}>
              {me.name[0]?.toUpperCase()}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message the team… (type @ to tag someone, Enter to send)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm focus:outline-none py-1 max-h-32 leading-relaxed text-gray-800 placeholder-gray-400"
            style={{ height: 'auto', minHeight: '28px' }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 128) + 'px';
            }}
          />

          {/* @ button */}
          <button
            onClick={() => { setText(t => t + '@'); setShowMention(true); setMentionQ(''); inputRef.current?.focus(); }}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-orange-50 hover:text-orange-500 transition font-bold text-sm mb-0.5"
            title="Tag someone"
          >
            @
          </button>

          {/* Send */}
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm mb-0.5"
          >
            {sending
              ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <span className="text-sm">↑</span>
            }
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Enter to send · Shift+Enter for new line · @ to mention · hover message for actions
        </p>
      </div>
    </div>
  );
}
