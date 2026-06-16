import { useState, useEffect, useMemo } from 'react';
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

type UserRole = 'admin' | 'reviewer' | 'reviewee_only';

// 新增用户表单数据
interface AddUserFormData {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  display_name: string;
  role: UserRole;
}

// 编辑用户表单数据（无密码）
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

const ROLE_CONFIG = {
  admin: { label: '超级管理员', icon: Shield, color: 'bg-red-100 text-red-700 border-red-200' },
  reviewer: { label: '管理员', icon: User, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  reviewee_only: { label: '组员', icon: Eye, color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

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

  // 新增用户表单独立状态
  const [addFormData, setAddFormData] = useState<AddUserFormData>({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    display_name: '',
    role: 'reviewee_only',
  });

  // 编辑用户表单独立状态（无密码）
  const [editFormData, setEditFormData] = useState<EditUserFormData>({
    display_name: '',
    role: 'reviewee_only',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await pb.collection('users').getList<Record<string, any>>(1, 200, {
        sort: 'display_name',
      });
      setUsers(
        result.items.map((r) => ({
          id: r.id,
          username: r.username ?? '',
          display_name: (r.display_name as string) || (r.username as string) || (r.email as string) || '',
          role: (r.role === 'admin' || r.role === 'reviewer' || r.role === 'reviewee_only')
            ? (r.role as UserRole)
            : 'reviewee_only',
          created_at: r.created ?? '',
        }))
      );
    } catch (err) {
      console.error('获取用户列表失败:', err);
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.display_name.toLowerCase().includes(q) ||
        user.username.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const stats = useMemo(() => ({
    total: users.length,
    admin: users.filter((u) => u.role === 'admin').length,
    reviewer: users.filter((u) => u.role === 'reviewer').length,
    reviewee: users.filter((u) => u.role === 'reviewee_only').length,
  }), [users]);

  const resetAddForm = () => {
    setAddFormData({
      username: '',
      email: '',
      password: '',
      passwordConfirm: '',
      display_name: '',
      role: 'reviewee_only',
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      display_name: '',
      role: 'reviewee_only',
    });
  };

  // 新增用户
  const handleAddUser = async () => {
    if (!addFormData.username || !addFormData.email || !addFormData.password) {
      toast.error('请填写所有必填项');
      return;
    }
    if (addFormData.password !== addFormData.passwordConfirm) {
      toast.error('两次输入的密码不一致');
      return;
    }
    if (addFormData.password.length < 6) {
      toast.error('密码长度不能少于6位');
      return;
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
  };

  // 打开编辑对话框
  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    setEditFormData({
      display_name: user.display_name,
      role: user.role,
    });
    setIsEditDialogOpen(true);
  };

  // 更新用户（无密码）- 乐观更新，不重新加载整个列表
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await pb.collection('users').update(editingUser.id, {
        display_name: editFormData.display_name,
        role: editFormData.role,
      });
      // 直接更新本地状态，避免重新加载导致滚动位置重置
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === editingUser.id
            ? { ...u, display_name: editFormData.display_name, role: editFormData.role }
            : u
        )
      );
      toast.success('用户更新成功');
      setIsEditDialogOpen(false);
      setEditingUser(null);
      resetEditForm();
      // 不再调用 loadUsers()
    } catch (err: any) {
      console.error('更新用户失败:', err);
      toast.error(`更新用户失败: ${err.message || '请重试'}`);
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: string, displayName: string) => {
    if (!confirm(`确定要删除用户“${displayName}”吗？此操作不可恢复！`)) return;
    try {
      await pb.collection('users').delete(userId);
      toast.success('用户删除成功');
      loadUsers();
    } catch (err) {
      toast.error('删除用户失败');
    }
  };

  // 导入相关函数
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
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
            errors.push(`第${index + 2}行：缺少必填字段`);
            return;
          }
          if (row['密码'] !== row['确认密码']) {
            errors.push(`第${index + 2}行：两次输入的密码不一致`);
            return;
          }
          if (row['密码'].length < 6) {
            errors.push(`第${index + 2}行：密码长度不能少于6位`);
            return;
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
          toast.error(`数据验证失败：\n${errors.join('\n')}`);
          return;
        }
        if (parsedUsers.length === 0) {
          toast.error('Excel文件中没有有效数据');
          return;
        }
        setImportData(parsedUsers);
        toast.success(`成功解析 ${parsedUsers.length} 条用户数据`);
      } catch (err) {
        toast.error('解析Excel文件失败，请检查文件格式');
      }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
  };

  const handleImportUsers = async () => {
    if (importData.length === 0) return;
    setImporting(true);
    let successCount = 0;
    let failCount = 0;
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
      } catch (err) {
        failCount++;
      }
    }
    toast.success(`导入完成！成功 ${successCount} 个，失败 ${failCount} 个`);
    setIsImportDialogOpen(false);
    setImportData([]);
    loadUsers();
    setImporting(false);
  };

  const downloadTemplate = () => {
    const template = [
      { '用户名': 'zhang.san', '显示名称': '张三', '邮箱': 'zhang.san@example.com', '密码': '123456', '确认密码': '123456', '角色': 1 },
      { '用户名': 'li.si', '显示名称': '李四', '邮箱': 'li.si@example.com', '密码': '123456', '确认密码': '123456', '角色': 2 },
    ];
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '用户模板');
    XLSX.writeFile(workbook, '用户导入模板.xlsx');
  };

  const getRoleBadge = (role: UserRole | string | undefined) => {
    let normalizedRole: UserRole = 'reviewee_only';
    if (role === 'admin') normalizedRole = 'admin';
    else if (role === 'reviewer') normalizedRole = 'reviewer';
    else normalizedRole = 'reviewee_only';
    const config = ROLE_CONFIG[normalizedRole];
    const Icon = config.icon;
    return (
      <Badge variant="secondary" className={`${config.color} gap-1 px-2 py-0.5 text-xs font-normal flex-shrink-0`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

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
                  <Upload className="h-4 w-4" />
                  导入用户
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">导入用户</DialogTitle>
                  <DialogDescription className="flex items-center gap-1 flex-wrap">
                    从Excel文件批量导入用户。
                    <Button variant="link" onClick={downloadTemplate} className="p-0 h-auto text-blue-600">
                      下载模板
                    </Button>
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>选择Excel文件</Label>
                    <Input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="border-slate-300" />
                    <p className="text-xs text-slate-500">
                      格式：用户名、显示名称、邮箱、密码、确认密码、角色（1=超级管理员，2=管理员，其他=组员）
                    </p>
                  </div>
                  {importData.length > 0 && (
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <h3 className="font-medium mb-2 text-sm text-slate-700">预览数据（{importData.length}条）</h3>
                      <div className="max-h-48 overflow-auto border border-slate-200 rounded bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 sticky top-0">
                            <tr><th>用户名</th><th>显示名称</th><th>角色</th></tr>
                          </thead>
                          <tbody>
                            {importData.slice(0, 5).map((user, idx) => (
                              <tr key={idx}><td>{user.username}</td><td>{user.display_name}</td><td>{getRoleBadge(user.role)}</td></tr>
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
                  <Plus className="h-4 w-4" />
                  新增用户
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">添加新用户</DialogTitle>
                  <DialogDescription>填写以下信息以创建新用户账户</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>用户名 *</Label>
                      <Input value={addFormData.username} onChange={(e) => setAddFormData({ ...addFormData, username: e.target.value })} placeholder="zhang.san" className="border-slate-300" />
                    </div>
                    <div className="space-y-2">
                      <Label>显示名称</Label>
                      <Input value={addFormData.display_name} onChange={(e) => setAddFormData({ ...addFormData, display_name: e.target.value })} placeholder="张三" className="border-slate-300" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>邮箱 *</Label>
                    <Input type="email" value={addFormData.email} onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })} placeholder="zhang.san@example.com" className="border-slate-300" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>密码 *</Label>
                      <Input type="password" value={addFormData.password} onChange={(e) => setAddFormData({ ...addFormData, password: e.target.value })} placeholder="至少6位" className="border-slate-300" />
                    </div>
                    <div className="space-y-2">
                      <Label>确认密码 *</Label>
                      <Input type="password" value={addFormData.passwordConfirm} onChange={(e) => setAddFormData({ ...addFormData, passwordConfirm: e.target.value })} placeholder="再次输入" className="border-slate-300" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>角色</Label>
                    <Select value={addFormData.role} onValueChange={(value: UserRole) => setAddFormData({ ...addFormData, role: value })}>
                      <SelectTrigger className="border-slate-300">
                        <SelectValue placeholder="选择角色" />
                      </SelectTrigger>
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
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-xs text-slate-500 font-medium">总用户</p><p className="text-2xl font-bold text-slate-900">{stats.total}</p></div>
              <Users className="h-8 w-8 text-slate-400" />
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-xs text-slate-500 font-medium">超级管理员</p><p className="text-2xl font-bold text-red-600">{stats.admin}</p></div>
              <Shield className="h-8 w-8 text-red-500" />
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-xs text-slate-500 font-medium">管理员</p><p className="text-2xl font-bold text-blue-600">{stats.reviewer}</p></div>
              <User className="h-8 w-8 text-blue-500" />
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-xs text-slate-500 font-medium">组员</p><p className="text-2xl font-bold text-slate-600">{stats.reviewee}</p></div>
              <Eye className="h-8 w-8 text-slate-500" />
            </CardContent>
          </Card>
        </motion.div>

        {/* 用户列表卡片 */}
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
                <>
                  {/* 桌面版表格 */}
                  <div className="hidden md:block divide-y divide-slate-100">
                    <AnimatePresence>
                      {filteredUsers.map((user, index) => (
                        <motion.div
                          key={user.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: index * 0.03 }}
                          className="px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="grid grid-cols-[40px_48px_1fr_100px_80px] items-center gap-3">
                            <div className="text-sm text-slate-500 text-center">{index + 1}</div>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                              {user.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{user.display_name}</p>
                              <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                            </div>
                            <div className="flex justify-start">{getRoleBadge(user.role)}</div>
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => openEditDialog(user)} className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(user.id, user.display_name)} className="h-8 w-8 p-0 text-slate-600 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* 移动端卡片列表 */}
                  <div className="md:hidden space-y-3 p-3">
                    <AnimatePresence>
                      {filteredUsers.map((user, index) => (
                        <motion.div
                          key={user.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: index * 0.03 }}
                          className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm"
                        >
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
                              <Button size="sm" variant="ghost" onClick={() => openEditDialog(user)} className="h-8 w-8 p-0 text-slate-600">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(user.id, user.display_name)} className="h-8 w-8 p-0 text-slate-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            {getRoleBadge(user.role)}
                            <span className="text-xs text-slate-400">#{index + 1}</span>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* 编辑用户对话框 - 无密码修改 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">编辑用户信息</DialogTitle>
            <DialogDescription>修改用户的基本信息和权限</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-username" className="select-none cursor-default">用户名</Label>
                <Input
                  id="edit-username"
                  value={editingUser?.username || ''}
                  disabled
                  className="bg-slate-50 border-slate-200 select-none cursor-default"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-displayname" className="select-none cursor-default">显示名称</Label>
                <Input
                  id="edit-displayname"
                  value={editFormData.display_name}
                  onChange={(e) => setEditFormData({ ...editFormData, display_name: e.target.value })}
                  className="border-slate-300"
                />
              </div>
            </div>
            {/* 已移除新密码和确认密码字段 */}
            <div className="space-y-2">
              <Label htmlFor="edit-role" className="select-none cursor-default">角色</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value: UserRole) => setEditFormData({ ...editFormData, role: value })}
              >
                <SelectTrigger id="edit-role" className="border-slate-300">
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
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