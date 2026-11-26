import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PushOnboardingPrompt } from './components/layout/PushOnboardingPrompt';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { CommandPalette } from './components/layout/CommandPalette';
import { EnterpriseGmailModal } from './components/common/EnterpriseGmailModal';
import { FirstLoginChangePasswordModal } from './modules/auth/FirstLoginChangePasswordModal';
import { LoginPage } from './modules/auth/LoginPage';
import { AppRoutes } from './routes/AppRoutes';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ThemeProvider } from './theme/ThemeContext';

function MainLayout() {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-canvas text-ink font-sans">
      {/* 1. Dynamic Modular Sidebar (Responsive with Mobile Slide-over Drawer) */}
      <Sidebar
        isOpenMobile={isMobileDrawerOpen}
        onCloseMobile={() => setIsMobileDrawerOpen(false)}
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <Header
          onOpenCommandPalette={() => setIsCommandOpen(true)}
          onOpenGmailModal={() => setIsGmailModalOpen(true)}
          onLogout={handleLogout}
          onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
        />

        {/* Dynamic Route View with responsive mobile-safe padding */}
        <div className="p-3 sm:p-5 md:p-6 pb-24 lg:pb-8 max-w-7xl mx-auto">
          <ErrorBoundary key={location.pathname}>
            <AppRoutes />
          </ErrorBoundary>
        </div>
      </main>

      {/* 3. Mobile Bottom Navigation Bar (Hidden on desktop, visible on mobile) */}
      <MobileBottomNav onOpenDrawer={() => setIsMobileDrawerOpen(true)} />

      {/* 4. Global Command Palette (Ctrl+K) */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />

      {/* 5. Global Enterprise Gmail / SMTP Setup Modal */}
      <EnterpriseGmailModal isOpen={isGmailModalOpen} onClose={() => setIsGmailModalOpen(false)} />

      {/* 6. Lời mời bật Web Push cho lần đăng nhập đầu trên thiết bị (S36) */}
      <PushOnboardingPrompt />

      {/* 7. Forced First-Login Change Password Modal */}
      <FirstLoginChangePasswordModal
        isOpen={Boolean(user?.mustChangePassword)}
        onSuccess={() => {
          if (user?.faceEnrolled === false) {
            navigate('/auth/enroll-face');
          }
        }}
        canDismiss={true}
      />
    </div>
  );
}

function RootApp() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated && location.pathname !== '/login') {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<MainLayout />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <RootApp />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
