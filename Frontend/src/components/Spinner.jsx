import React from 'react';

export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-600">
      <div
        className="h-10 w-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"
        role="status"
        aria-label={label}
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
