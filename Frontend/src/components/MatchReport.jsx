import React, { useEffect, useState } from 'react';
import { X, Trophy, Download, Users, Bot } from 'lucide-react';
import voteService from '../services/voteService';

const sideLabel = (w) => (w === 'in_favor' ? 'For' : w === 'against' ? 'Against' : 'Tie');

// Draw a 1200x630 share card to a canvas and trigger a PNG download.
function downloadCard({ motion, aiWinner, crowdWinner }) {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 630;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 1200, 630);
  grad.addColorStop(0, '#059669');
  grad.addColorStop(1, '#e11d48');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillRect(40, 40, 1120, 550);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('TARK-VITARK · DEBATE RESULT', 80, 120);
  ctx.font = 'bold 46px sans-serif';
  const words = String(motion).split(' ');
  let line = '';
  let y = 210;
  for (const w of words) {
    if ((line + w).length > 34) { ctx.fillText(line, 80, y); line = ''; y += 58; }
    line += `${w} `;
  }
  ctx.fillText(line, 80, y);

  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#059669';
  ctx.fillText(`🤖 AI Judge: ${sideLabel(aiWinner)}`, 80, 470);
  ctx.fillStyle = '#e11d48';
  ctx.fillText(`👥 The Crowd: ${sideLabel(crowdWinner)}`, 80, 530);

  const url = c.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'debate-result.png';
  a.click();
}

export default function MatchReport({ result, motion, debateId, messages = [], onClose }) {
  const [crowd, setCrowd] = useState(null);

  useEffect(() => {
    voteService.getSummary(debateId).then((d) => setCrowd(d?.verdict)).catch(() => {});
  }, [debateId]);

  // Crowd's favourite argument per side (most stars).
  const topStar = (stance) =>
    messages
      .filter((m) => m.stance === stance && (m.starCount ?? m.stars?.length ?? 0) > 0)
      .sort((a, b) => (b.starCount ?? b.stars?.length ?? 0) - (a.starCount ?? a.stars?.length ?? 0))[0];

  const judge = result.judge || {};
  const stats = result.stats || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2"><Trophy className="text-amber-500" size={20} /> Match Report</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} className="text-gray-400 hover:text-gray-700" /></button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-xs uppercase tracking-wide text-gray-400">This house believed</p>
          <p className="text-base font-semibold text-gray-900 -mt-4">{motion}</p>

          {/* AI Judge vs the Crowd */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-4 text-center">
              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-500"><Bot size={14} /> AI Judge</p>
              <p className="text-xl font-bold mt-1">{sideLabel(judge.winner)}</p>
              {judge.scoreFor != null && (
                <p className="text-xs text-gray-500 mt-1">For {judge.scoreFor} · Against {judge.scoreAgainst}</p>
              )}
            </div>
            <div className="rounded-xl border p-4 text-center">
              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-500"><Users size={14} /> The Crowd</p>
              <p className="text-xl font-bold mt-1">{crowd ? sideLabel(crowd.winner) : '…'}</p>
              <p className="text-xs text-gray-500 mt-1">by minds changed</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Summary</p>
            <p className="text-sm text-gray-600">{result.summary}</p>
            {judge.reasoning && <p className="text-xs text-gray-400 mt-1 italic">{judge.reasoning}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-emerald-700 mb-1">Key points — For</p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                {(result.keyPointsFor || []).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
              {result.bestArgumentFor && <p className="text-xs mt-2"><span className="font-semibold">AI's pick:</span> {result.bestArgumentFor}</p>}
              {topStar('in_favor') && <p className="text-xs mt-1"><span className="font-semibold">Crowd's pick:</span> {topStar('in_favor').content}</p>}
            </div>
            <div>
              <p className="text-xs font-bold text-rose-700 mb-1">Key points — Against</p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                {(result.keyPointsAgainst || []).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
              {result.bestArgumentAgainst && <p className="text-xs mt-2"><span className="font-semibold">AI's pick:</span> {result.bestArgumentAgainst}</p>}
              {topStar('against') && <p className="text-xs mt-1"><span className="font-semibold">Crowd's pick:</span> {topStar('against').content}</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 border-t pt-3">
            <span>{stats.total ?? 0} messages</span>
            <span className="text-emerald-600">For {stats.forSharePct ?? 0}% talk-share</span>
            <span className="text-rose-600">Against {100 - (stats.forSharePct ?? 0)}%</span>
            {stats.flaggedCount > 0 && <span className="text-red-600">{stats.flaggedCount} disputed claim(s)</span>}
          </div>

          <button
            onClick={() => downloadCard({ motion, aiWinner: judge.winner, crowdWinner: crowd?.winner })}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-2 rounded-lg hover:bg-black"
          >
            <Download size={16} /> Download result card
          </button>
        </div>
      </div>
    </div>
  );
}
