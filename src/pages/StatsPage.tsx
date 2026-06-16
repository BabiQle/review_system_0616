import { useState, useEffect } from 'react';
import { pb } from '@/db/pb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  BarChart3,
  TrendingUp,
  Star,
  Target,
  Award,
  ArrowUp,
  ArrowDown,
  Minus,
  Download,
  PenTool,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from 'recharts';
import { DIMENSION_LABELS, DIMENSIONS } from '@/types/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

interface MonthCycle {
  id: string;
  name: string;
  is_active: boolean;
  start_date: string;
}

interface PersonStat {
  userId: string;
  userName: string;
  avgScore: number;
  reviewCount: number;
  dimensionScores: Record<string, number>;
  rank?: number;
  trend?: 'up' | 'down' | 'same';
}

export default function StatsPage() {
  const { profile } = useAuth();
  const canAccess = profile?.role === 'admin' || profile?.role === 'reviewer';

  const [cycles, setCycles] = useState<MonthCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [userStats, setUserStats] = useState<PersonStat[]>([]);
  const [reviewerStats, setReviewerStats] = useState<PersonStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartAnimKey, setChartAnimKey] = useState(0);

  // 导出 Excel（同时导出被评价者和评价者数据）
  const exportToExcel = () => {
    if (userStats.length === 0 && reviewerStats.length === 0) {
      toast.info('没有数据可导出');
      return;
    }
    const wb = XLSX.utils.book_new();

    // 被评价者统计
    if (userStats.length > 0) {
      const data1 = userStats.map((stat, idx) => ({
        序号: idx + 1,
        姓名: stat.userName,
        平均分: stat.avgScore.toFixed(2),
        收到评价条数: stat.reviewCount,
        ...DIMENSIONS.reduce((acc, dim) => {
          acc[DIMENSION_LABELS[dim]] = (stat.dimensionScores[dim] / stat.reviewCount || 0).toFixed(1);
          return acc;
        }, {} as Record<string, string>),
      }));
      const ws1 = XLSX.utils.json_to_sheet(data1);
      XLSX.utils.book_append_sheet(wb, ws1, '被评价者统计');
    }

    // 评价者统计
    if (reviewerStats.length > 0) {
      const data2 = reviewerStats.map((stat, idx) => ({
        序号: idx + 1,
        姓名: stat.userName,
        评价条数: stat.reviewCount,
        平均分: stat.avgScore.toFixed(2),
        ...DIMENSIONS.reduce((acc, dim) => {
          acc[DIMENSION_LABELS[dim]] = (stat.dimensionScores[dim] / stat.reviewCount || 0).toFixed(1);
          return acc;
        }, {} as Record<string, string>),
      }));
      const ws2 = XLSX.utils.json_to_sheet(data2);
      XLSX.utils.book_append_sheet(wb, ws2, '评价者统计');
    }

    XLSX.writeFile(
      wb,
      `评价统计_${selectedCycle}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    toast.success('导出成功');
  };

  // 加载评价周期
  useEffect(() => {
    const loadCycles = async () => {
      try {
        const result = await pb.collection('month_cycles').getList<Record<string, any>>(1, 20, {
          sort: '-start_date',
        });
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

  // 加载统计数据（同时计算被评价者和评价者）
  useEffect(() => {
    if (!selectedCycle || !profile) return;
    const loadStats = async () => {
      setLoading(true);
      try {
        const reviewsResult = await pb.collection('reviews').getList<Record<string, any>>(1, 500, {
          sort: '-created',
        });
        const filteredReviews = reviewsResult.items.filter((r) => {
          const cycleId = typeof r.cycle_id === 'string' ? r.cycle_id : r.cycle_id?.id;
          return cycleId === selectedCycle;
        });

        // 收集所有用户ID（包括from和to）
        const userIds = new Set<string>();
        filteredReviews.forEach((r) => {
          if (r.to_user) userIds.add(r.to_user);
          if (r.from_user) userIds.add(r.from_user);
        });

        const usersMap = new Map<string, { name: string; role: string }>();
        if (userIds.size > 0) {
          const usersResult = await pb.collection('users').getList<Record<string, any>>(1, 200);
          usersResult.items.forEach((user) => {
            usersMap.set(user.id, {
              name: user.display_name || user.username || '未知',
              role: user.role || 'reviewee_only',
            });
          });
        }

        // ---- 被评价者统计（to_user） ----
        const statsMap = new Map<string, PersonStat>();
        filteredReviews.forEach((r) => {
          const toUserId = r.to_user;
          if (!toUserId) return;
          let content: Record<string, any> = {};
          try {
            content = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
          } catch {}

          if (!statsMap.has(toUserId)) {
            statsMap.set(toUserId, {
              userId: toUserId,
              userName: usersMap.get(toUserId)?.name || '未知',
              avgScore: 0,
              reviewCount: 0,
              dimensionScores: {},
            });
          }

          const userStat = statsMap.get(toUserId)!;
          userStat.reviewCount++;
          DIMENSIONS.forEach((dim) => {
            const score = content[dim]?.score || 0;
            if (!userStat.dimensionScores[dim]) userStat.dimensionScores[dim] = 0;
            userStat.dimensionScores[dim] += score;
          });
        });

        const statsArray = Array.from(statsMap.values()).map((stat) => {
          const totalScore = Object.values(stat.dimensionScores).reduce((sum, s) => sum + s, 0);
          const avgScore = stat.reviewCount > 0 ? totalScore / (stat.reviewCount * DIMENSIONS.length) : 0;
          return { ...stat, avgScore };
        });
        statsArray.sort((a, b) => b.avgScore - a.avgScore);
        const rankedStats = statsArray.map((stat, index) => ({ ...stat, rank: index + 1 }));
        setUserStats(rankedStats);

        // ---- 评价者统计（from_user），仅统计 admin 和 reviewer ----
        const reviewerMap = new Map<string, PersonStat>();
        filteredReviews.forEach((r) => {
          const fromUserId = r.from_user;
          if (!fromUserId) return;
          // 只统计角色为 admin 或 reviewer 的评价者
          const userInfo = usersMap.get(fromUserId);
          if (!userInfo || !['admin', 'reviewer'].includes(userInfo.role)) return;

          let content: Record<string, any> = {};
          try {
            content = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
          } catch {}

          if (!reviewerMap.has(fromUserId)) {
            reviewerMap.set(fromUserId, {
              userId: fromUserId,
              userName: userInfo.name,
              avgScore: 0,
              reviewCount: 0,
              dimensionScores: {},
            });
          }

          const reviewerStat = reviewerMap.get(fromUserId)!;
          reviewerStat.reviewCount++;
          DIMENSIONS.forEach((dim) => {
            const score = content[dim]?.score || 0;
            if (!reviewerStat.dimensionScores[dim]) reviewerStat.dimensionScores[dim] = 0;
            reviewerStat.dimensionScores[dim] += score;
          });
        });

        const reviewerArray = Array.from(reviewerMap.values()).map((stat) => {
          const totalScore = Object.values(stat.dimensionScores).reduce((sum, s) => sum + s, 0);
          const avgScore = stat.reviewCount > 0 ? totalScore / (stat.reviewCount * DIMENSIONS.length) : 0;
          return { ...stat, avgScore };
        });
        reviewerArray.sort((a, b) => b.avgScore - a.avgScore);
        const rankedReviewers = reviewerArray.map((stat, index) => ({ ...stat, rank: index + 1 }));
        setReviewerStats(rankedReviewers);

        setChartAnimKey((prev) => prev + 1);
      } catch (err) {
        toast.error('加载统计数据失败');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [selectedCycle, profile]);

  // 整体统计（仅针对被评价者）
  const getOverallStats = () => {
    const totalReviews = userStats.reduce((sum, s) => sum + s.reviewCount, 0);
    const totalScore = userStats.reduce((sum, s) => sum + s.avgScore * s.reviewCount, 0);
    const avgScore = totalReviews > 0 ? totalScore / totalReviews : 0;
    return { totalReviews, participantCount: userStats.length, avgScore };
  };
  const overallStats = getOverallStats();

  // 维度平均分（被评价者）
  const getDimensionAverages = () => {
    const dimAverages: Record<string, number> = {};
    DIMENSIONS.forEach((dim) => {
      const userSingleAvgList = userStats.map((stat) => {
        const totalDimScore = stat.dimensionScores[dim] || 0;
        return stat.reviewCount > 0 ? totalDimScore / stat.reviewCount : 0;
      });
      const totalAll = userSingleAvgList.reduce((sum, val) => sum + val, 0);
      dimAverages[dim] = Number((totalAll / userSingleAvgList.length).toFixed(2));
    });
    return dimAverages;
  };
  const dimAverages = getDimensionAverages();
  const radarData = DIMENSIONS.map((dim) => ({
    subject: DIMENSION_LABELS[dim],
    score: Number(dimAverages[dim]?.toFixed(2) || 0),
    fullMark: 5,
  }));

  // 判断是否本月周期
  const getCurrentMonthBadge = (cycle: MonthCycle) => {
    const now = new Date();
    const startDate = new Date(cycle.start_date || '');
    return (
      startDate.getMonth() === now.getMonth() && startDate.getFullYear() === now.getFullYear()
    );
  };

  // 趋势图标
  const getTrendIcon = (rank: number, stats: PersonStat[]) => {
    if (rank <= 3) return <ArrowUp className="h-3.5 w-3.5 text-green-500" />;
    if (rank >= stats.length - 1 && stats.length > 3)
      return <ArrowDown className="h-3.5 w-3.5 text-red-500" />;
    return <Minus className="h-3.5 w-3.5 text-slate-400" />;
  };

  // 排名徽章样式
  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-amber-200';
    if (rank === 2) return 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-slate-200';
    if (rank === 3) return 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-orange-200';
    return 'bg-slate-100 text-slate-600';
  };

  // 根据分数获取柱状图颜色
  const getBarColor = (score: number) => {
    if (score >= 4) return '#10b981';
    if (score >= 3) return '#3b82f6';
    if (score >= 2) return '#f59e0b';
    return '#ef4444';
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataItem = rankingData.find((item) => item.name === label);
      return (
        <div className="bg-white p-2 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-slate-900">{dataItem?.fullName || label}</p>
          <p className="text-xs text-slate-600">
            平均分: <span className="font-bold text-blue-600">{payload[0].value}</span> 分
          </p>
        </div>
      );
    }
    return null;
  };

  // 排名数据（前10）
  const rankingData = userStats.slice(0, 10).map((s) => ({
    fullName: s.userName,
    name: s.userName.length > 8 ? s.userName.slice(0, 6) + '..' : s.userName,
    score: Number(s.avgScore.toFixed(2)),
  }));

  // 权限拦截
  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">仅管理员可访问此页面</p>
      </div>
    );
  }

  const roleDisplay =
    profile?.role === 'admin' ? '超级管理员' : profile?.role === 'reviewer' ? '管理员' : '';

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden select-none">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                评价统计
                {roleDisplay && (
                  <Badge
                    variant="outline"
                    className="text-xs font-normal text-slate-500 border-slate-300 bg-slate-50"
                  >
                    {roleDisplay}
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-slate-500">查看各成员的评价统计数据和详细评价记录</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                className="gap-2 h-8 text-sm border-slate-300"
              >
                <Download className="h-4 w-4" />
                导出 Excel
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 周期选择 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4"
        >
          <label className="text-sm font-medium text-slate-700">统计周期</label>
          {loadingCycles ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <Select value={selectedCycle} onValueChange={setSelectedCycle}>
              <SelectTrigger className="w-40 h-9 border-slate-300 text-sm">
                <SelectValue placeholder="选择月份" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {getCurrentMonthBadge(c) && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        本月
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </motion.div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        ) : userStats.length === 0 && reviewerStats.length === 0 ? (
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="text-center text-slate-500 py-16">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <p className="text-base">暂无评价数据</p>
              <p className="text-sm text-slate-400 mt-2">当前周期尚未收到任何评价</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 概览卡片 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-4"
            >
              <OverviewCard
                title="总评价数"
                value={overallStats.totalReviews}
                suffix="条"
                icon={<BarChart3 className="h-4 w-4 text-blue-600" />}
                color="blue"
                desc={`本月共收到 ${overallStats.totalReviews} 条评价`}
              />
              <OverviewCard
                title="被评价人数"
                value={overallStats.participantCount}
                suffix="人"
                icon={<Star className="h-4 w-4 text-amber-500" />}
                color="amber"
                desc={`共 ${overallStats.participantCount} 人收到评价`}
              />
              <OverviewCard
                title="评价者人数"
                value={reviewerStats.length}
                suffix="人"
                icon={<PenTool className="h-4 w-4 text-purple-600" />}
                color="purple"
                desc={`共 ${reviewerStats.length} 人参与评价`}
              />
              <OverviewCard
                title="评价维度"
                value={DIMENSIONS.length}
                suffix="个"
                icon={<Target className="h-4 w-4 text-emerald-600" />}
                color="emerald"
                desc={`共${DIMENSIONS.length}个评价维度`}
              />
            </motion.div>

            {/* 图表区域 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-orange-500" />
                    <CardTitle className="text-base font-bold text-slate-900">平均分排名</CardTitle>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">各成员按平均分从高到低排名（展示前10名）</p>
                </CardHeader>
                <CardContent className="p-4 h-[460px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rankingData}
                      margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
                      barGap={8}
                      barCategoryGap="15%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ angle: -20, textAnchor: 'end', fontSize: 11, fill: '#334155' }}
                        interval={0}
                        height={70}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 5]}
                        tickCount={6}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        label={{
                          value: '平均分',
                          angle: -90,
                          position: 'insideLeft',
                          style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 },
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={60} animationDuration={1500} animationEasing="ease-out">
                        {rankingData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-orange-500" />
                    <CardTitle className="text-base font-bold text-slate-900">维度分布</CardTitle>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">所有成员各维度平均评分，鼠标悬浮查看维度名称</p>
                </CardHeader>
                <CardContent className="p-4 h-[440px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData} key={chartAnimKey}>
                      <PolarGrid stroke="#e2e8f0" strokeWidth={0.8} />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 12 }} axisLine={false} />
                      <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} tick={{ fill: '#cbd5e1', fontSize: 9 }} axisLine={false} />
                      <Radar
                        name="维度"
                        dataKey="score"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fill="#3b82f6"
                        fillOpacity={0.28}
                        animationDuration={1800}
                        animationEasing="ease-out"
                        activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: '#fff', activeR: 10 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 3px 10px rgba(0,0,0,0.06)',
                          padding: '6px 10px',
                        }}
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0];
                          return item?.subject ?? '';
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* 被评价者详细统计 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">被评价者详细统计</CardTitle>
                      <p className="text-xs text-slate-500 mt-1">共 {userStats.length} 位成员收到评价</p>
                    </div>
                    <Badge variant="secondary" className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700">
                      按平均分排序
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <AnimatePresence>
                      {userStats.map((stat, index) => (
                        <motion.div
                          key={stat.userId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' }}
                          className="border border-slate-200 rounded-xl p-4 transition-all bg-white"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${getRankBadgeStyle(
                                  stat.rank || index + 1
                                )}`}
                              >
                                {stat.rank || index + 1}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-semibold text-slate-900">{stat.userName}</span>
                                  {getTrendIcon(stat.rank || index + 1, userStats)}
                                </div>
                                <p className="text-xs text-slate-500">收到 {stat.reviewCount} 条评价</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                              <span className="text-lg font-bold text-blue-700">{stat.avgScore.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {DIMENSIONS.map((dim) => {
                              const score = stat.dimensionScores[dim] || 0;
                              const percentage = (score / 5) * 100;
                              return (
                                <div key={dim} className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-600 font-medium">{DIMENSION_LABELS[dim]}</span>
                                    <span className="font-bold text-slate-900">{score.toFixed(1)}</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* 新增：评价者统计 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <PenTool className="h-5 w-5 text-purple-600" />
                        评价者统计
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-1">共 {reviewerStats.length} 位评价者参与了本周期评价</p>
                    </div>
                    <Badge variant="secondary" className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700">
                      按平均分排序
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {reviewerStats.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">暂无评价者数据</p>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {reviewerStats.map((stat, index) => (
                          <motion.div
                            key={stat.userId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                            className="border border-slate-200 rounded-xl p-4 transition-all bg-white"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${getRankBadgeStyle(
                                    stat.rank || index + 1
                                  )}`}
                                >
                                  {stat.rank || index + 1}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-semibold text-slate-900">{stat.userName}</span>
                                    {getTrendIcon(stat.rank || index + 1, reviewerStats)}
                                  </div>
                                  <p className="text-xs text-slate-500">评价了 {stat.reviewCount} 人</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 bg-purple-50 px-3 py-1.5 rounded-full">
                                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                <span className="text-lg font-bold text-purple-700">{stat.avgScore.toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              {DIMENSIONS.map((dim) => {
                                const score = stat.dimensionScores[dim] || 0;
                                const avg = stat.reviewCount > 0 ? score / stat.reviewCount : 0;
                                const percentage = (avg / 5) * 100;
                                return (
                                  <div key={dim} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-slate-600 font-medium">{DIMENSION_LABELS[dim]}</span>
                                      <span className="font-bold text-slate-900">{avg.toFixed(1)}</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}

// 概览卡片组件（支持 purple 颜色）
function OverviewCard({
  title,
  value,
  suffix,
  icon,
  color,
  desc,
}: {
  title: string;
  value: string | number;
  suffix: string;
  icon: React.ReactNode;
  color: 'blue' | 'amber' | 'emerald' | 'purple';
  desc: string;
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-xs text-slate-500 font-medium mb-1">{title}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900">{value}</span>
          <span className="text-xs text-slate-500">{suffix}</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">{desc}</p>
      </div>
      <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
    </div>
  );
}