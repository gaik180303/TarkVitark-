import React, { useEffect, useRef } from 'react';

// Renders persisted Message documents:
//   { _id, content, stance, sender: { _id, username, avatarUrl }, createdAt }
// Bubbles are colored and aligned by SIDE (not by who's speaking):
//   in_favor  -> emerald, left    against -> rose, right    null (host) -> neutral, centered
const STANCE_STYLES = {
  in_favor: {
    align: 'justify-start',
    bubble: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
    label: 'For',
    labelColor: 'text-emerald-700',
  },
  against: {
    align: 'justify-end',
    bubble: 'bg-rose-100 text-rose-900 border border-rose-200',
    label: 'Against',
    labelColor: 'text-rose-700',
  },
  moderator: {
    align: 'justify-center',
    bubble: 'bg-gray-100 text-gray-700 border border-gray-200',
    label: 'Host',
    labelColor: 'text-gray-500',
  },
};

export default function ChatBody({ messages = [], currentUserId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!Array.isArray(messages) || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-gray-500 text-sm">
        No arguments yet — make the first point!
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((message) => {
        if (!message?.sender) return null;

        const style = STANCE_STYLES[message.stance] || STANCE_STYLES.moderator;
        const senderName = message.sender.username || 'User';
        const isMine = String(message.sender._id) === String(currentUserId);
        const time = message.createdAt
          ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';

        return (
          <div key={message._id} className={`flex ${style.align}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${style.bubble} ${isMine ? 'ring-2 ring-offset-1 ring-blue-300' : ''}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold">{senderName}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${style.labelColor}`}>
                  {style.label}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              <span className="text-[10px] opacity-60 mt-1 block">{time}</span>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
