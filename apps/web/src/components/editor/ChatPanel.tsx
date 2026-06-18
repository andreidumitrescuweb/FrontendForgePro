'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, apiGet, getAccessToken } from '@/lib/api';
import { Button, Input, Spinner } from '@/components/ui';
import { timeAgo } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
}

interface Props {
  projectId: string;
  /** Submit an instruction to the AI instead of the team chat. */
  onAiInstruction: (instruction: string) => Promise<void>;
}

export function ChatPanel({ projectId, onAiInstruction }: Props) {
  const [mode, setMode] = useState<'ai' | 'team'>('ai');
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void apiGet<{ messages: Message[] }>(`/chat/projects/${projectId}/messages`).then((res) =>
      setMessages(res.messages),
    );
    const socket = io(API_URL, { auth: { token: getAccessToken() } });
    socketRef.current = socket;
    socket.emit('join', projectId);
    socket.on('chat:message', (msg: Message) => setMessages((prev) => [...prev, msg]));
    socket.on('presence:join', ({ name }: { name: string }) =>
      setPresence((p) => [...new Set([...p, name])]),
    );
    socket.on('presence:leave', ({ name }: { name: string }) =>
      setPresence((p) => p.filter((n) => n !== name)),
    );
    return () => {
      socket.disconnect();
    };
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    if (mode === 'team') {
      socketRef.current?.emit('chat:send', { projectId, content: text });
      setInput('');
      return;
    }
    setBusy(true);
    try {
      await onAiInstruction(text);
      setInput('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-slate-200">
        {(['ai', 'team'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === m ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500'
            }`}
          >
            {m === 'ai' ? 'AI Assistant' : `Team chat${presence.length ? ` (${presence.length + 1})` : ''}`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {mode === 'ai' ? (
          <p className="text-sm leading-relaxed text-slate-500">
            Tell the AI what to change — it edits the whole project. Examples: “switch the main
            font to Inter, make the navbar sticky and add a testimonials section”, “translate
            everything to Arabic and flip the layout to RTL”.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id}>
                <p className="text-xs text-slate-400">
                  <span className="font-medium text-slate-600">{m.user.name}</span> · {timeAgo(m.createdAt)}
                </p>
                <p className="text-sm">{m.content}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-slate-200 p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'ai' ? 'Instruct the AI…' : 'Message the team…'}
          aria-label={mode === 'ai' ? 'AI instruction' : 'Chat message'}
        />
        <Button type="submit" disabled={busy} size="md">
          {busy ? <Spinner className="border-white/40 border-t-white" /> : 'Send'}
        </Button>
      </form>
    </div>
  );
}
