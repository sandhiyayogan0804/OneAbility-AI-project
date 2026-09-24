export interface User {
  id: number;
  full_name: string;
  phone_number: string;
  email?: string | null;
  upi_id?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BankAccountSummary {
  id: number;
  bank_name: string;
  account_number_masked: string;
  account_type: string;
  ifsc_code: string;
  balance: number;
  is_primary: boolean;
}

export interface QuickActionItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  aria_label: string;
  description: string;
}

export interface TransactionSummary {
  id: number;
  reference_id: string;
  party_name: string;
  transaction_type: 'CREDIT' | 'DEBIT';
  amount: number;
  formatted_amount: string;
  currency: string;
  payment_method: string;
  status: string;
  created_at: string;
  description?: string | null;
}

export interface NotificationSummary {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface AccessibilitySettingsSummary {
  high_contrast: boolean;
  font_size_scale: string;
  voice_guidance: boolean;
  haptic_feedback: boolean;
  preferred_language: string;
}

export interface DashboardHomeData {
  greeting: string;
  user: {
    id: number;
    full_name: string;
    phone_number: string;
    email?: string | null;
    upi_id?: string | null;
  };
  balance: {
    total_balance: number;
    currency: string;
    currency_symbol: string;
    formatted_balance: string;
  };
  primary_account?: BankAccountSummary | null;
  linked_accounts_count: number;
  linked_accounts: BankAccountSummary[];
  quick_actions: QuickActionItem[];
  recent_transactions: TransactionSummary[];
  notifications: NotificationSummary[];
  unread_notifications_count: number;
  accessibility: AccessibilitySettingsSummary;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Beneficiary {
  id: number;
  name: string;
  nickname?: string | null;
  upi_id?: string | null;
  phone_number?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  is_favorite: boolean;
  created_at: string;
}

export interface VerifyRecipientResponse {
  identifier: string;
  name: string;
  upi_id?: string | null;
  phone_number?: string | null;
  is_verified: boolean;
  bank_handle?: string | null;
}

export interface PaymentExecuteRequest {
  recipient_type: 'CONTACT' | 'UPI_ID' | 'BENEFICIARY';
  recipient_name: string;
  recipient_identifier: string;
  amount: number;
  description?: string;
  simulate_failure?: boolean;
}

export interface PaymentResultResponse {
  status: 'SUCCESS' | 'FAILED';
  reference_id: string;
  amount: number;
  formatted_amount: string;
  currency: string;
  payment_method: string;
  recipient_name: string;
  recipient_identifier: string;
  sender_bank: string;
  sender_account_masked: string;
  created_at: string;
  message: string;
  remaining_balance: number;
}

export interface TransactionDetail {
  id: number;
  reference_id: string;
  party_name: string;
  transaction_type: 'CREDIT' | 'DEBIT';
  amount: number;
  formatted_amount: string;
  currency: string;
  payment_method: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  description?: string | null;
  sender_name: string;
  sender_bank_name?: string | null;
  sender_account_masked?: string | null;
  receiver_name?: string | null;
  receiver_bank_name?: string | null;
  receiver_account_masked?: string | null;
}

export interface TransactionFilterOptions {
  search?: string;
  status?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface QRParsedData {
  is_valid_upi: boolean;
  error_message?: string | null;
  upi_id?: string | null;
  recipient_name?: string | null;
  amount?: number | null;
  formatted_amount?: string | null;
  currency: string;
  transaction_note?: string | null;
  merchant_code?: string | null;
  raw_qr: string;
}

export interface ExtractedPaymentRecipient {
  name?: string | null;
  identifier?: string | null;
  matched_beneficiary_id?: number | null;
  is_saved_contact: boolean;
}

export interface VoiceCommandRequest {
  text: string;
  language?: string;
}

export interface VoiceNLPResponse {
  raw_transcript: string;
  intent: 'SEND_MONEY' | 'CHECK_BALANCE' | 'VIEW_HISTORY' | 'UNKNOWN';
  confidence: number;
  recipient?: ExtractedPaymentRecipient | null;
  amount?: number | null;
  formatted_amount?: string | null;
  currency: string;
  is_complete: boolean;
  missing_fields: string[];
  clarification_prompt?: string | null;
  spoken_response: string;
  action_suggested?: 'PROCEED_TO_REVIEW' | 'ASK_AMOUNT' | 'ASK_RECIPIENT' | 'VIEW_BALANCE' | 'VIEW_HISTORY' | 'PAY_BILL' | 'UNKNOWN';
}

export interface PaymentSafetyCheckRequest {
  recipient_type: 'CONTACT' | 'UPI_ID' | 'BENEFICIARY' | 'QR';
  recipient_identifier: string;
  recipient_name?: string | null;
  amount: number;
  source?: 'MANUAL' | 'VOICE' | 'QR';
  description?: string | null;
}

export interface PaymentSafetyCheckResponse {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_score: number;
  risk_flags: string[];
  is_safe_to_proceed: boolean;
  requires_strong_confirmation: boolean;
  recommended_action: 'ALLOW' | 'CONFIRM_WITH_WARNING' | 'BLOCK';
  warning_title?: string | null;
  warning_message?: string | null;
  safety_tips: string[];
  details: Record<string, any>;
}

export interface AccessibilityPreferences {
  user_id?: number;
  high_contrast: boolean;
  font_size_scale: 'normal' | 'medium' | 'large' | 'x-large';
  screen_reader_optimized: boolean;
  voice_guidance: boolean;
  haptic_feedback: boolean;
  simple_mode: boolean;
  reduced_motion: boolean;
  captions_enabled: boolean;
  color_blind_mode: string;
  preferred_language: 'en' | 'ta' | 'mixed';
  updated_at?: string | null;
}

export interface BillerOption {
  id: string;
  name: string;
  category: string;
  icon: string;
  input_label: string;
  input_placeholder: string;
  quick_amounts: number[];
  regex_pattern?: string | null;
  validation_hint?: string | null;
}

export interface BillCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  billers: BillerOption[];
}

export interface BillFetchRequest {
  category: string;
  biller_id: string;
  account_number: string;
}

export interface BillFetchResponse {
  category: string;
  biller_id: string;
  biller_name: string;
  account_number: string;
  consumer_name: string;
  bill_amount?: number | null;
  due_date?: string | null;
  bill_period?: string | null;
  is_amount_editable: boolean;
  metadata?: Record<string, any>;
}

export interface BillPaymentRequest {
  category: string;
  biller_id: string;
  biller_name: string;
  account_number: string;
  consumer_name?: string | null;
  amount: number;
  convenience_fee?: number;
  simulate_failure?: boolean;
  payment_method?: string;
  bill_metadata?: Record<string, any>;
}

export interface BillPaymentResponse {
  id: number;
  reference_id: string;
  category: string;
  biller_id: string;
  biller_name: string;
  account_number: string;
  consumer_name?: string | null;
  amount: number;
  convenience_fee: number;
  total_amount: number;
  formatted_total: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  transaction_reference_id?: string | null;
  debit_bank: string;
  debit_account_masked: string;
  remaining_balance: number;
  created_at: string;
  bill_details?: Record<string, any> | null;
}

export type NotificationType =
  | 'TRANSACTION'
  | 'BILL_PAYMENT'
  | 'SECURITY'
  | 'SAFETY_WARNING'
  | 'SYSTEM'
  | 'INFO';

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: NotificationType | string;
  is_read: boolean;
  created_at: string;
  formatted_time?: string;
  icon?: string;
}

export interface UnreadCountResponse {
  unread_count: number;
}

export interface NotificationActionResponse {
  success: boolean;
  message: string;
  updated_count: number;
  unread_count?: number;
  notification?: NotificationItem;
}

export interface NotificationFilterParams {
  is_read?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}
