import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { pb } from '@/db/pb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { MessageSquare, Star, Send, Inbox, Check, Calendar, User, X, LayoutGrid, List } from 'lucide-react';
import { DIMENSION_LABELS, DIMENSIONS } from '@/types/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ========== 类型定义 ==========
interface MonthCycle {
  id: string;
  name: string;
  is_active: boolean;
  start_date: string;
}

interface ReviewRecord {
  id: string;
  from_user_name: string;
  from_user_id: string;
  to_user_name: string;
  to_user_id: string;
  content: Record<string, any>;
  created_at: string;
  type: 'sent' | 'received';
  pokerRank?: string;
  rankNumber?: number;
}

interface UserOption {
  id: string;
  name: string;
}

type ViewMode = 'fan' | 'list';

// ========== 工具函数 ==========
const isCurrentMonth = (cycle: MonthCycle) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const startDate = new Date(cycle.start_date || '');
  const cycleMonth = startDate.getMonth() + 1;
  const cycleYear = startDate.getFullYear();
  return cycleYear === currentYear && cycleMonth === currentMonth;
};

const getSuit = (score: number) => {
  if (score >= 4.0) return '♠';
  if (score >= 3.0) return '♥';
  if (score >= 2.0) return '♦';
  return '♣';
};

const getSuitColor = (score: number) => {
  if (score >= 4.0) return 'text-slate-900';
  if (score >= 3.0 || score >= 2.0) return 'text-red-600';
  return 'text-slate-900';
};

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getReviewAvgScore = (review: ReviewRecord) => {
  let total = 0;
  let count = 0;
  DIMENSIONS.forEach((dim) => {
    const score = review.content[dim]?.score || 0;
    if (score > 0) {
      total += score;
      count++;
    }
  });
  return count > 0 ? total / count : 0;
};

