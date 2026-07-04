import React, { createContext, useContext, useEffect, useState } from 'react';
import userService from '../services/userService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const checkLogin = async () => {
      try {
        const currentUser = await userService.getCurrentUser();
        if (active) setUser(currentUser);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    checkLogin();
    return () => { active = false; };
  }, []);

  const login = (loggedInUser) => setUser(loggedInUser);

  const logout = async () => {
    try {
      await userService.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
