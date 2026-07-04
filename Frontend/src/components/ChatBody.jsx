import React, { useEffect, useRef } from 'react';

// Renders persisted Message documents: { _id, content, sender: { _id, username, avatarUrl }, createdAt }
export default function ChatBody({ messages = [], currentUserId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!Array.isArray(messages) || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-gray-500 text-sm">
        No messages yet — start the debate!
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => {
        if (!message?.sender) return null;

        const senderName = message.sender.username || 'User';
        const avatar = message.sender.avatarUrl
          || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}`;
        const isCurrentUser = String(message.sender._id) === String(currentUserId);
        const timestamp = message.createdAt
          ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';

        return (
          <div
            key={message._id}
            className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
          >
            <div className="flex space-x-2 max-w-[70%]">
              {!isCurrentUser && (
                <img
                  src={avatar}
                  alt={senderName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <div className="flex flex-col">
                {!isCurrentUser && (
                  <span className="text-sm text-gray-600 mb-1">{senderName}</span>
                )}
                <div
                  className={`rounded-lg p-3 ${
                    isCurrentUser
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <span className="text-xs opacity-70 mt-1 block">{timestamp}</span>
                </div>
              </div>
              {isCurrentUser && (
                <img
                  src={avatar}
                  alt={senderName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
