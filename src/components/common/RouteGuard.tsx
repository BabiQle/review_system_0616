import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
}

const PUBLIC_ROUTES = ['/login'];

export function RouteGuard({ children }: RouteGuardProps) {
  const { profile, loading } = useAuth();  // 改为 profile
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_ROUTES.includes(location.pathname);
    if (!profile && !isPublic) {
      navigate('/login', { state: { from: location.pathname }, replace: true });
    }
    if (profile && location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [profile, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}