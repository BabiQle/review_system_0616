import { useState, useEffect, useCallback, useRef } from 'react';
import { pb } from '@/db/pb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  Info,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MonthCycle {
  id: string;
  name: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
}

// 周期卡片组件
const CycleCard = ({
  cycle,
  isCurrent,
  updating,
  onToggle,
  index,
}: {
  cycle: MonthCycle;
  isCurrent: boolean;
  updating: boolean;
  onToggle: (id: string) => void;
  index: number;
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' }}
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`h-12 w-12 rounded-full flex items-center justify-center shadow-sm ${
              isCurrent
                ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                : 'bg-gradient-to-br from-slate-400 to-slate-500'
            }`}
          >
            <Calendar className="h-6 w-6 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-slate-900">{cycle.name}</h3>
              {isCurrent && <Badge className="bg-blue-600 text-white">本月</Badge>}
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatDate(cycle.start_date)}</span>
              </div>
              <span>至</span>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatDate(cycle.end_date)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {cycle.is_active ? (
              <Badge className="bg-green-500 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                已开启
              </Badge>
            ) : (
              <Badge variant="outline" className="border-slate-300 text-slate-600">
                <XCircle className="h-3 w-3 mr-1" />
                已关闭
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={cycle.is_active}
                onCheckedChange={() => onToggle(cycle.id)}
                disabled={updating}
                className="data-[state=checked]:bg-blue-600"
              />
              <span className="text-sm text-slate-600">
                {cycle.is_active ? '开启' : '关闭'}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function CycleManagementPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [cycles, setCycles] = useState<MonthCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const autoCreatedRef = useRef(false);

  // 加载周期列表
  const loadCycles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await pb.collection('month_cycles').getList<Record<string, any>>(1, 50, {
        sort: '-start_date',
      });
      const cyclesData: MonthCycle[] = result.items.map((r) => ({
        id: r.id,
        name: r.name ?? '',
        is_active: r.is_active ?? false,
        start_date: r.start_date ?? '',
        end_date: r.end_date ?? '',
      }));
      setCycles(cyclesData);
      return cyclesData;
    } catch (err) {
      console.error('加载评价周期失败:', err);
      toast.error('加载评价周期失败，请刷新重试');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 自动创建缺失的下一个月周期（仅一次）
  const autoCreateMissingCycles = useCallback(async (currentCycles: MonthCycle[]) => {
    if (!isAdmin) return;
    if (autoCreatedRef.current) return;
    autoCreatedRef.current = true;

    try {
      const now = new Date();
      const futureMonths = 1;
      let createdCount = 0;

      for (let i = 1; i <= futureMonths; i++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1;
        const cycleName = `${year}年${month}月`;

        const exists = currentCycles.some((c) => c.name === cycleName);
        if (exists) continue;

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const isActive = year === now.getFullYear() && month === now.getMonth() + 1;

        await pb.collection('month_cycles').create({
          name: cycleName,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          is_active: isActive,
        });
        createdCount++;
      }

      if (createdCount > 0) {
        toast.success(`已自动创建 ${createdCount} 个新的评价周期`, { duration: 3000 });
        await loadCycles();
      }
    } catch (err) {
      console.error('自动创建周期失败:', err);
    }
  }, [isAdmin, loadCycles]);

  // 初始化
  useEffect(() => {
    const init = async () => {
      const cyclesData = await loadCycles();
      await autoCreateMissingCycles(cyclesData);
    };
    init();
  }, []);

  // 切换周期状态
  const toggleCycle = useCallback(
    async (cycleId: string) => {
      const currentCycle = cycles.find((c) => c.id === cycleId);
      if (!currentCycle) return;

      const newActiveState = !currentCycle.is_active;
      if (updatingId === cycleId) return;
      setUpdatingId(cycleId);

      const oldCycles = cycles;
      setCycles((prev) =>
        prev.map((c) => (c.id === cycleId ? { ...c, is_active: newActiveState } : c))
      );

      try {
        await pb.collection('month_cycles').update(cycleId, {
          is_active: newActiveState,
        });
        toast.success(newActiveState ? '周期已开启' : '周期已关闭');
      } catch (err) {
        console.error('切换周期状态失败:', err);
        setCycles(oldCycles);
        toast.error('操作失败，请重试');
      } finally {
        setUpdatingId(null);
      }
    },
    [cycles, updatingId]
  );

  // 判断是否为当前月份周期
  const isCurrentMonth = useCallback((cycle: MonthCycle) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startDate = new Date(cycle.start_date || '');
    const cycleMonth = startDate.getMonth() + 1;
    const cycleYear = startDate.getFullYear();
    return cycleYear === currentYear && cycleMonth === currentMonth;
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">仅超级管理员可访问此页面</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部导航栏 - fixed */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                评价周期
                <Badge variant="outline" className="text-xs font-normal text-slate-500 border-slate-300 bg-slate-50">
                  超级管理员
                </Badge>
              </h1>
              <p className="text-xs text-slate-500">管理评价周期的开启和关闭，系统将自动创建下个月份</p>
            </div>
          </div>
          {/* 刷新按钮已移除 */}
        </div>
      </div>

      {/* 内容区域 - 由AppLayout的main提供滚动 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 说明卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Info className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 mb-2">周期管理说明</h3>
              <ul className="space-y-1.5 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>周期按自然月自动划分，每月 1 日至月底。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>系统会在管理员首次访问时自动创建下个月的评价周期，无需手动操作。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>当月周期默认开启；历史月份默认关闭，可手动开启补填。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>关闭后成员无法在该月填写新评价，已有数据不受影响。</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* 周期列表标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">评价周期列表</h2>
          </div>
          <Badge variant="secondary" className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700">
            共 {cycles.length} 个周期
          </Badge>
        </div>

        {/* 周期列表 */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : cycles.length === 0 ? (
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="text-center text-slate-500 py-16">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>暂无评价周期数据</p>
              <p className="text-sm text-slate-400 mt-2">请稍后刷新，系统将自动创建</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {cycles.map((cycle, index) => (
                <CycleCard
                  key={cycle.id}
                  cycle={cycle}
                  isCurrent={isCurrentMonth(cycle)}
                  updating={updatingId === cycle.id}
                  onToggle={toggleCycle}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}