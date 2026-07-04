import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';

import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Spinner from './components/Spinner';

// Route-level code splitting — each page is its own chunk
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ActiveDiscussion = lazy(() => import('./pages/ActiveDiscussion'));
const FutureEvents = lazy(() => import('./pages/FutureEvents'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DiscussionPage = lazy(() => import('./pages/DiscussionPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

const App = () => {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Toaster position="top-right" richColors />
        <Suspense fallback={<Spinner />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Routes */}
            <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
            <Route path="/active" element={<PrivateRoute><ActiveDiscussion /></PrivateRoute>} />
            <Route path="/upcoming" element={<PrivateRoute><FutureEvents /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/discuss" element={<PrivateRoute><DiscussionPage /></PrivateRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </LanguageProvider>
    </AuthProvider>
  );
};

export default App;
