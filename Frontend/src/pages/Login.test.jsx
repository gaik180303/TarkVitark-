import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

const mockNavigate = vi.fn();
const mockLogin = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('../services/userService', () => ({
  default: { login: vi.fn() },
}));

import userService from '../services/userService';

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

describe('Login page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows an inline error when login fails', async () => {
    userService.login.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials' } },
    });

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/enter your email/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid credentials');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates home and sets auth on successful login', async () => {
    userService.login.mockResolvedValueOnce({ _id: '1', username: 'alice' });

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/enter your email/i), {
      target: { value: 'alice@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ _id: '1', username: 'alice' }));
    expect(mockNavigate).toHaveBeenCalledWith('/home');
  });
});
