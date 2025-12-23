
import React, { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { Loader2 } from 'lucide-react';
import { UserRole } from './types.ts';

// Lazy loaded pages
const Layout = lazy(() => import('./components/Layout.tsx'));
const Login = lazy(() => import('./pages/Login.tsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const Announcements = lazy(() => import('./pages/Announcements.tsx'));
const Exams = lazy(() => import('./pages/Exams.tsx'));
const Schedule = lazy(() => import('./pages/Schedule.tsx'));
const Meet = lazy(() => import('./pages/Meet.tsx'));
const Polls = lazy(() => import('./pages/Polls.tsx'));
const AdminPanel = lazy(() => import('./pages/AdminPanel.tsx'));
const Profile = lazy(() => import('./pages/Profile.tsx'));

// Utility to scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-gray-50/50 dark:bg-gray-900/50">
    <Loader2 className="animate-spin text-primary-500 mb-4" size={40} />
    <p className="text-sm font-bold text-gray-500 animate-pulse">Chargement de UniConnect...</p>
  </div>
);

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== UserRole.ADMIN) return <Navigate to="/" replace />;
  return <>{children}</>;
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
        
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="exams" element={<Exams />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="meet" element={<Meet />} />
          <Route path="polls" element={<Polls />} />
          <Route path="profile" element={<Profile />} />
          <Route 
            path="admin" 
            element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            } 
          />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </HashRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}
