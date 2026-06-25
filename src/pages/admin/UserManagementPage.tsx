import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { pb } from '@/db/pb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Users, Shield, User, Eye, Plus, Trash2, Edit, Upload, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import * as XLSX from 'xlsx';
import type { Profile } from '@/types/types';
import { motion, AnimatePresence } from 'framer-motion';

// ===== 类型 =====
type UserRole = 'admin' | 'reviewer' | 'reviewee_only';

interface AddUserFormData {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  display_name: string;
  role: UserRole;
}

interface EditUserFormData {
  display_name: string;
  role: UserRole;
}

interface ImportUserData {
  username: string;
  display_name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  role: UserRole;
}

// ===== 常量 =====
const ROLE_CONFIG: Record<UserRole, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: '超级管理员', icon: Shield, color: 'bg-red-100 text-red-700 border-red-200' },
  reviewer: { label: '管理员', icon: User, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  reviewee_only: { label: '组员', icon: Eye, color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

// ===== 子组件 =====

// 统计卡片
const StatCard = memo(function StatCard({
  title,
  value,
  icon: Icon,
  colorClass = 'text-slate-400',
}: {
  title: string;
  value: number;
  icon: any;
  colorClass?: string;
}) {
  return (
    <Card className="border border-slate-200 shadow-sm bg-white">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <Icon className={`h-8 w-8 ${colorClass}`} />
      </CardContent>
    </Card>
  );
});

// 角色徽章（memo 避免重复渲染）
const RoleBadge = memo(function RoleBadge({ role }: { role: UserRole }) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className={`${config.color} gap-1 px-2 py-0.5 text-xs font-normal flex-shrink-0`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
});

// 用户列表项（同时支持桌面和移动端布局，用 css 切换）
const UserListItem = memo(function UserListItem({
  user,
  index,
  onEdit,
  onDelete,
}: {
  user: Profile;
  index: number;
  onEdit: (user: Profile) => void;
  onDelete: (userId: string, displayName: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.03 }}
      className="px-4 py-3 hover:bg-slate-50 transition-colors"
    >
      {/* 桌面版布局 */}
      <div className="hidden md:grid grid-cols-[40px_48px_1fr_100px_80px] items-center gap-3">
        <div className="text-sm text-slate-500 text-center">{index + 1}</div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
          {user.display_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate">{user.display_name}</p>
          <p className="text-xs text-slate-500 truncate">@{user.username}</p>
        </div>
        <div className="flex justify-start">
          <RoleBadge role={user.role as UserRole} />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => onEdit(user)} className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50">
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(user.id, user.display_name)} className="h-8 w-8 p-0 text-slate-600 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 移动端卡片布局 */}
      <div className="md:hidden bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-slate-900">{user.display_name}</div>
              <div className="text-xs text-slate-500">@{user.username}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(user)} className="h-8 w-8 p-0 text-slate-600">
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(user.id, user.display_name)} className="h-8 w-8 p-0 text-slate-600">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <RoleBadge role={user.role as UserRole} />
          <span className="text-xs text-slate-400">#{index + 1}</span>
        </div>
      </div>
    </motion.div>
  );
});