// ========== 扇形卡牌组件 ==========
const ReviewCard = ({
  review,
  total,
  index,
  activeTab,
  onClick,
}: {
  review: ReviewRecord;
  total: number;
  index: number;
  activeTab: 'sent' | 'received';
  onClick: () => void;
}) => {
  const avgScore = getReviewAvgScore(review);
  const maxTotalRotate = Math.min(total * 12, 90);
  const angle = ((index - (total - 1) / 2) * (maxTotalRotate / total));
  const radius = 280;
  const x = Math.sin((angle * Math.PI) / 180) * radius;
  const y = Math.cos((angle * Math.PI) / 180) * 15 - 40;

  const suit = getSuit(avgScore);
  const suitColor = getSuitColor(avgScore);
  const pokerRank = review.pokerRank || '?';

  return (
    <motion.div
      initial={{ opacity: 0, y: 100, rotate: 0 }}
      animate={{ opacity: 1, y, x, rotate: angle }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 80, damping: 14 }}
      whileHover={{
        y: y - 60,
        scale: 1.1,
        rotate: 0,
        transition: { duration: 0.25, ease: 'ease-out' },
        zIndex: 1000,
      }}
      onClick={onClick}
      className="absolute cursor-pointer origin-bottom"
      style={{ zIndex: index }}
    >
      <div className="w-40 h-56 bg-white rounded-xl border border-blue-700 shadow-xl shadow-slate-300/40 overflow-hidden flex flex-col relative p-2">
        <div className="absolute top-2 left-2 flex flex-col items-center z-10">
          <span className={`text-2xl font-bold ${suitColor} leading-none`}>{pokerRank}</span>
          <span className={`text-xl ${suitColor} leading-none`}>{suit}</span>
        </div>
        <div className="absolute bottom-2 right-2 flex flex-col items-center rotate-180 z-10">
          <span className={`text-2xl font-bold ${suitColor} leading-none`}>{pokerRank}</span>
          <span className={`text-xl ${suitColor} leading-none`}>{suit}</span>
        </div>
        <div className="flex-1 flex flex-col gap-6 items-center justify-center select-none overflow-hidden opacity-5">
          <span className="text-sm whitespace-nowrap">smartmore</span>
          <span className="text-sm whitespace-nowrap">smartmore</span>
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-1">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          <span className="text-6xl font-extrabold text-slate-800 tracking-tight">
            {avgScore.toFixed(1)}
          </span>
        </div>
        {activeTab === 'sent' && (
          <div className="absolute bottom-8 left-2 right-2 text-center z-10">
            <span className="text-base font-semibold text-slate-700 truncate block">
              {review.to_user_name}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ========== 列表视图中的卡片组件（修复花色颜色） ==========
const ListReviewCard = ({
  review,
  activeTab,
  onClick,
}: {
  review: ReviewRecord;
  activeTab: 'sent' | 'received';
  onClick: () => void;
}) => {
  const avgScore = getReviewAvgScore(review);
  const suit = getSuit(avgScore);
  const suitColor = getSuitColor(avgScore);
  const date = formatDateTime(review.created_at);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-all"
      onClick={onClick}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {activeTab === 'sent'
              ? review.to_user_name?.charAt(0).toUpperCase() || '?'
              : review.pokerRank?.charAt(0) || '?'}
          </div>
          <div>
            <div className="font-semibold text-slate-900">
              {activeTab === 'sent' ? (
                review.to_user_name
              ) : (
                <>
                  {review.pokerRank}{' '}
                  <span className={suitColor}>{suit}</span>
                </>
              )}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Calendar className="h-3 w-3" />
              {date}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="text-lg font-bold text-blue-700">{avgScore.toFixed(1)}</span>
          <span className={`text-xl ml-1 ${suitColor}`}>{suit}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        {DIMENSIONS.map(dim => {
          const score = review.content[dim]?.score || 0;
          return (
            <div key={dim} className="flex justify-between items-center">
              <span className="text-slate-500">{DIMENSION_LABELS[dim]}</span>
              <span className="font-bold text-slate-800">{score.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ========== 详情弹窗组件（不变） ==========
const ReviewDetailModal = ({
  review,
  onClose,
}: {
  review: ReviewRecord | null;
  onClose: () => void;
}) => {
  if (!review) return null;
  const avgScore = getReviewAvgScore(review);
  const suit = getSuit(avgScore);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
      >
        <div className={`px-6 py-5 ${avgScore >= 4 ? 'bg-slate-800' : 'bg-red-600'} text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                {review.type === 'received' ? suit : review.to_user_name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {review.type === 'received' ? `${review.pokerRank} ${suit}` : review.to_user_name}
                </h2>
                <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
                  <Calendar className="h-4 w-4" />
                  {formatDateTime(review.created_at)}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-5">
            {DIMENSIONS.map((dim, dimIndex) => {
              const dimData = review.content[dim];
              const score = dimData?.score || 0;
              const note = dimData?.note;
              return (
                <motion.div
                  key={dim}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: dimIndex * 0.05 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{DIMENSION_LABELS[dim]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, starIndex) => (
                          <Star
                            key={starIndex}
                            className={`h-4 w-4 ${
                              starIndex < Math.floor(score)
                                ? 'fill-amber-400 text-amber-400'
                                : starIndex < score
                                ? 'fill-amber-400/50 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-lg font-bold text-slate-900 w-10 text-right">{score.toFixed(1)}</span>
                    </div>
                  </div>
                  <Progress value={(score / 5) * 100} className="h-2 bg-slate-100" />
                  {note && (
                    <div className="ml-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-700">{note}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ========== 主组件 ==========
export default function MyReviewsPage() {
  const { profile } = useAuth();
  const [cycles, setCycles] = useState<MonthCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedReview, setSelectedReview] = useState<ReviewRecord | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('fan'); // 新增视图模式

  const canSendReviews = profile?.role !== 'reviewee_only';

  useEffect(() => {
    if (!canSendReviews && activeTab === 'sent') {
      setActiveTab('received');
    }
  }, [canSendReviews, activeTab]);

  useEffect(() => {
    const loadCycles = async () => {
      try {
        const result = await pb.collection('month_cycles').getList(1, 20, { sort: '-start_date' });
        const cyclesData: MonthCycle[] = result.items.map((r) => ({
          id: r.id,
          name: r.name ?? '',
          is_active: r.is_active ?? false,
          start_date: r.start_date ?? '',
        }));
        setCycles(cyclesData);
        const activeCycle = cyclesData.find((c) => c.is_active);
        if (activeCycle) setSelectedCycle(activeCycle.id);
        else if (cyclesData.length > 0) setSelectedCycle(cyclesData[0].id);
      } catch {
        toast.error('加载评价周期失败');
      } finally {
        setLoadingCycles(false);
      }
    };
    if (profile) loadCycles();
  }, [profile]);

  useEffect(() => {
    if (!selectedCycle || !profile) return;
    let isMounted = true;
    const loadReviews = async () => {
      setLoading(true);
      try {
        const result = await pb.collection('reviews').getList(1, 500, { sort: '-created' });
        if (!isMounted) return;
        const filteredReviews = result.items.filter((r) => {
          const cycleId = typeof r.cycle_id === 'string' ? r.cycle_id : r.cycle_id?.id;
          return cycleId === selectedCycle;
        });
        const userReviews = filteredReviews.filter((r) => r.from_user === profile.id || r.to_user === profile.id);
        const userIds = new Set<string>();
        userReviews.forEach((r) => {
          if (r.from_user) userIds.add(r.from_user);
          if (r.to_user) userIds.add(r.to_user);
        });
        const usersMap = new Map<string, string>();
        if (userIds.size > 0) {
          const usersResult = await pb.collection('users').getList(1, 200);
          usersResult.items.forEach((user) => {
            usersMap.set(user.id, user.display_name || user.username || user.id);
          });
        }
        const reviewRecords: ReviewRecord[] = userReviews.map((r) => {
          let content: Record<string, any> = {};
          try {
            content = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
          } catch (e) {
            console.error('解析评价内容失败:', e);
          }
          const isSent = r.from_user === profile.id;
          let toUserName = '未知';
          let fromUserName = '匿名';

          if (isSent) {
            toUserName = usersMap.get(r.to_user) || r.to_user_name || '未知';
          } else {
            toUserName = '我';
            fromUserName = usersMap.get(r.from_user) || '匿名';
          }

          return {
            id: r.id,
            from_user_name: isSent ? '我' : fromUserName,
            from_user_id: isSent ? r.from_user : r.from_user,
            to_user_name: isSent ? toUserName : '我',
            to_user_id: isSent ? r.to_user : r.from_user,
            content,
            created_at: r.created,
            type: isSent ? 'sent' : 'received',
          };
        });
        setReviews(reviewRecords);
      } catch (err) {
        if (isMounted) toast.error('加载评价记录失败');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadReviews();
    return () => {
      isMounted = false;
    };
  }, [selectedCycle, profile]);

  const uniqueUsers = useMemo(() => {
    const tabReviews = reviews.filter((r) => r.type === activeTab);
    const userMap = new Map<string, string>();
    tabReviews.forEach((review) => {
      if (activeTab === 'received') {
        if (!userMap.has(review.from_user_id)) {
          userMap.set(review.from_user_id, review.from_user_name);
        }
      } else {
        if (!userMap.has(review.to_user_id)) {
          userMap.set(review.to_user_id, review.to_user_name);
        }
      }
    });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [reviews, activeTab]);

  const filteredReviews = useMemo(() => {
    let result = reviews.filter((review) => {
      if (review.type !== activeTab) return false;
      if (selectedUsers.length > 0) {
        if (activeTab === 'received') {
          return selectedUsers.includes(review.from_user_id);
        } else {
          return selectedUsers.includes(review.to_user_id);
        }
      }
      return true;
    });
    result.sort((a, b) => getReviewAvgScore(b) - getReviewAvgScore(a));
    const pokerRanks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    return result.map((review, idx) => ({
      ...review,
      pokerRank: pokerRanks[idx] || `${idx + 1}`,
      rankNumber: idx + 1,
    }));
  }, [reviews, activeTab, selectedUsers]);

  const sentCount = reviews.filter((r) => r.type === 'sent').length;
  const receivedCount = reviews.filter((r) => r.type === 'received').length;

  const handleSelectAll = useCallback(() => {
    if (selectedUsers.length === uniqueUsers.length) setSelectedUsers([]);
    else setSelectedUsers(uniqueUsers.map((u) => u.id));
  }, [selectedUsers, uniqueUsers]);

  const getSelectedUserNames = useCallback(() => {
    if (selectedUsers.length === 0) return '筛选人员';
    if (selectedUsers.length === 1) {
      const user = uniqueUsers.find(u => u.id === selectedUsers[0]);
      return user?.name || '1人';
    }
    return `已选 ${selectedUsers.length} 人`;
  }, [selectedUsers, uniqueUsers]);

  const handleTabChange = useCallback((tab: 'sent' | 'received') => {
    setActiveTab(tab);
    setSelectedUsers([]);
  }, []);

  if (!profile) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">请先登录</p></div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden select-none">
      {/* 顶部栏 */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">我的评价</h1>
            <p className="text-xs text-slate-500">发出和收到的评价记录</p>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden p-4 flex flex-col">
        {/* 控制栏 */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm shrink-0">
          {/* 周期选择 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">查看月份</span>
            {loadingCycles ? (
              <Skeleton className="h-9 w-36" />
            ) : (
              <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                <SelectTrigger className="w-40 h-9 border-slate-300 text-sm">
                  <SelectValue placeholder="选择月份" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {isCurrentMonth(c) && <Badge variant="secondary" className="ml-2 text-xs">本月</Badge>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="h-8 w-px bg-slate-200" />

          {/* Tab 切换 */}
          <div className="flex gap-2">
            <button
              onClick={() => handleTabChange('received')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium border text-sm ${
                activeTab === 'received'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Inbox className="h-4 w-4" />
              收到的评价
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                activeTab === 'received' ? 'bg-white/20' : 'bg-slate-100'
              }`}>
                {receivedCount}
              </span>
            </button>

            {canSendReviews && (
              <button
                onClick={() => handleTabChange('sent')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium border text-sm ${
                  activeTab === 'sent'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Send className="h-4 w-4" />
                发出的评价
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  activeTab === 'sent' ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {sentCount}
                </span>
              </button>
            )}
          </div>

          {/* 视图切换按钮（仅在评价列表不为空时显示） */}
          {filteredReviews.length > 0 && (
            <>
              <div className="h-8 w-px bg-slate-200" />
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('fan')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'fan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="扇形视图"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="列表视图（适合手机）"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {canSendReviews && activeTab === 'sent' && uniqueUsers.length > 0 && (
            <>
              <div className="h-8 w-px bg-slate-200" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`gap-2 bg-white border-slate-300 min-w-[140px] justify-between h-9 text-sm ${
                      selectedUsers.length > 0 ? 'border-blue-400 text-blue-700' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate">{getSelectedUserNames()}</span>
                    </div>
                    {selectedUsers.length > 0 && (
                      <Badge className="bg-blue-600 ml-1 shrink-0">{selectedUsers.length}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="搜索成员..." />
                    <CommandList>
                      <CommandEmpty>没有找到成员</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={handleSelectAll} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded border border-slate-300 flex items-center justify-center">
                              {selectedUsers.length === uniqueUsers.length && <Check className="h-3 w-3 text-blue-600" />}
                            </div>
                            <span className="font-medium">全选 / 取消全选</span>
                          </div>
                        </CommandItem>
                      </CommandGroup>
                      <CommandSeparator />
                      <CommandGroup>
                        {uniqueUsers.map((user) => {
                          const isSelected = selectedUsers.includes(user.id);
                          return (
                            <CommandItem
                              key={user.id}
                              onSelect={() => {
                                setSelectedUsers((prev) =>
                                  prev.includes(user.id)
                                    ? prev.filter((id) => id !== user.id)
                                    : [...prev, user.id]
                                );
                              }}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <div className="h-4 w-4 rounded border border-slate-300 flex items-center justify-center">
                                  {isSelected && <Check className="h-3 w-3 text-blue-600" />}
                                </div>
                                <span>{user.name}</span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>

        {/* 评价展示区域 */}
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-44 rounded-xl" />
              ))}
            </div>
          </div>
        ) : !selectedCycle ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="border border-slate-200 bg-white">
              <CardContent className="text-center text-slate-500 py-16 text-lg">请选择月份</CardContent>
            </Card>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="border border-slate-200 bg-white">
              <CardContent className="text-center text-slate-500 py-16 text-lg">
                {selectedUsers.length > 0
                  ? '暂无选中成员的评价'
                  : activeTab === 'received'
                  ? '本月暂无收到的评价'
                  : '本月暂无发出的评价'}
              </CardContent>
            </Card>
          </div>
        ) : viewMode === 'fan' ? (
          // 扇形视图
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0 flex justify-center items-center">
              <div className="relative w-full h-full flex items-center justify-center">
                <AnimatePresence>
                  {filteredReviews.map((review, idx) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      total={filteredReviews.length}
                      index={idx}
                      activeTab={activeTab}
                      onClick={() => setSelectedReview(review)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          // 列表视图（移动端友好）
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-3">
              <AnimatePresence>
                {filteredReviews.map((review, idx) => (
                  <ListReviewCard
                    key={review.id}
                    review={review}
                    activeTab={activeTab}
                    onClick={() => setSelectedReview(review)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedReview && (
          <ReviewDetailModal review={selectedReview} onClose={() => setSelectedReview(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}