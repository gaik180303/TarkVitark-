import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4 text-center">
      <p className="text-6xl font-bold text-blue-600">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="mt-2 text-gray-600">The page you're looking for doesn't exist or has moved.</p>
      <Link
        to="/"
        className="mt-6 inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
      >
        Back to home
      </Link>
    </div>
  );
}