// ===== 主组件 =====
export default function UserManagementPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [importData, setImportData] = useState<ImportUserData[]>([]);
  const [importing, setImporting] = useState(false);

  // 新增用户表单
  const [addFormData, setAddFormData] = useState<AddUserFormData>({
    username: '', email: '', password: '', passwordConfirm: '', display_name: '', role: 'reviewee_only',
  });

  // 编辑用户表单
  const [editFormData, setEditFormData] = useState<EditUserFormData>({
    display_name: '', role: 'reviewee_only',
  });

  // 加载用户列表（稳定引用，只挂载时调用）
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await pb.collection('users').getList<Record<string, any>>(1, 200, { sort: 'display_name' });
      setUsers(result.items.map((r: any) => ({
        id: r.id,
        username: r.username ?? '',
        display_name: r.display_name || r.username || r.email || '',
        role: (r.role === 'admin' || r.role === 'reviewer' || r.role === 'reviewee_only' ? r.role : 'reviewee_only') as UserRole,
        created_at: r.created ?? '',
      })));
    } catch {
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 过滤用户
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u => u.display_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  }, [users, searchQuery]);

  // 统计数据
  const stats = useMemo(() => ({
    total: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    reviewer: users.filter(u => u.role === 'reviewer').length,
    reviewee: users.filter(u => u.role === 'reviewee_only').length,
  }), [users]);

  // 重置表单
  const resetAddForm = useCallback(() => {
    setAddFormData({ username: '', email: '', password: '', passwordConfirm: '', display_name: '', role: 'reviewee_only' });
  }, []);

  const resetEditForm = useCallback(() => {
    setEditFormData({ display_name: '', role: 'reviewee_only' });
  }, []);

  // 新增用户
  const handleAddUser = useCallback(async () => {
    if (!addFormData.username || !addFormData.email || !addFormData.password) {
      toast.error('请填写所有必填项'); return;
    }
    if (addFormData.password !== addFormData.passwordConfirm) {
      toast.error('两次输入的密码不一致'); return;
    }
    if (addFormData.password.length < 6) {
      toast.error('密码长度不能少于6位'); return;
    }
    try {
      await pb.collection('users').create({
        username: addFormData.username,
        email: addFormData.email,
        password: addFormData.password,
        passwordConfirm: addFormData.passwordConfirm,
        display_name: addFormData.display_name || addFormData.username,
        role: addFormData.role,
      });
      toast.success('用户添加成功');
      setIsAddDialogOpen(false);
      resetAddForm();
      loadUsers();
    } catch (err: any) {
      toast.error(`添加用户失败: ${err.message || '请重试'}`);
    }
  }, [addFormData, resetAddForm, loadUsers]);

  // 打开编辑对话框
  const openEditDialog = useCallback((user: Profile) => {
    setEditingUser(user);
    setEditFormData({ display_name: user.display_name, role: user.role as UserRole });
    setIsEditDialogOpen(true);
  }, []);

  // 更新用户（乐观更新）
  const handleUpdateUser = useCallback(async () => {
    if (!editingUser) return;
    try {
      await pb.collection('users').update(editingUser.id, {
        display_name: editFormData.display_name,
        role: editFormData.role,
      });
      setUsers(prev => prev.map(u =>
        u.id === editingUser.id
          ? { ...u, display_name: editFormData.display_name, role: editFormData.role }
          : u
      ));
      toast.success('用户更新成功');
      setIsEditDialogOpen(false);
      setEditingUser(null);
      resetEditForm();
    } catch (err: any) {
      toast.error(`更新用户失败: ${err.message || '请重试'}`);
    }
  }, [editingUser, editFormData, resetEditForm]);

  // 删除用户（乐观删除）
  const handleDeleteUser = useCallback(async (userId: string, displayName: string) => {
    if (!confirm(`确定要删除用户“${displayName}”吗？此操作不可恢复！`)) return;
    try {
      await pb.collection('users').delete(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('用户删除成功');
    } catch {
      toast.error('删除用户失败');
    }
  }, []);

  // 文件解析
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
        const parsedUsers: ImportUserData[] = [];
        const errors: string[] = [];
        jsonData.forEach((row: any, index: number) => {
          if (!row['用户名'] && !row['显示名称'] && !row['邮箱']) return;
          if (!row['用户名'] || !row['邮箱'] || !row['密码']) {
            errors.push(`第${index + 2}行：缺少必填字段`); return;
          }
          if (row['密码'] !== row['确认密码']) {
            errors.push(`第${index + 2}行：两次输入的密码不一致`); return;
          }
          if (row['密码'].length < 6) {
            errors.push(`第${index + 2}行：密码长度不能少于6位`); return;
          }
          let role: UserRole = 'reviewee_only';
          if (row['角色'] === 1 || row['角色'] === '1') role = 'admin';
          else if (row['角色'] === 2 || row['角色'] === '2') role = 'reviewer';
          parsedUsers.push({
            username: row['用户名'],
            display_name: row['显示名称'] || row['用户名'],
            email: row['邮箱'],
            password: row['密码'],
            passwordConfirm: row['确认密码'],
            role,
          });
        });
        if (errors.length > 0) {
          toast.error(`数据验证失败：\n${errors.join('\n')}`); return;
        }
        if (parsedUsers.length === 0) {
          toast.error('Excel文件中没有有效数据'); return;
        }
        setImportData(parsedUsers);
        toast.success(`成功解析 ${parsedUsers.length} 条用户数据`);
      } catch {
        toast.error('解析Excel文件失败，请检查文件格式');
      }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
  }, []);

  // 导入用户
  const handleImportUsers = useCallback(async () => {
    if (importData.length === 0) return;
    setImporting(true);
    let successCount = 0, failCount = 0;
    for (const user of importData) {
      try {
        await pb.collection('users').create({
          username: user.username,
          email: user.email,
          password: user.password,
          passwordConfirm: user.passwordConfirm,
          display_name: user.display_name,
          role: user.role,
        });
        successCount++;
      } catch { failCount++; }
    }
    toast.success(`导入完成！成功 ${successCount} 个，失败 ${failCount} 个`);
    setIsImportDialogOpen(false);
    setImportData([]);
    loadUsers();
    setImporting(false);
  }, [importData, loadUsers]);

  // 下载模板
  const downloadTemplate = useCallback(() => {
    const template = [
      { '用户名': 'zhang.san', '显示名称': '张三', '邮箱': 'zhang.san@example.com', '密码': '123456', '确认密码': '123456', '角色': 1 },
      { '用户名': 'li.si', '显示名称': '李四', '邮箱': 'li.si@example.com', '密码': '123456', '确认密码': '123456', '角色': 2 },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '用户模板');
    XLSX.writeFile(wb, '用户导入模板.xlsx');
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">仅超级管理员可访问此页面</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden select-none">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                用户管理
                <Badge variant="outline" className="text-xs font-normal text-slate-500 border-slate-300 bg-slate-50">
                  超级管理员
                </Badge>
              </h1>
              <p className="text-xs text-slate-500">管理系统用户账户、角色和权限</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 导入用户对话框 */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 h-9 text-sm border-slate-300">
                  <Upload className="h-4 w-4" /> 导入用户
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">导入用户</DialogTitle>
                  <DialogDescription className="flex items-center gap-1 flex-wrap">
                    从Excel文件批量导入用户。
                    <Button variant="link" onClick={downloadTemplate} className="p-0 h-auto text-blue-600">下载模板</Button>
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>选择Excel文件</Label>
                    <Input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="border-slate-300" />
                    <p className="text-xs text-slate-500">格式：用户名、显示名称、邮箱、密码、确认密码、角色（1=超级管理员，2=管理员，其他=组员）</p>
                  </div>
                  {importData.length > 0 && (
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <h3 className="font-medium mb-2 text-sm text-slate-700">预览数据（{importData.length}条）</h3>
                      <div className="max-h-48 overflow-auto border border-slate-200 rounded bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 sticky top-0"><tr><th>用户名</th><th>显示名称</th><th>角色</th></tr></thead>
                          <tbody>
                            {importData.slice(0, 5).map((user, idx) => (
                              <tr key={idx}><td>{user.username}</td><td>{user.display_name}</td><td><RoleBadge role={user.role} /></td></tr>
                            ))}
                            {importData.length > 5 && <tr><td colSpan={3}>... 还有 {importData.length - 5} 条</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsImportDialogOpen(false); setImportData([]); }}>取消</Button>
                  <Button onClick={handleImportUsers} disabled={importData.length === 0 || importing} className="bg-blue-600 hover:bg-blue-700">
                    {importing ? '导入中...' : '开始导入'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 新增用户对话框 */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 h-9 text-sm shadow-md">
                  <Plus className="h-4 w-4" /> 新增用户
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">添加新用户</DialogTitle>
                  <DialogDescription>填写以下信息以创建新用户账户</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* 表单内容不变，省略... */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>用户名 *</Label><Input value={addFormData.username} onChange={e => setAddFormData({ ...addFormData, username: e.target.value })} placeholder="zhang.san" className="border-slate-300" /></div>
                    <div className="space-y-2"><Label>显示名称</Label><Input value={addFormData.display_name} onChange={e => setAddFormData({ ...addFormData, display_name: e.target.value })} placeholder="张三" className="border-slate-300" /></div>
                  </div>
                  <div className="space-y-2"><Label>邮箱 *</Label><Input type="email" value={addFormData.email} onChange={e => setAddFormData({ ...addFormData, email: e.target.value })} placeholder="zhang.san@example.com" className="border-slate-300" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>密码 *</Label><Input type="password" value={addFormData.password} onChange={e => setAddFormData({ ...addFormData, password: e.target.value })} placeholder="至少6位" className="border-slate-300" /></div>
                    <div className="space-y-2"><Label>确认密码 *</Label><Input type="password" value={addFormData.passwordConfirm} onChange={e => setAddFormData({ ...addFormData, passwordConfirm: e.target.value })} placeholder="再次输入" className="border-slate-300" /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>角色</Label>
                    <Select value={addFormData.role} onValueChange={(value: UserRole) => setAddFormData({ ...addFormData, role: value })}>
                      <SelectTrigger className="border-slate-300"><SelectValue placeholder="选择角色" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">超级管理员</SelectItem>
                        <SelectItem value="reviewer">管理员</SelectItem>
                        <SelectItem value="reviewee_only">组员</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>取消</Button>
                  <Button onClick={handleAddUser} className="bg-blue-600 hover:bg-blue-700">添加用户</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 统计卡片 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="总用户" value={stats.total} icon={Users} />
          <StatCard title="超级管理员" value={stats.admin} icon={Shield} colorClass="text-red-500" />
          <StatCard title="管理员" value={stats.reviewer} icon={User} colorClass="text-blue-500" />
          <StatCard title="组员" value={stats.reviewee} icon={Eye} colorClass="text-slate-500" />
        </motion.div>

        {/* 用户列表 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900">用户列表</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="搜索姓名或用户名..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 w-64 text-sm border-slate-300"
                    />
                  </div>
                  <Badge variant="secondary" className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700">
                    共 {filteredUsers.length} 人
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-slate-500 py-16">
                  <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>{searchQuery ? '没有找到匹配的用户' : '暂无用户数据'}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <AnimatePresence>
                    {filteredUsers.map((user, index) => (
                      <UserListItem
                        key={user.id}
                        user={user}
                        index={index}
                        onEdit={openEditDialog}
                        onDelete={handleDeleteUser}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* 编辑用户对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">编辑用户信息</DialogTitle>
            <DialogDescription>修改用户的基本信息和权限</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>用户名</Label><Input value={editingUser?.username || ''} disabled className="bg-slate-50 border-slate-200" /></div>
              <div className="space-y-2"><Label>显示名称</Label><Input value={editFormData.display_name} onChange={e => setEditFormData({ ...editFormData, display_name: e.target.value })} className="border-slate-300" /></div>
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={editFormData.role} onValueChange={(value: UserRole) => setEditFormData({ ...editFormData, role: value })}>
                <SelectTrigger className="border-slate-300"><SelectValue placeholder="选择角色" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">超级管理员</SelectItem>
                  <SelectItem value="reviewer">管理员</SelectItem>
                  <SelectItem value="reviewee_only">组员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingUser(null); resetEditForm(); }}>取消</Button>
            <Button onClick={handleUpdateUser} className="bg-blue-600 hover:bg-blue-700">保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}