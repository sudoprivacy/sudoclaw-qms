/**
 * Shared types
 */

export interface TelemetryEvent {
  type: 'perf' | 'error' | 'conversation' | 'install';
  timestamp: number;
  version: string;
  platform: string;
  arch?: string;
}

export interface PerfEvent extends TelemetryEvent {
  type: 'perf';
  metric: 'cold_start' | 'first_screen' | 'first_token';
  value_ms: number;
  session_id?: string;
}

export interface ErrorEvent extends TelemetryEvent {
  type: 'error';
  error_code: string;
  error_source: string;
  session_id: string;
  context?: Record<string, unknown>;
}

export interface ConversationEvent extends TelemetryEvent {
  type: 'conversation';
  session_id: string;
  model_id: string;
  model_provider?: string;
  status: 'success' | 'error' | 'user_cancel';
  duration_ms: number;
  tokens_used?: number;
  input_tokens?: number;
  output_tokens?: number;
  error_code?: string;
}

export interface InstallEvent extends TelemetryEvent {
  type: 'install';
  install_id: string;
  status: 'success' | 'failed';
  duration_ms: number;
  install_type?: 'fresh' | 'update';
  previous_version?: string;
  error_message?: string;
}

export type { TelemetryEvent as default };