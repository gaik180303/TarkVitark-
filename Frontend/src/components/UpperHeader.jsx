import React from 'react';
import { Users, ThumbsUp, ThumbsDown } from 'lucide-react';

export default function UpperHeader({
  title,
  totalUsers,
  inFavorCount,
  againstCount,
  hostName,
  hostImage,
}) {
  return (
    <div className="bg-white shadow-sm border-b">
      {/* Motion banner — makes it read as a debate, not a chat room */}
      <div className="bg-gradient-to-r from-emerald-50 via-white to-rose-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">This house believes</p>
        <h1 className="text-lg font-bold text-gray-900 leading-snug">{title}</h1>
      </div>

      <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* Always-visible, keyboard-accessible stance counts */}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-gray-500">
            <Users size={16} /> {totalUsers}
          </span>
          <span className="flex items-center gap-1 font-medium text-emerald-600">
            <ThumbsUp size={16} /> For {inFavorCount}
          </span>
          <span className="flex items-center gap-1 font-medium text-rose-600">
            <ThumbsDown size={16} /> Against {againstCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Hosted by</span>
          <span className="text-sm text-gray-700">{hostName}</span>
          <img src={hostImage} alt={hostName} className="w-7 h-7 rounded-full object-cover" />
        </div>
      </div>
    </div>
  );
}
