import React from 'react';

// Visualizes how the room's support split shifted. `summary` is
// { pre: {in_favor, against}, post: {in_favor, against} }.
function Bar({ label, data }) {
  const total = data.in_favor + data.against;
  const forPct = total ? Math.round((data.in_favor / total) * 100) : 50;
  const againstPct = 100 - forPct;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-medium text-gray-500">
        <span>{label}</span>
        <span>{total} vote{total === 1 ? '' : 's'}</span>
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="bg-emerald-500 transition-all duration-700 ease-out"
          style={{ width: `${forPct}%` }}
          title={`For ${forPct}%`}
        />
        <div
          className="bg-rose-500 transition-all duration-700 ease-out"
          style={{ width: `${againstPct}%` }}
          title={`Against ${againstPct}%`}
        />
      </div>
      <div className="flex justify-between text-[11px]">
        <span className="text-emerald-600">{forPct}% For</span>
        <span className="text-rose-600">{againstPct}% Against</span>
      </div>
    </div>
  );
}

export default function SwingMeter({ summary, verdict }) {
  return (
    <div className="space-y-3">
      <Bar label="Before the debate" data={summary.pre} />
      <Bar label="After the debate" data={summary.post} />
      {verdict && (summary.post.in_favor + summary.post.against) > 0 && (
        <p className="text-center text-xs font-semibold text-gray-700">
          {verdict.winner === 'in_favor'
            ? `The motion won the room over (+${verdict.swingFor} For).`
            : verdict.winner === 'against'
              ? `The opposition won the room over (+${verdict.swingAgainst} Against).`
              : 'The room held its ground — no clear swing yet.'}
        </p>
      )}
    </div>
  );
}
