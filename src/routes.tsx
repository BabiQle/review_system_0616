import type { ReactNode } from 'react';
import LoginPage from './pages/LoginPage';
import AppLayout from './components/layouts/AppLayout';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

// 路由配置（实际路由在 App.tsx 中通过嵌套 Route 定义）
export const routes: RouteConfig[] = [
  {
    name: '登录',
    path: '/login',
    element: <LoginPage />,
    public: true,
  },
  {
    name: '主布局',
    path: '/',
    element: <AppLayout />,
    public: false,
  },
];
