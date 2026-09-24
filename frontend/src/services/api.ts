import type {
  AuthResponse,
  DashboardHomeData,
  User,
  Beneficiary,
  VerifyRecipientResponse,
  PaymentExecuteRequest,
  PaymentResultResponse,
  TransactionSummary,
} from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('oneability_token');
  }

  public setToken(token: string): void {
    localStorage.setItem('oneability_token', token);
  }

  public removeToken(): void {
    localStorage.removeItem('oneability_token');
  }

  public hasToken(): boolean {
    return !!this.getToken();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Request failed (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Auth Endpoints
  public async login(identifier: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    this.setToken(data.access_token);
    return data;
  }

  public async register(payload: {
    full_name: string;
    phone_number: string;
    password: string;
    email?: string;
    upi_id?: string;
  }): Promise<User> {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // Dashboard Endpoints
  public async getDashboardHome(): Promise<DashboardHomeData> {
    return this.request<DashboardHomeData>('/dashboard/home');
  }

  // Payment Endpoints
  public async getBeneficiaries(): Promise<Beneficiary[]> {
    return this.request<Beneficiary[]>('/payments/beneficiaries');
  }

  public async verifyRecipient(identifier: string, recipient_type: string = 'UPI_ID'): Promise<VerifyRecipientResponse> {
    return this.request<VerifyRecipientResponse>('/payments/verify-recipient', {
      method: 'POST',
      body: JSON.stringify({ identifier, recipient_type }),
    });
  }

  public async executePayment(payload: PaymentExecuteRequest): Promise<PaymentResultResponse> {
    return this.request<PaymentResultResponse>('/payments/execute', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getTransactions(options: import('../types').TransactionFilterOptions = {}): Promise<TransactionSummary[]> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.search) params.append('search', options.search.trim());
    if (options.status && options.status !== 'ALL') params.append('status', options.status);
    if (options.type && options.type !== 'ALL') params.append('type', options.type);
    if (options.startDate) params.append('start_date', options.startDate);
    if (options.endDate) params.append('end_date', options.endDate);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request<TransactionSummary[]>(`/transactions${queryStr}`);
  }

  public async getTransactionDetail(referenceOrId: string): Promise<import('../types').TransactionDetail> {
    return this.request<import('../types').TransactionDetail>(`/transactions/${encodeURIComponent(referenceOrId)}`);
  }

  // QR Endpoints
  public async parseQR(qrData: string): Promise<import('../types').QRParsedData> {
    return this.request<import('../types').QRParsedData>('/qr/parse', {
      method: 'POST',
      body: JSON.stringify({ qr_data: qrData }),
    });
  }

  // Voice AI Endpoints
  public async parseVoiceCommand(text: string, language: string = 'mixed'): Promise<import('../types').VoiceNLPResponse> {
    return this.request<import('../types').VoiceNLPResponse>('/voice/parse', {
      method: 'POST',
      body: JSON.stringify({ text, language }),
    });
  }

  // Payment Safety & AI Risk Endpoints
  public async checkPaymentSafety(payload: import('../types').PaymentSafetyCheckRequest): Promise<import('../types').PaymentSafetyCheckResponse> {
    return this.request<import('../types').PaymentSafetyCheckResponse>('/payments/safety-check', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Accessibility Preference Endpoints
  public async getAccessibilityPreferences(): Promise<import('../types').AccessibilityPreferences> {
    return this.request<import('../types').AccessibilityPreferences>('/accessibility/preferences');
  }

  public async updateAccessibilityPreferences(payload: Partial<import('../types').AccessibilityPreferences>): Promise<import('../types').AccessibilityPreferences> {
    return this.request<import('../types').AccessibilityPreferences>('/accessibility/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // Bills & Recharge Endpoints
  public async getBillCategories(): Promise<import('../types').BillCategory[]> {
    return this.request<import('../types').BillCategory[]>('/bills/categories');
  }

  public async getBillCategory(categoryId: string): Promise<import('../types').BillCategory> {
    return this.request<import('../types').BillCategory>(`/bills/categories/${categoryId}`);
  }

  public async fetchBillDetails(payload: import('../types').BillFetchRequest): Promise<import('../types').BillFetchResponse> {
    return this.request<import('../types').BillFetchResponse>('/bills/fetch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async executeBillPayment(payload: import('../types').BillPaymentRequest): Promise<import('../types').BillPaymentResponse> {
    return this.request<import('../types').BillPaymentResponse>('/bills/pay', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getBillHistory(): Promise<import('../types').BillPaymentResponse[]> {
    return this.request<import('../types').BillPaymentResponse[]>('/bills/history');
  }

  // Notifications API (Step 15)
  public async getNotifications(params?: import('../types').NotificationFilterParams): Promise<import('../types').NotificationItem[]> {
    const query = new URLSearchParams();
    if (params) {
      if (params.is_read !== undefined) query.append('is_read', String(params.is_read));
      if (params.type) query.append('type', params.type);
      if (params.limit !== undefined) query.append('limit', String(params.limit));
      if (params.offset !== undefined) query.append('offset', String(params.offset));
    }
    const qs = query.toString();
    return this.request<import('../types').NotificationItem[]>(`/notifications${qs ? `?${qs}` : ''}`);
  }

  public async getUnreadNotificationCount(): Promise<import('../types').UnreadCountResponse> {
    return this.request<import('../types').UnreadCountResponse>('/notifications/unread-count');
  }

  public async markNotificationAsRead(notificationId: number): Promise<import('../types').NotificationItem> {
    return this.request<import('../types').NotificationItem>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  public async markAllNotificationsAsRead(): Promise<import('../types').NotificationActionResponse> {
    return this.request<import('../types').NotificationActionResponse>('/notifications/read-all', {
      method: 'POST',
    });
  }

  // Health check
  public async getHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }
}

export const api = new ApiService();
