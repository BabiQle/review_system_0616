import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { pb } from '@/db/pb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Star, Send, CheckCircle2, Circle, ChevronRight,
  Users, ArrowLeft, ArrowRight, Sparkles, Target,
  CheckSquare, Square, AlertCircle, Info, Eye, EyeOff
} from 'lucide-react';
import { DIMENSION_LABELS, DIMENSIONS } from '@/types/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ========== 类型定义 ==========
interface UserOption {
  id: string;
  username: string;
  display_name: string;
}

interface MonthCycle {
  id: string;
  name: string;
  is_active: boolean;
  start_date: string;
}

interface SingleUserData {
  scores: Record<string, number>;
  notes: Record<string, string>;
  touched: Record<string, boolean>;
}
type ReviewData = Record<string, SingleUserData>;
type Step = 'select' | 'review';

// ========== 维度帮助数据 ==========
const DIMENSION_HELP: Record<string, { description: string; rules: Record<string, string> }> = {
  data_quality: {
    description: '数据质量是否符合要求，质量原因返工的次数。',
    rules: {
      '优秀': '质量接近完美，整体不需要改动',
      '良好': '标注符合要求，有个别需要修改的',
      '合格': '标注基本符合要求，质量有待提升',
      '较差': '反复修改多次，并且需要督促修改的'
    }
  },
  personal_efficiency: {
    description: '参考工作量，效率。',
    rules: {
      '优秀': '超过平均水平50%',
      '良好': '超过平均水平20%',
      '合格': '平均水平附近',
      '较差': '低于平均水平'
    }
  },
  work_compliance: {
    description: '是否配合不同的工作安排，分担更多的责任，任务切换等，且完成较好。',
    rules: {
      '优秀': '积极主动承担额外任务，完成出色',
      '良好': '配合安排，按时完成',
      '合格': '基本配合，需要督促',
      '较差': '不配合工作安排，影响项目进度'
    }
  },
  work_enthusiasm: {
    description: '积极提问手上分配到的任务可能出现的问题，包括如何标注、标注的方式、图片缺陷是否一致、图片是否能标注等其他不明确的疑问。',
    rules: {
      '优秀': '主动提问，积极沟通，带动团队学习氛围',
      '良好': '能够主动提问，沟通顺畅',
      '合格': '偶尔提问，基本能完成任务',
      '较差': '从不主动提问，问题堆积影响进度'
    }
  },
  other_help: {
    description: '1. 帮助提升效率，提高准确率等各种想法，建议等。\n2. 遇到问题是否主动第一时间向身边的小伙伴寻求帮助，或者寻求领导帮助解决问题。',
    rules: {
      '优秀': '对项目、团队有重大贡献',
      '良好': '对项目有正面促进作用',
      '合格': '无突出贡献，但未造成负面影响',
      '较差': '对项目有较大拖累，延误时间，影响整体质量'
    }
  }
};

// ========== 评级信息辅助函数 ==========
const getRatingInfo = (score: number, touched: boolean = false) => {
  if (!touched) {
    return {
      label: '请评分',
      range: '',
      color: 'bg-slate-200',
      textColor: 'text-slate-400',
      lightColor: 'bg-slate-50',
      borderColor: 'border-slate-200',
      progressColor: 'bg-slate-300'
    };
  }
  if (score >= 4.5) {
    return {
      label: '优秀',
      range: '4.5-5.0分',
      color: 'bg-red-500',
      textColor: 'text-red-600',
      lightColor: 'bg-red-50',
      borderColor: 'border-red-200',
      progressColor: 'bg-red-500'
    };
  }
  if (score >= 3.0) {
    return {
      label: '良好',
      range: '3.0-4.0分',
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      lightColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      progressColor: 'bg-blue-500'
    };
  }
  if (score >= 1.5) {
    return {
      label: '合格',
      range: '1.5-2.5分',
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      lightColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      progressColor: 'bg-orange-500'
    };
  }
  return {
    label: '较差',
    range: '0-1.0分',
    color: 'bg-gray-300',
    textColor: 'text-gray-500',
    lightColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    progressColor: 'bg-gray-300'
  };
};

