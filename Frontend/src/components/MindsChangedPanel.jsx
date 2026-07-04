import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import SwingMeter from './SwingMeter';
import voteService from '../services/voteService';

// Sidebar panel: cast a pre-vote and post-vote, and watch the room's swing live.
// `liveUpdate` is the latest { summary, verdict } pushed over the socket (or null).
export default function MindsChangedPanel({ debateId, debateStatus, liveUpdate }) {
  const [data, setData] = useState(null); // { summary, verdict, myVote }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    voteService
      .getSummary(debateId)
      .then((d) => active && setData(d))
      .catch(() => active && setData(null));
    return () => { active = false; };
  }, [debateId]);

  // Merge live socket updates into local state (keep myVote from our own record).
  useEffect(() => {
    if (liveUpdate) {
      setData((prev) => ({ ...(prev || { myVote: { pre: null, post: null } }), ...liveUpdate }));
    }
  }, [liveUpdate]);

  const vote = async (phase, stance) => {
    setBusy(true);
    try {
      const res = await voteService.castVote(debateId, phase, stance);
      setData((prev) => ({
        ...prev,
        ...res,
        myVote: { ...(prev?.myVote || {}), [phase]: stance },
      }));
      toast.success(`Your ${phase === 'pre' ? 'starting' : 'final'} vote is in.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record your vote.');
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <div className="p-4 text-sm text-gray-400">Loading verdict…</div>;
  }

  const postAllowed = debateStatus !== 'scheduled';

  const VoteRow = ({ phase, label, hint, disabled }) => {
    const mine = data.myVote?.[phase];
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-600">{label}</p>
        <p className="text-[11px] text-gray-400">{hint}</p>
        <div className="flex gap-2">
          <button
            onClick={() => vote(phase, 'in_favor')}
            disabled={busy || disabled}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium border transition disabled:opacity-40 ${
              mine === 'in_favor'
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            For
          </button>
          <button
            onClick={() => vote(phase, 'against')}
            disabled={busy || disabled}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium border transition disabled:opacity-40 ${
              mine === 'against'
                ? 'bg-rose-500 text-white border-rose-500'
                : 'border-rose-300 text-rose-700 hover:bg-rose-50'
            }`}
          >
            Against
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border bg-white p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Minds Changed</h3>
        <p className="text-[11px] text-gray-400">The winner is whoever moves more of the room.</p>
      </div>

      <SwingMeter summary={data.summary} verdict={data.verdict} />

      <div className="space-y-3 border-t pt-3">
        <VoteRow phase="pre" label="Where do you stand now?" hint="Your position before the arguments." />
        <VoteRow
          phase="post"
          label="Where do you stand after?"
          hint={postAllowed ? 'Your final position once you’ve heard both sides.' : 'Opens once the debate starts.'}
          disabled={!postAllowed}
        />
      </div>
    </div>
  );
}
