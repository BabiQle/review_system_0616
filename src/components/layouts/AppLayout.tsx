import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { pb } from '@/db/pb';
import {
  Menu,
  Users,
  ClipboardList,
  BarChart2,
  LogOut,
  ChevronDown,
  Star,
  Eye,
  Calendar,
  Lock,
} from 'lucide-react';
import { ROLE_LABELS } from '@/types/types';
import type { UserRole } from '@/types/types';

const APP_NAME = "团队互评平台";
const APP_VERSION = "v1.1 on 2026.6.16"; // 版本号

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/review',
    label: '填写评价',
    icon: <ClipboardList className="w-4 h-4 text-cyan-500" />,
    roles: ['admin', 'reviewer'],
  },
  {
    path: '/my-reviews',
    label: '我的评价',
    icon: <Eye className="w-4 h-4 text-cyan-500" />,
    roles: ['admin', 'reviewer', 'reviewee_only'],
  },
  {
    path: '/my-stats',
    label: '我的统计',
    icon: <BarChart2 className="w-4 h-4 text-cyan-500" />,
    roles: ['admin', 'reviewer', 'reviewee_only'],
  },
  {
    path: '/stats',
    label: '评价统计',
    icon: <BarChart2 className="w-4 h-4 text-orange-500" />,
    roles: ['admin', 'reviewer'],
  },
  {
    path: '/admin/users',
    label: '用户管理',
    icon: <Users className="w-4 h-4 text-orange-500" />,
    roles: ['admin'],
  },
  {
    path: '/admin/cycles',
    label: '评价周期',
    icon: <Calendar className="w-4 h-4 text-orange-500" />,
    roles: ['admin'],
  },
];

function NavItems({ role, onClose }: { role: UserRole; onClose?: () => void }) {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));
  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded transition-colors min-h-[44px] ${
              isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`
          }
        >
          {item.icon}
          <span className="text-base">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

// 修改密码对话框
function ChangePasswordDialog({
  open,
  onOpenChange,
  defaultUsername,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultUsername?: string;
}) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const username = defaultUsername || '';

  const resetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      toast.error('无法获取当前用户名，请重新登录');
      return;
    }
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error('请填写所有密码字段');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('新密码长度不能少于8位字符');
      return;
    }
    if (newPassword === oldPassword) {
      toast.error('新密码不能与当前密码相同');
      return;
    }

    setLoading(true);
    try {
      const authData = await pb.collection('users').authWithPassword(username.trim(), oldPassword);
      const userId = authData.record.id;
      await pb.collection('users').update(userId, {
        oldPassword: oldPassword,
        password: newPassword,
        passwordConfirm: confirmPassword,
      });
      await pb.collection('users').authWithPassword(username.trim(), newPassword);
      toast.success('密码修改成功，页面将刷新！');
      handleClose();
      window.location.reload();
    } catch (err: any) {
      console.error('修改密码失败:', err);
      const errorData = err?.response?.data;
      if (errorData?.oldPassword) {
        toast.error('原密码输入错误');
      } else if (errorData?.password) {
        toast.error('新密码不符合规则，请设置至少8位字符');
      } else if (err.message.includes('Failed to authenticate')) {
        toast.error('用户名或原密码错误');
      } else {
        toast.error(`修改密码失败：${err.message || '请重试'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>修改登录密码</DialogTitle>
          <DialogDescription>
            请输入当前密码，并设置新的登录密码（至少8位）
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="oldPwd" className="text-right select-none cursor-default">原密码</Label>
            <Input
              id="oldPwd"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="col-span-3"
              placeholder="请输入当前密码"
              disabled={loading}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newPwd" className="text-right select-none cursor-default">新密码</Label>
            <Input
              id="newPwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="col-span-3"
              placeholder="请输入新密码（至少8位）"
              disabled={loading}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="confirmPwd" className="text-right select-none cursor-default">确认密码</Label>
            <Input
              id="confirmPwd"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="col-span-3"
              placeholder="请再次输入新密码"
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>取消</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? '提交中...' : '确认修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SidebarContentProps {
  role: UserRole;
  displayName: string;
  onClose: () => void;
  onSignOut: () => void;
  onOpenPwdDialog: () => void;
}

function SidebarContent({ role, displayName, onClose, onSignOut, onOpenPwdDialog }: SidebarContentProps) {
  const initial = (displayName || '?')[0].toUpperCase();
  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* 品牌区域 */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border select-none cursor-default">
        <div className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center shrink-0">
          <Star className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight text-white">{APP_NAME}</p>
          <p className="text-xs text-white/60 tracking-tight mt-0.5">版本 {APP_VERSION}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <NavItems role={role} onClose={onClose} />
      </div>

      <div className="border-t border-sidebar-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground px-2"
            >
              <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground shrink-0">
                {initial}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-base font-medium truncate text-sidebar-foreground">{displayName}</p>
              </div>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{displayName}</p>
              <Badge variant="secondary" className="text-xs mt-1">{ROLE_LABELS[role]}</Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenPwdDialog}>
              <Lock className="w-4 h-4 mr-2" />
              修改密码
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);

  const role = (profile?.role ?? 'reviewee_only') as UserRole;
  const displayName = profile?.display_name || profile?.username || '';
  const username = profile?.username || '';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleCloseMobile = () => setMobileOpen(false);
  const handleOpenPwdDialog = () => setPwdDialogOpen(true);

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border fixed top-0 left-0 h-screen z-30">
        <SidebarContent
          role={role}
          displayName={displayName}
          onClose={handleCloseMobile}
          onSignOut={handleSignOut}
          onOpenPwdDialog={handleOpenPwdDialog}
        />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col md:ml-56">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-40">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-56 bg-sidebar">
              <SidebarContent
                role={role}
                displayName={displayName}
                onClose={handleCloseMobile}
                onSignOut={handleSignOut}
                onOpenPwdDialog={handleOpenPwdDialog}
              />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 flex-1 min-w-0 select-none cursor-default">
            <Star className="w-4 h-4 text-primary shrink-0" />
            <span className="text-base font-semibold truncate text-slate-800 dark:text-slate-200">{APP_NAME}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      <ChangePasswordDialog
        open={pwdDialogOpen}
        onOpenChange={setPwdDialogOpen}
        defaultUsername={username}
      />
    </div>
  );
}