// 用户角色
export type UserRole = 'admin' | 'reviewer' | 'reviewee_only';

// 用户档案
export interface Profile {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

// 评价周期
export interface ReviewCycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  year_month: string | null;
  created_by: string | null;
  created_at: string;
}

// 评价记录（完整，含评价人）
export interface Review {
  id: string;
  cycle_id: string;
  reviewer_id: string;
  reviewee_id: string;
  data_quality_score: number | null;
  data_quality_note: string;
  personal_efficiency_score: number | null;
  personal_efficiency_note: string;
  work_compliance_score: number | null;
  work_compliance_note: string;
  work_enthusiasm_score: number | null;
  work_enthusiasm_note: string;
  other_help_score: number | null;
  other_help_note: string;
  created_at: string;
}

// 匿名评价记录（不含评价人 ID）
export interface AnonymousReview {
  id: string;
  cycle_id: string;
  reviewee_id: string;
  data_quality_score: number | null;
  data_quality_note: string;
  personal_efficiency_score: number | null;
  personal_efficiency_note: string;
  work_compliance_score: number | null;
  work_compliance_note: string;
  work_enthusiasm_score: number | null;
  work_enthusiasm_note: string;
  other_help_score: number | null;
  other_help_note: string;
  created_at: string;
}

// 评价维度键名
export type ReviewDimensionKey =
  | 'data_quality'
  | 'personal_efficiency'
  | 'work_compliance'
  | 'work_enthusiasm'
  | 'other_help';

// 评价维度标签映射
export const DIMENSION_LABELS: Record<ReviewDimensionKey, string> = {
  data_quality: '数据质量',
  personal_efficiency: '个人效率',
  work_compliance: '服从工作安排',
  work_enthusiasm: '工作积极性',
  other_help: '其他帮助',
};

// 所有维度列表
export const DIMENSIONS: ReviewDimensionKey[] = [
  'data_quality',
  'personal_efficiency',
  'work_compliance',
  'work_enthusiasm',
  'other_help',
];

// 单个维度的填写数据
export interface DimensionData {
  score: number | null;
  note: string;
}

// 单人评价表单（5个维度）
export type ReviewFormData = Record<ReviewDimensionKey, DimensionData>;

// 角色标签
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '超级管理员',
  reviewer: '管理员',
  reviewee_only: '组员',
};

// 角色描述
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: '管理系统、用户和评价周期',
  reviewer: '可填写评价，可查看自己收到的评价，查看统计',
  reviewee_only: '只能查看自己收到的评价',
};
