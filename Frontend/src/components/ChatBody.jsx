import React, { useEffect, useRef } from 'react';
import { Star, Link as LinkIcon, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

// Bubbles colored/aligned by SIDE: in_favor -> emerald left, against -> rose right,
// null (host) -> neutral centered.
const STANCE_STYLES = {
  in_favor: { align: 'justify-start', bubble: 'bg-emerald-100 text-emerald-900 border border-emerald-200', label: 'For', labelColor: 'text-emerald-700' },
  against: { align: 'justify-end', bubble: 'bg-rose-100 text-rose-900 border border-rose-200', label: 'Against', labelColor: 'text-rose-700' },
  moderator: { align: 'justify-center', bubble: 'bg-gray-100 text-gray-700 border border-gray-200', label: 'Host', labelColor: 'text-gray-500' },
};

const FACT_BADGE = {
  accurate: { icon: ShieldCheck, cls: 'text-emerald-600', text: 'Accurate' },
  inaccurate: { icon: ShieldAlert, cls: 'text-red-600', text: 'Disputed' },
  misleading: { icon: ShieldAlert, cls: 'text-amber-600', text: 'Misleading' },
  unverifiable: { icon: ShieldQuestion, cls: 'text-gray-500', text: 'Unverified' },
};

function FactCheckBadge({ factCheck }) {
  if (!factCheck?.verdict) return null;
  const b = FACT_BADGE[factCheck.verdict] || FACT_BADGE.unverifiable;
  const Icon = b.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${b.cls}`} title={factCheck.explanation || ''}>
      <Icon size={12} /> {b.text}
    </span>
  );
}

export default function ChatBody({ messages = [], currentUserId, onStar }) {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!Array.isArray(messages) || messages.length === 0) {
    return <div className="flex-1 flex items-center justify-center p-8 text-gray-500 text-sm">No arguments yet — make the first point!</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((message) => {
        if (!message?.sender) return null;
        const style = STANCE_STYLES[message.stance] || STANCE_STYLES.moderator;
        const senderName = message.sender.username || 'User';
        const isMine = String(message.sender._id) === String(currentUserId);
        const starCount = message.starCount ?? message.stars?.length ?? 0;
        const time = message.createdAt
          ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';

        return (
          <div key={message._id} className={`flex ${style.align}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${style.bubble} ${isMine ? 'ring-2 ring-offset-1 ring-blue-300' : ''}`}>
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-xs font-semibold">{senderName}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${style.labelColor}`}>{style.label}</span>
                <FactCheckBadge factCheck={message.factCheck} />
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

              {message.evidenceUrl && (
                <a href={message.evidenceUrl} target="_blank" rel="noreferrer"
                   className="mt-1 inline-flex items-center gap-1 text-[11px] underline opacity-80 hover:opacity-100 break-all">
                  <LinkIcon size={11} /> source
                </a>
              )}

              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] opacity-60">{time}</span>
                <button
                  onClick={() => onStar?.(message._id)}
                  className={`inline-flex items-center gap-0.5 text-[11px] transition ${starCount > 0 ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                  title="Star as a strong argument"
                >
                  <Star size={12} fill={starCount > 0 ? 'currentColor' : 'none'} /> {starCount || ''}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
