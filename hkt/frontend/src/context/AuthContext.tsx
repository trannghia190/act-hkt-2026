import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, AuthUser } from '../types/auth.types';

export type { UserRole, AuthUser };

export const PRESET_USERS: Record<string, AuthUser> = {
  admin: {
    employeeCode: 'Admin',
    fullName: 'Quản Trị Viên Hệ Thống (Admin)',
    email: 'admin@act-corp.internal',
    role: 'ADMIN',
    department: 'Ban Quản Trị Hệ Thống',
    team: 'Executive Board',
    faceEnrolled: true,
    mustChangePassword: false,
    status: 'ACTIVE',
  },
  hr: {
    employeeCode: '01HR',
    fullName: 'Nguyễn Thị Thu Hà (HR Lead)',
    email: 'ha.nguyen@act-corp.internal',
    role: 'HR_ADMIN',
    department: 'Phòng Nhân Sự',
    team: 'HR Operations',
    faceEnrolled: true,
    mustChangePassword: false,
    status: 'ACTIVE',
  },
  manager: {
    employeeCode: '05ACT',
    fullName: 'Nguyễn Thanh Tùng (Manager)',
    email: 'tung.nguyen@act-corp.internal',
    role: 'MANAGER',
    department: 'Khối Kỹ Thuật & Phát Triển',
    team: 'Sirius Core',
    faceEnrolled: true,
    mustChangePassword: false,
    status: 'ACTIVE',
  },
  employee: {
    employeeCode: '136ACT',
    fullName: 'Vũ Văn Luận (Developer)',
    email: 'luan.vu@act-corp.internal',
    role: 'EMPLOYEE',
    department: 'Khối Kỹ Thuật & Phát Triển',
    team: 'Optimus AI',
    faceEnrolled: true,
    mustChangePassword: false,
    status: 'ACTIVE',
  },
  newEmployee: {
    employeeCode: '2026NEW',
    fullName: 'Trần Nhân Viên Mới (Onboarding Demo)',
    email: 'newbie@act-corp.internal',
    role: 'EMPLOYEE',
    department: 'Khối Kỹ Thuật & Phát Triển',
    team: 'Optimus AI',
    faceEnrolled: false,
    mustChangePassword: true,
    status: 'PENDING_ACTIVATION',
  },
};

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  loginAsPreset: (presetKey: keyof typeof PRESET_USERS) => void;
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
    // Default to Admin account for immediate access
    return PRESET_USERS.admin;
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
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check Admin account
    if (cleanUser === 'admin' && cleanPass === 'Admin') {
      setUser(PRESET_USERS.admin);
      return true;
    }

    // Try API login
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeCodeOrEmail: username, password }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          const authData = json.data;
          const matchedUser: AuthUser = {
            employeeCode: authData.employeeCode,
            fullName: authData.fullName,
            email: username.includes('@') ? username : `${username.toLowerCase()}@act-corp.internal`,
            role: authData.role as UserRole,
            accessToken: authData.accessToken,
            faceEnrolled: authData.faceEnrolled ?? true,
            mustChangePassword: authData.mustChangePassword ?? false,
            status: authData.status || 'ACTIVE',
          };
          setUser(matchedUser);
          return true;
        }
      }
    } catch (err) {
      console.warn('API login failed, falling back to local credentials', err);
    }

    // Local fallback matches
    for (const preset of Object.values(PRESET_USERS)) {
      if (
        (preset.employeeCode.toLowerCase() === cleanUser || preset.email.toLowerCase() === cleanUser) &&
        (cleanPass === 'Admin' || cleanPass === 'admin')
      ) {
        setUser(preset);
        return true;
      }
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const switchRole = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        setUser(PRESET_USERS.admin);
        break;
      case 'HR_ADMIN':
        setUser(PRESET_USERS.hr);
        break;
      case 'MANAGER':
        setUser(PRESET_USERS.manager);
        break;
      case 'EMPLOYEE':
        setUser(PRESET_USERS.employee);
        break;
    }
  };

  const loginAsPreset = (presetKey: keyof typeof PRESET_USERS) => {
    setUser(PRESET_USERS[presetKey]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        switchRole,
        loginAsPreset,
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
