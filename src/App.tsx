import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import PageLoader from '@/components/common/PageLoader';

// 懒加载组件
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const AppLayout = lazy(() => import('@/components/layouts/AppLayout'));
const ReviewPage = lazy(() => import('@/pages/ReviewPage'));
const MyReviewsPage = lazy(() => import('@/pages/MyReviewsPage'));
const MyStatsPage = lazy(() => import('@/pages/MyStatsPage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage'));
const CycleManagementPage = lazy(() => import('@/pages/admin/CycleManagementPage'));

function DefaultRedirect() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'reviewee_only';
  const to = role === 'reviewer' || role === 'admin' ? '/review' : '/my-reviews';
  return <Navigate to={to} replace />;
}

function AppContent() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DefaultRedirect />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="my-reviews" element={<MyReviewsPage />} />
          <Route path="my-stats" element={<MyStatsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="admin/users" element={<UserManagementPage />} />
          <Route path="admin/cycles" element={<CycleManagementPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </Suspense>
  );
}

const App: React.FC = () => {
  return (
    <Router>
      <RouteGuard>
        <AppContent />
      </RouteGuard>
    </Router>
  );
};

export default App;