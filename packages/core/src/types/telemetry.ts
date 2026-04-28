/**
 * Telemetry type definitions
 */

// ============================================
// Raw Telemetry Data Types
// ============================================

export interface PerfRawData {
  timestamp: number;
  version: string;
  platform: string;
  arch?: string;
  metric: string;
  value_ms: number;
  session_id?: string;
}

export interface ConversationRawData {
  timestamp: number;
  version: string;
  platform: string;
  arch?: string;
  session_id: string;
  model_id: string;
  model_provider?: string;
  status: "success" | "error" | "user_cancel";
  duration_ms: number;
  tokens_used?: number;
  input_tokens?: number;
  output_tokens?: number;
  error_code?: string;
}

export interface InstallRawData {
  install_id: string;
  timestamp: number;
  version: string;
  platform: string;
  arch?: string;
  status: "success" | "failed";
  duration_ms: number;
  install_type?: "fresh" | "update";
  previous_version?: string;
  error_message?: string;
}

// ============================================
// Telemetry Upload Request Types
// ============================================

export interface TelemetryBatchRequest {
  perf?: PerfRawData[];
  conversations?: ConversationRawData[];
  installs?: InstallRawData[];
}

export interface TelemetryPerfRequest extends PerfRawData {}
export interface TelemetryConversationRequest extends ConversationRawData {}
export interface TelemetryInstallRequest extends InstallRawData {}

// ============================================
// Daily Aggregation Types
// ============================================

export interface PerfDailyAgg {
  date: string;
  version: string;
  platform: string;
  arch: string;
  metric: string;
  p50: number;
  p90: number;
  p95: number;
  p99?: number;
  min_value: number;
  max_value: number;
  avg_value: number;
  count: number;
}

export interface ConversationsDailyAgg {
  date: string;
  version: string;
  platform: string;
  arch: string;
  success_count: number;
  error_count: number;
  user_cancel_count: number;
  total_count: number;
  avg_duration_ms: number;
  avg_tokens?: number;
  success_rate: number;
  error_rate: number;
}

export interface InstallDailyAgg {
  date: string;
  version: string;
  platform: string;
  arch: string;
  install_type: string;
  success_count: number;
  failed_count: number;
  total_count: number;
  avg_duration_ms: number;
  success_rate: number;
}

// ============================================
// Dashboard Summary Types
// ============================================

export interface PerfSummary {
  metric: string;
  p50: number;
  p90: number;
  p95: number;
  p99?: number;
  avg: number;
  count: number;
  trend: number; // percentage change from previous period
}

export interface ConversationSummary {
  total: number;
  success: number;
  error: number;
  user_cancel: number;
  success_rate: number;
  avg_duration_ms: number;
  avg_tokens: number;
  trend: number;
}

export interface InstallSummary {
  total: number;
  success: number;
  failed: number;
  success_rate: number;
  avg_duration_ms: number;
  by_version: { version: string; count: number }[];
  by_platform: { platform: string; count: number }[];
}

export interface DashboardOverview {
  period: {
    start: number;
    end: number;
  };
  conversations: ConversationSummary;
  errors: {
    total: number;
    error_rate: number;
    top_errors: { error_code: string; count: number; trend: number; last_occurrence: number }[];
  };
  performance: {
    metrics: PerfSummary[];
  };
  installs: InstallSummary;
}

// ============================================
// Query Types
// ============================================

export interface TimeRangeQuery {
  start_time?: number;
  end_time?: number;
  version?: string;
  platform?: string;
}

export interface PerfQuery extends TimeRangeQuery {
  metric?: string;
}

export interface ConversationQuery extends TimeRangeQuery {
  status?: string;
  model_id?: string;
}

export interface InstallQuery extends TimeRangeQuery {
  install_type?: string;
  status?: string;
}

// ============================================
// Trend Data Types
// ============================================

export interface TrendDataPoint {
  timestamp: number;
  value: number;
}

export interface PerfTrend {
  metric: string;
  data: TrendDataPoint[];
}

export interface ConversationTrend {
  data: {
    timestamp: number;
    total: number;
    success: number;
    error: number;
  }[];
}