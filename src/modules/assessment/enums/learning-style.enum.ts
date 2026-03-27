export enum LearningStyle {
  FAST_LEARNER = 'fast_learner', // Học nhanh, ít cần retry
  STEADY_IMPROVER = 'steady_improver', // Cải thiện đều đặn
  STRUGGLING = 'struggling', // Khó khăn, cần hỗ trợ
  SURFACE_LEARNER = 'surface_learner', // Học vẹt, ít hiểu sâu
  DEEP_LEARNER = 'deep_learner', // Hiểu sâu, tư duy tốt
  PROCRASTINATOR = 'procrastinator', // Học không đều, last-minute
  PERFECTIONIST = 'perfectionist', // Retry nhiều, cầu toàn
  UNKNOWN = 'unknown', // Chưa đủ dữ liệu
}
