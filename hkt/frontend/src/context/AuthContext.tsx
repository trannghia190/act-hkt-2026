import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, AuthUser } from '../types/auth.types';

export type { UserRole, AuthUser };

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'pulse_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load user from localStorage', e);
    }
    // Chưa có phiên → bắt buộc đăng nhập thật (không auto-login admin không token).
    return null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const updateUser = (partial: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    // Đăng nhập thật qua API — không dùng tài khoản preset thiếu token.
    // Try API login
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeCodeOrEmail: username.trim(), password }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data?.accessToken && json.data?.employeeCode) {
          const authData = json.data;
          const matchedUser: AuthUser = {
            employeeCode: authData.employeeCode,
            fullName: authData.fullName,
            email: username.includes('@') ? username : `${username.toLowerCase()}@act-corp.internal`,
            role: authData.role as UserRole,
            accessToken: authData.accessToken,
            refreshToken: authData.refreshToken,
            faceEnrolled: authData.faceEnrolled ?? true,
            mustChangePassword: authData.mustChangePassword ?? false,
            status: authData.status || 'ACTIVE',
          };
          setUser(matchedUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(matchedUser));
          return true;
        }
      }
    } catch (err) {
      console.warn('API login failed, falling back to local credentials', err);
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
