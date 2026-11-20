export type UserRole = 'ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface AuthUser {
  employeeCode: string;
  fullName: string;
  email: string;
  role: UserRole;
  department?: string;
  team?: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  faceEnrolled?: boolean;
  mustChangePassword?: boolean;
  status?: string;
}

export interface SmtpConfigPayload {
  host: string;
  port: number;
  username: string;
  password?: string;
}

export interface SmtpStatusResponse {
  configured: boolean;
  senderEmail: string;
  defaultHost: string;
  defaultPort: number;
}
