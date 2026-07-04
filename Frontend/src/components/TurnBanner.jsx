import React, { useEffect, useState } from 'react';
import { Play, Square, Timer } from 'lucide-react';

// Shows whose turn it is with a live countdown, plus host controls to start/end.
export default function TurnBanner({ turn, isHost, onStart, onEnd }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!turn?.active || !turn.turnEndsAt) return undefined;
    const update = () => setSecondsLeft(Math.max(0, Math.round((turn.turnEndsAt - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [turn]);

  if (!turn?.active) {
    return (
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-gray-50 border-b">
        <span className="text-xs text-gray-500">
          {isHost ? 'Turns are off — start the debate to enforce speaking order.' : 'Free discussion — no turn limit.'}
        </span>
        {isHost && (
          <button
            onClick={onStart}
            className="flex items-center gap-1 text-xs font-medium bg-blue-600 text-white px-3 py-1 rounded-full hover:bg-blue-700"
          >
            <Play size={14} /> Start debate
          </button>
        )}
      </div>
    );
  }

  const isFor = turn.currentStance === 'in_favor';
  return (
    <div
      className={`flex items-center justify-between gap-2 px-4 py-2 border-b ${
        isFor ? 'bg-emerald-50' : 'bg-rose-50'
      }`}
    >
      <span className={`flex items-center gap-2 text-sm font-semibold ${isFor ? 'text-emerald-700' : 'text-rose-700'}`}>
        <Timer size={16} />
        {isFor ? 'For' : 'Against'} side is speaking
        <span className="ml-1 tabular-nums font-mono">{secondsLeft}s</span>
      </span>
      {isHost && (
        <button
          onClick={onEnd}
          className="flex items-center gap-1 text-xs font-medium bg-gray-800 text-white px-3 py-1 rounded-full hover:bg-black"
        >
          <Square size={12} /> End debate
        </button>
      )}
    </div>
  );
}