// ========== 帮助弹出组件 ==========
function DimensionHelpPopover({
  dimension,
  children,
}: {
  dimension: string;
  children: React.ReactNode;
}) {
  const help = DIMENSION_HELP[dimension];
  if (!help) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-60 overflow-y-auto text-sm p-4" side="right" align="start">
        <div className="space-y-2">
          <p className="font-medium text-slate-900">{DIMENSION_LABELS[dimension]}</p>
          <p className="text-slate-600 whitespace-pre-line">{help.description}</p>
          <div className="border-t border-slate-100 pt-2 mt-2">
            <p className="text-xs font-medium text-slate-500 mb-1">评分参考</p>
            <ul className="space-y-1 text-xs">
              {Object.entries(help.rules).map(([key, value]) => (
                <li key={key} className="flex gap-2">
                  <span className="font-medium text-slate-700 min-w-[40px]">{key}</span>
                  <span className="text-slate-600">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ========== 星星评分组件 ==========
const StarRating = ({
  value,
  onChange,
  touched
}: {
  value: number;
  onChange: (score: number) => void;
  touched: boolean;
}) => {
  const isDraggingRef = useRef(false);

  const handleStarClick = (score: number) => {
    onChange(score);
  };

  const handleMouseEnter = (score: number) => {
    if (isDraggingRef.current) onChange(score);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      const newVal = Math.min(5, value + 0.5);
      onChange(newVal);
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      const newVal = Math.max(0, value - 0.5);
      onChange(newVal);
    }
  };

  return (
    <div
      className="flex items-center gap-0.5 select-none relative"
      onMouseDown={() => (isDraggingRef.current = true)}
      onMouseUp={() => (isDraggingRef.current = false)}
      onMouseLeave={() => (isDraggingRef.current = false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <button
        type="button"
        onClick={() => handleStarClick(0)}
        onMouseEnter={() => handleMouseEnter(0)}
        className="absolute left-0 top-0 w-[12px] h-8 z-20 cursor-pointer focus:outline-none"
        title="点击清零"
      />
      {[1, 2, 3, 4, 5].map(star => {
        const isFull = star <= Math.floor(value);
        const isHalf = star === Math.ceil(value) && value % 1 === 0.5;
        return (
          <div key={star} className="relative w-8 h-8">
            <button
              type="button"
              onClick={() => handleStarClick(star - 0.5)}
              onMouseEnter={() => handleMouseEnter(star - 0.5)}
              className="absolute top-0 left-0 w-1/2 h-full overflow-hidden z-10 cursor-pointer hover:scale-110 transition-transform focus:outline-none"
              title={`${star - 0.5}分`}
            >
              <Star className="h-8 w-8 text-gray-300" />
              {(isFull || isHalf) && <Star className="h-8 w-8 fill-amber-400 text-amber-400 absolute top-0 left-0" />}
            </button>
            <button
              type="button"
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => handleMouseEnter(star)}
              className="absolute top-0 left-1/2 w-1/2 h-full overflow-hidden z-10 cursor-pointer hover:scale-110 transition-transform focus:outline-none"
              title={`${star}分`}
            >
              <Star className="h-8 w-8 text-gray-300 -ml-4" />
              {isFull && <Star className="h-8 w-8 fill-amber-400 text-amber-400 absolute top-0 -ml-4" />}
            </button>
            <Star className="h-8 w-8 text-gray-300 absolute top-0 left-0 pointer-events-none" />
            {isFull && <Star className="h-8 w-8 fill-amber-400 text-amber-400 absolute top-0 left-0 pointer-events-none" />}
            {isHalf && (
              <div className="absolute top-0 left-0 overflow-hidden w-4 pointer-events-none">
                <Star className="h-8 w-8 fill-amber-400 text-amber-400" />
              </div>
            )}
          </div>
        );
      })}
      {value > 0 ? (
        <span className="ml-3 text-base font-bold text-slate-900 tabular-nums">{value.toFixed(1)}</span>
      ) : touched ? (
        <span className="ml-3 text-base font-bold text-red-500 tabular-nums">0.0</span>
      ) : null}
    </div>
  );
};

// ========== 评级进度条组件 ==========
const RatingDisplay = ({ score, touched }: { score: number; touched: boolean }) => {
  const info = getRatingInfo(score, touched);
  const percentage = (score / 5) * 100;

  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${touched ? info.textColor : 'text-slate-400'}`}>
          {touched ? `${info.label} ${info.range}` : '请评分'}
        </span>
        <span className={`font-medium ${touched ? info.textColor : 'text-slate-400'}`}>
          {touched ? score.toFixed(1) : '0.0'}
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${touched ? info.progressColor : 'bg-slate-300'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ========== 帮助内容卡片 ==========
const HelpContent = ({ dimension, score, touched }: { dimension: string; score: number; touched: boolean }) => {
  const [visible, setVisible] = useState(true);
  const help = DIMENSION_HELP[dimension];
  if (!help) return null;

  const info = getRatingInfo(score, touched);
  const isRated = touched;
  const rule = isRated ? help.rules[info.label] : null;

  const toggleVisible = () => setVisible(!visible);

  if (!visible) {
    return (
      <div className="mt-2 text-center">
        <button
          onClick={toggleVisible}
          className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto"
        >
          <Eye className="h-3 w-3" />
          显示评分参考
        </button>
      </div>
    );
  }

  return (
    <div className={`mt-2 p-3 rounded-lg border ${isRated ? info.borderColor : 'border-slate-200'} ${isRated ? info.lightColor : 'bg-slate-50'} transition-all duration-200`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-xs text-slate-600 whitespace-pre-line">{help.description}</p>
          {isRated && rule && (
            <p className="text-xs font-medium mt-1 text-slate-700">
              <span className={`${info.textColor} font-bold`}>{info.label}</span>（{info.range}）：{rule}
            </p>
          )}
        </div>
        <button
          onClick={toggleVisible}
          className="text-slate-400 hover:text-slate-600 ml-2 flex-shrink-0"
          title={visible ? '隐藏参考' : '显示参考'}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
};

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

const isValidDraftData = (data: SingleUserData): boolean => {
  const hasTouched = DIMENSIONS.some(dim => data.touched[dim]);
  const hasNote = DIMENSIONS.some(dim => data.notes[dim].trim() !== '');
  return hasTouched || hasNote;
};

const isAllDimensionTouched = (data: SingleUserData): boolean => {
  return DIMENSIONS.every(dim => data.touched[dim]);
};

const getDefaultSingleUserData = (): SingleUserData => {
  const scores: Record<string, number> = {};
  const notes: Record<string, string> = {};
  const touched: Record<string, boolean> = {};
  DIMENSIONS.forEach(dim => {
    scores[dim] = 0;
    notes[dim] = '';
    touched[dim] = false;
  });
  return { scores, notes, touched };
};

// ========== 主组件 ==========
export default function ReviewPage() {
  const { profile } = useAuth();
  const [cycles, setCycles] = useState<MonthCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [currentReviewUserId, setCurrentReviewUserId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [completedUsers, setCompletedUsers] = useState<Set<string>>(new Set());
  const [allReviewData, setAllReviewData] = useState<ReviewData>({});
  const [draftCache, setDraftCache] = useState<ReviewData>({});
  const [flashFeedback, setFlashFeedback] = useState(false);

  const lastSwitchTimeRef = useRef(0);
  const prevSelectedUserIdsRef = useRef<Set<string>>(new Set());

  // ========== 数据加载 ==========
  const loadCycles = useCallback(async () => {
    try {
      const result = await pb.collection('month_cycles').getList(1, 10, {
        sort: '-start_date',
        filter: 'is_active = true',
      });
      const cyclesData: MonthCycle[] = result.items.map((r) => ({
        id: r.id,
        name: r.name ?? '',
        is_active: r.is_active ?? false,
        start_date: r.start_date ?? '',
      }));
      setCycles(cyclesData);
      if (cyclesData.length > 0) setSelectedCycle(cyclesData[0].id);
    } catch {
      toast.error('加载评价周期失败');
    } finally {
      setLoadingCycles(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!profile) return;
    setLoadingUsers(true);
    try {
      const result = await pb.collection('users').getList(1, 200, { sort: 'display_name' });
      const filteredUsers = result.items.filter((r) => r.id !== profile.id);
      const usersData = filteredUsers.map((r) => ({
        id: r.id,
        username: r.username ?? '',
        display_name: (r.display_name as string) || (r.username as string) || '',
      }));
      setUsers(usersData);

      const initialData: ReviewData = {};
      usersData.forEach((user) => {
        initialData[user.id] = getDefaultSingleUserData();
      });
      setAllReviewData(initialData);
      setDraftCache({});

      if (usersData.length > 0) setCurrentReviewUserId(usersData[0].id);
    } catch {
      toast.error('加载成员列表失败');
    } finally {
      setLoadingUsers(false);
    }
  }, [profile]);

  const loadCompletedReviews = useCallback(async (cycleId: string, userIds: string[]) => {
    if (!cycleId || !profile || userIds.length === 0) return;
    try {
      const result = await pb.collection('reviews').getList(1, 100, {
        filter: `cycle_id="${cycleId}"&&from_user="${profile.id}"`,
      });
      const completed = new Set<string>();
      const existingData: ReviewData = {};

      result.items.forEach((review) => {
        completed.add(review.to_user);
        let content: Record<string, any> = {};
        try { content = typeof review.content === 'string' ? JSON.parse(review.content) : review.content; } catch {}

        const data = getDefaultSingleUserData();
        DIMENSIONS.forEach(dim => {
          data.scores[dim] = content[dim]?.score ?? 0;
          data.notes[dim] = content[dim]?.note ?? '';
          data.touched[dim] = true;
        });
        existingData[review.to_user] = data;
      });

      setCompletedUsers(completed);
      setAllReviewData(prev => ({ ...prev, ...existingData }));
    } catch (err) {
      console.error('加载已完成评价失败:', err);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      loadCycles();
      loadUsers();
    }
  }, [profile, loadCycles, loadUsers]);

  useEffect(() => {
    if (selectedCycle && users.length > 0) {
      loadCompletedReviews(selectedCycle, users.map(u => u.id));
    }
  }, [selectedCycle, users, loadCompletedReviews]);

  // ========== 草稿缓存 ==========
  useEffect(() => {
    const handleBeforeUnload = () => setDraftCache({});
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!currentReviewUserId) return;
    const draft = draftCache[currentReviewUserId];
    if (draft && !completedUsers.has(currentReviewUserId)) {
      setAllReviewData(prev => ({
        ...prev,
        [currentReviewUserId]: { ...draft }
      }));
    }
  }, [currentReviewUserId, draftCache, completedUsers]);

  // ========== 辅助函数 ==========
  const getAllSelectedUserList = useMemo(() => {
    return users.filter(u => selectedUserIds.has(u.id));
  }, [users, selectedUserIds]);

  const getNextAllSelectedUser = useCallback(() => {
    const list = getAllSelectedUserList;
    if (list.length === 0) return null;
    const currentIndex = list.findIndex(item => item.id === currentReviewUserId);
    const nextIndex = (currentIndex + 1) % list.length;
    return list[nextIndex];
  }, [getAllSelectedUserList, currentReviewUserId]);

  const getPrevAllSelectedUser = useCallback(() => {
    const list = getAllSelectedUserList;
    if (list.length === 0) return null;
    const currentIndex = list.findIndex(item => item.id === currentReviewUserId);
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    return list[prevIndex];
  }, [getAllSelectedUserList, currentReviewUserId]);

  const hasLocalDraft = useCallback((userId: string) => {
    return !completedUsers.has(userId) && !!draftCache[userId];
  }, [completedUsers, draftCache]);

  const getProgress = useCallback(() => {
    const total = selectedUserIds.size;
    const completed = Array.from(completedUsers).filter(id => selectedUserIds.has(id)).length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, percentage };
  }, [selectedUserIds, completedUsers]);

  // ========== 核心操作 ==========
  const saveDraftToCache = useCallback((userId: string) => {
    const userData = allReviewData[userId];
    if (!userData) return;
    const isValid = isValidDraftData(userData);
    setDraftCache(prev => {
      const newCache = { ...prev };
      if (isValid) newCache[userId] = { ...userData };
      else delete newCache[userId];
      return newCache;
    });
  }, [allReviewData]);

  const submitReview = useCallback(async (userId: string) => {
    const userData = allReviewData[userId];
    if (!userData) throw new Error('用户数据不存在');

    const allTouched = isAllDimensionTouched(userData);
    if (!allTouched) {
      toast.error('请完成所有维度评分（每个维度至少点击一次星星）');
      throw new Error('未完成所有维度');
    }

    const contentData: Record<string, any> = {};
    DIMENSIONS.forEach(dim => {
      contentData[dim] = { score: userData.scores[dim], note: userData.notes[dim] };
    });

    const currentUser = users.find(u => u.id === userId);
    const reviewPayload = {
      cycle_id: selectedCycle,
      from_user: profile!.id,
      to_user: userId,
      content: JSON.stringify(contentData),
      to_user_name: currentUser?.display_name || currentUser?.username || '',
    };

    const existing = await pb.collection('reviews').getList(1, 1, {
      filter: `cycle_id="${selectedCycle}"&&from_user="${profile!.id}"&&to_user="${userId}"`,
    });

    if (existing.items.length > 0) {
      await pb.collection('reviews').update(existing.items[0].id, reviewPayload);
    } else {
      await pb.collection('reviews').create(reviewPayload);
    }

    setCompletedUsers(prev => new Set(prev).add(userId));
    setDraftCache(prev => {
      const newCache = { ...prev };
      delete newCache[userId];
      return newCache;
    });

    toast.success(`✅ 已提交对 ${currentUser?.display_name} 的评价`);
    return true;
  }, [allReviewData, users, selectedCycle, profile]);

  const preSwitchUserHandle = useCallback(async (targetUserId: string) => {
    if (!currentReviewUserId) return;
    const userData = allReviewData[currentReviewUserId];
    if (!userData) return;
    if (completedUsers.has(currentReviewUserId)) return;

    const allComplete = isAllDimensionTouched(userData);
    if (allComplete) {
      setSubmitting(true);
      try {
        await submitReview(currentReviewUserId);
      } catch (err) {
        throw err;
      } finally {
        setSubmitting(false);
      }
    } else {
      saveDraftToCache(currentReviewUserId);
    }
  }, [currentReviewUserId, allReviewData, completedUsers, submitReview, saveDraftToCache]);

  const switchUserWithDraft = useCallback(async (nextUserId: string) => {
    if (submitting) return;
    if (nextUserId === currentReviewUserId) return;
    try {
      await preSwitchUserHandle(nextUserId);
      setCurrentReviewUserId(nextUserId);
      setFlashFeedback(true);
      setTimeout(() => setFlashFeedback(false), 300);
    } catch {
      toast.error('自动提交失败，请手动提交后再切换');
    }
  }, [preSwitchUserHandle, currentReviewUserId, submitting]);

  const handleSubmit = useCallback(async (saveAndNext: boolean = false) => {
    if (!currentReviewUserId) return;
    setSubmitting(true);
    try {
      await submitReview(currentReviewUserId);
      if (saveAndNext) {
        const next = getNextAllSelectedUser();
        if (next) {
          await switchUserWithDraft(next.id);
        } else {
          toast.success('🎉 已完成所有评价！');
        }
      }
    } catch {
      // 错误已在 submitReview 中提示
    } finally {
      setSubmitting(false);
    }
  }, [currentReviewUserId, submitReview, getNextAllSelectedUser, switchUserWithDraft]);

  const goSelectPage = useCallback(async () => {
    if (currentReviewUserId && !completedUsers.has(currentReviewUserId)) {
      saveDraftToCache(currentReviewUserId);
    }
    setCurrentStep('select');
  }, [currentReviewUserId, completedUsers, saveDraftToCache]);

  // ========== 用户选择相关 ==========
  const handleToggleUser = useCallback((userId: string) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) newSet.delete(userId);
      else newSet.add(userId);
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedUserIds(prev => {
      if (prev.size === users.length) return new Set();
      return new Set(users.map(u => u.id));
    });
  }, [users]);

  const handleStartReview = useCallback(() => {
    if (selectedUserIds.size === 0) {
      toast.error('请至少选择一位评价对象');
      return;
    }
    const list = getAllSelectedUserList;
    if (list.length > 0) setCurrentReviewUserId(list[0].id);
    setCurrentStep('review');
  }, [selectedUserIds, getAllSelectedUserList]);

  // ========== 键盘事件（A/D切换） ==========
  useEffect(() => {
    if (currentStep !== 'review') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (submitting) return;
      const key = e.key.toLowerCase();
      if (key === 'a' || key === 'd') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        const now = Date.now();
        if (now - lastSwitchTimeRef.current < 100) return;
        if (key === 'd') {
          const next = getNextAllSelectedUser();
          if (next) {
            switchUserWithDraft(next.id);
            lastSwitchTimeRef.current = now;
          }
        } else if (key === 'a') {
          const prev = getPrevAllSelectedUser();
          if (prev) {
            switchUserWithDraft(prev.id);
            lastSwitchTimeRef.current = now;
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, submitting, getNextAllSelectedUser, getPrevAllSelectedUser, switchUserWithDraft]);

  useEffect(() => {
    if (prevSelectedUserIdsRef.current.size !== selectedUserIds.size) {
      prevSelectedUserIdsRef.current = selectedUserIds;
    }
  }, [selectedUserIds]);

  if (!profile) return <div className="flex items-center justify-center h-64"><p>请先登录</p></div>;

  const progress = getProgress();
  const currentUser = users.find(u => u.id === currentReviewUserId);
  const isAllSelected = users.length > 0 && selectedUserIds.size === users.length;

  const ShortcutHint = () => (
    <span className="text-[10px] text-slate-400 ml-2 select-none cursor-default">
      (W↑/S↓)
    </span>
  );

  return (
    // ====== 关键修改：最外层固定视口高度，flex列，禁止滚动 ======
    <div className="flex flex-col h-screen bg-slate-50 select-none outline-none" style={{ outline: 'none' }}>
      <style>{`
        *:focus:not(:focus-visible) {
          outline: none !important;
        }
        *:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }
      `}</style>

      {/* ========== 顶部主标题栏（固定） ========== */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 select-none cursor-default">填写评价</h1>
              <p className="text-xs text-slate-500 select-none cursor-default">A/D切换 未完成评价仅保存本地草稿</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800 select-none cursor-default">评价周期</span>
            {loadingCycles ? (
              <Skeleton className="h-9 w-36" />
            ) : (
              <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                <SelectTrigger className="w-40 h-9 border-slate-300 text-sm font-medium text-slate-900 bg-white shadow-sm">
                  <SelectValue placeholder="选择月份" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-medium select-none cursor-default">{c.name}</span>
                      {isCurrentMonth(c) && <Badge variant="secondary" className="ml-2 text-xs bg-blue-100 text-blue-700 border-0">本月</Badge>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {currentStep === 'review' && (
            <>
              <div className="h-6 w-px bg-slate-200 hidden md:block" />
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 select-none cursor-default">正在评价</span>
                  <span className="text-sm font-semibold text-slate-900 w-32 truncate select-none cursor-default" title={currentUser?.display_name}>
                    {currentUser?.display_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-28"><Progress value={progress.percentage} className="h-2" /></div>
                  <span className="text-sm font-bold text-slate-900 select-none cursor-default">{progress.completed}/{progress.total}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========== 内容区域：flex-1撑满剩余高度，overflow-hidden禁止整体滚动 ========== */}
      <div className="flex-1 overflow-hidden p-5">
        <AnimatePresence mode="wait">
          {currentStep === 'select' ? (
            // ---------- 选择评价对象 ----------
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col"
            >
              <div className="shrink-0 bg-white rounded-t-xl border border-slate-200 border-b-0 shadow-sm overflow-hidden">
                <div className="bg-blue-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-white" />
                      <h2 className="text-base font-bold text-white select-none cursor-default">选择评价对象</h2>
                    </div>
                    <Button
                      onClick={handleStartReview}
                      disabled={selectedUserIds.size === 0}
                      className="gap-2 bg-white text-blue-600 hover:bg-blue-50 h-9 text-sm shadow-md focus:outline-none"
                    >
                      开始评价 <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <motion.div
                    key={`select-all-${selectedUserIds.size}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 cursor-pointer select-none shadow-sm"
                    whileHover={{ scale: 1.01, backgroundColor: '#f8fafc' }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleSelectAll}
                  >
                    <div className="flex items-center gap-3">
                      {isAllSelected ? (
                        <CheckSquare className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-400" />
                      )}
                      <span className="font-medium text-slate-900 text-sm select-none cursor-default">
                        {isAllSelected ? '取消全选' : '全选'}
                      </span>
                    </div>
                    <Badge variant="secondary" className="px-2.5 py-1 text-sm bg-blue-100 text-blue-700 select-none cursor-default">
                      已选 {selectedUserIds.size} 人
                    </Badge>
                  </motion.div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-white rounded-b-xl border border-slate-200 border-t-0 shadow-sm p-5">
                {loadingUsers ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Users className="h-12 w-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 select-none cursor-default">暂无可评价人员</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {users.map(user => {
                      const isSelected = selectedUserIds.has(user.id);
                      const isCompleted = completedUsers.has(user.id);
                      const hasDraft = hasLocalDraft(user.id);
                      const borderClass = isSelected
                        ? hasDraft
                          ? 'border-2 border-red-600 bg-red-50 shadow-red-200'
                          : 'border-2 border-blue-500 shadow-blue-100'
                        : 'border border-slate-200 hover:border-blue-300 bg-white';

                      return (
                        <motion.div
                          key={user.id}
                          whileHover={{ scale: 1.015 }}
                          whileTap={{ scale: 0.985 }}
                          className={`relative p-4 rounded-lg cursor-pointer transition-all ${borderClass}`}
                          onClick={() => handleToggleUser(user.id)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none focus:outline-none"
                            />
                            {isCompleted ? (
                              <Badge className="bg-green-100 text-green-700 text-sm font-bold px-2 py-1 select-none cursor-default">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />已评价
                              </Badge>
                            ) : hasDraft ? (
                              <Badge className="bg-red-600 text-white text-sm font-bold px-2 py-1 shadow-sm select-none cursor-default">
                                <AlertCircle className="h-3.5 w-3.5 mr-1" />草稿未完成
                              </Badge>
                            ) : null}
                          </div>
                          <p className="font-semibold text-base text-slate-900 select-none cursor-default">{user.display_name}</p>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            // ---------- 评价填写 ----------
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <div className="flex gap-5 h-full">
                {/* 左侧：固定列表 — 使用 h-full 和内部滚动 */}
                {/* 左侧：固定列表 */}
                <div className="w-1/4 min-w-[200px] h-full">
                  <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col h-full">
                    {/* 标题区域 - 优化布局 */}
                    <div className="bg-blue-600 px-5 py-3 shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Users className="h-4 w-4 text-white shrink-0" />
                          <h2 className="text-sm font-bold text-white select-none cursor-default whitespace-nowrap">
                            评价对象
                          </h2>
                          <span className="text-[10px] text-white/60 select-none cursor-default whitespace-nowrap">
                            (A/D)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={goSelectPage}
                          className="gap-1 text-white hover:bg-white/10 h-7 px-2 text-sm focus:outline-none shrink-0"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> 返回
                        </Button>
                      </div>
                    </div>

                    {/* 用户列表 */}
                    <div className="flex-1 overflow-y-auto p-3 bg-slate-50">
                      <div className="space-y-2">
                        {users.filter(u => selectedUserIds.has(u.id)).map(user => {
                          const isCompleted = completedUsers.has(user.id);
                          const isCurrent = user.id === currentReviewUserId;
                          const hasDraft = hasLocalDraft(user.id);
                          const userData = allReviewData[user.id];
                          const touchedCount = userData ? DIMENSIONS.filter(dim => userData.touched[dim]).length : 0;
                          const totalDimensions = DIMENSIONS.length;
                          const progressText = isCompleted ? '已完成' : `${touchedCount}/${totalDimensions}`;
                          const progressColor = isCompleted ? 'text-green-600' : touchedCount === totalDimensions ? 'text-green-600' : 'text-slate-500';

                          const itemClass = isCurrent
                            ? 'bg-blue-50 border-2 border-blue-500 shadow-sm'
                            : isCompleted
                              ? 'bg-green-50 hover:bg-green-100 border border-slate-200'
                              : hasDraft
                                ? 'bg-red-50 hover:bg-red-100 border-2 border-red-500'
                                : 'bg-white hover:bg-slate-100 border border-slate-200';

                          return (
                            <motion.button
                              key={user.id}
                              onClick={() => switchUserWithDraft(user.id)}
                              disabled={submitting}
                              className={`w-full flex items-center gap-2.5 p-3 rounded-lg transition-all text-left ${itemClass} focus:outline-none`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className={`h-4 w-4 ${isCurrent ? 'text-blue-600' : 'text-green-600'} shrink-0`} />
                              ) : hasDraft ? (
                                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                              ) : (
                                <Circle className={`h-4 w-4 ${isCurrent ? 'text-blue-500' : 'text-slate-400'} shrink-0`} />
                              )}
                              <span className="font-medium text-sm text-slate-900 truncate flex-1">
                                {user.display_name}
                              </span>
                              <span className={`text-xs shrink-0 ${progressColor}`}>
                                {progressText}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* 右侧：滚动内容 */}
                <div className="flex-1 min-h-0">
                  <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50">
                      {!currentUser ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                          <Users className="h-12 w-12 text-slate-300 mb-3" />
                          <span className="select-none cursor-default">请从左侧选择要评价的成员</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {DIMENSIONS.map((dim, idx) => {
                            const userData = allReviewData[currentUser.id];
                            const score = userData.scores[dim];
                            const touched = userData.touched[dim];

                            return (
                              <motion.div
                                key={dim}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm"
                              >
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <label className="text-base font-semibold text-slate-900 flex items-center gap-2 select-none cursor-default">
                                      <Target className="h-4 w-4 text-blue-600" />
                                      {DIMENSION_LABELS[dim]}
                                      {!touched && <span className="text-xs text-red-500">*未填写</span>}
                                      <ShortcutHint />
                                    </label>
                                    <DimensionHelpPopover dimension={dim}>
                                      <button
                                        className="text-blue-500 hover:text-blue-700 transition-colors cursor-pointer focus:outline-none"
                                        type="button"
                                      >
                                        <Info className="h-4 w-4" />
                                      </button>
                                    </DimensionHelpPopover>
                                  </div>
                                  <StarRating
                                    value={score}
                                    onChange={(newScore) => {
                                      setAllReviewData(prev => ({
                                        ...prev,
                                        [currentUser.id]: {
                                          ...prev[currentUser.id],
                                          scores: { ...prev[currentUser.id].scores, [dim]: newScore },
                                          touched: { ...prev[currentUser.id].touched, [dim]: true }
                                        }
                                      }));
                                    }}
                                    touched={touched}
                                  />
                                </div>

                                <RatingDisplay score={score} touched={touched} />

                                {touched && (
                                  <HelpContent dimension={dim} score={score} touched={touched} />
                                )}

                                <Textarea
                                  placeholder="请输入评价说明（可选）"
                                  value={userData.notes[dim]}
                                  onChange={(e) => {
                                    setAllReviewData(prev => ({
                                      ...prev,
                                      [currentUser.id]: {
                                        ...prev[currentUser.id],
                                        notes: { ...prev[currentUser.id].notes, [dim]: e.target.value }
                                      }
                                    }));
                                  }}
                                  className="min-h-[60px] border-slate-300 focus:border-blue-400 resize-none text-sm focus:outline-none"
                                />
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200 p-4 bg-white shrink-0">
                      <div className="flex justify-between">
                        <Button
                          variant="outline"
                          onClick={async () => {
                            const prev = getPrevAllSelectedUser();
                            if (prev) await switchUserWithDraft(prev.id);
                          }}
                          disabled={selectedUserIds.size <= 1 || submitting}
                          className="gap-2 h-9 text-sm focus:outline-none"
                        >
                          <ArrowLeft className="h-4 w-4" /> 上一位
                        </Button>
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            onClick={() => handleSubmit(false)}
                            disabled={submitting}
                            className="h-9 text-sm focus:outline-none"
                          >
                            保存正式提交
                          </Button>
                          <Button
                            onClick={() => handleSubmit(true)}
                            disabled={submitting}
                            className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-md h-9 text-sm focus:outline-none"
                          >
                            {submitting ? (
                              <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                提交中...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                提交并下一位
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}