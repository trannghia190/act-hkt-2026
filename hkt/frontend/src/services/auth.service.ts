import { apiClient, ApiResponse } from './api.client';
import { SmtpConfigPayload, SmtpStatusResponse } from '../types/auth.types';

export const authService = {
  login: async (employeeCodeOrEmail: string, password: string) => {
    return apiClient.post('/auth/login', { employeeCodeOrEmail, password });
  },

  requestPasswordReset: async (email: string): Promise<ApiResponse<string>> => {
    return apiClient.post('/auth/reset-password-request', { email });
  },

  getSmtpStatus: async (): Promise<ApiResponse<SmtpStatusResponse>> => {
    return apiClient.get('/auth/smtp-status');
  },

  configureSmtp: async (payload: SmtpConfigPayload): Promise<ApiResponse<boolean>> => {
    return apiClient.post('/auth/config-smtp', payload);
  },

  testEmail: async (targetEmail: string, message: string): Promise<ApiResponse<boolean>> => {
    return apiClient.post('/auth/test-email', { targetEmail, message });
  },

  sendNotification: async (payload: {
    toEmail: string;
    fullName: string;
    requestId: string;
    requestType: string;
    decision: 'APPROVED' | 'REJECTED';
    approverName: string;
    approverComment?: string;
  }): Promise<ApiResponse<boolean>> => {
    return apiClient.post('/auth/send-notification', payload);
  }
};
