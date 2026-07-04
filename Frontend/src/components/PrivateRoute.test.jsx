import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';

let authState;
vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

const renderAt = (initial = '/private') =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/private"
          element={
            <PrivateRoute>
              <div>Secret Content</div>
            </PrivateRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('PrivateRoute', () => {
  it('shows a spinner while auth is loading', () => {
    authState = { loading: true, isLoggedIn: false };
    renderAt();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    authState = { loading: false, isLoggedIn: false };
    renderAt();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    authState = { loading: false, isLoggedIn: true };
    renderAt();
    expect(screen.getByText('Secret Content')).toBeInTheDocument();
  });
});
