const API_BASE_URL = '/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  timestamp?: string;
}

class ApiClient {
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    try {
      const savedUser = localStorage.getItem('pulse_auth_user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        if (user.accessToken) {
          headers['Authorization'] = `Bearer ${user.accessToken}`;
        }
      }
    } catch (e) {
      console.error('Error reading auth token', e);
    }

    return headers;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return res.json();
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });
    return res.json();
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });
    return res.json();
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  }
}

export const apiClient = new ApiClient();
