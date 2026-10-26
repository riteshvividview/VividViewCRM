/**
 * VividCRM Backend API Client
 *
 * Automatically exchanges the Supabase session token for a NestJS JWT.
 * All CRM, HRMS, Invoice, and Task API calls go through this client.
 *
 * Usage:
 *   import { api } from '@/lib/api-client';
 *   const leads = await api.get('/crm/leads');
 *   const inv   = await api.post('/invoices', { ... });
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const TOKEN_KEY = 'vcrm_access_token';
const TOKEN_EXPIRY_KEY = 'vcrm_token_expiry';

// ── Token management ──────────────────────────────────────────────────────────

let _refreshPromise: Promise<string | null> | null = null;

async function getOrExchangeToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Return cached token if still valid (with 60s buffer)
  const cached = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (cached && expiry && Date.now() < Number(expiry) - 60_000) {
    return cached;
  }

  // De-duplicate concurrent exchange calls
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;

      const res = await fetch(`${API_BASE}/auth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_token: session.access_token }),
        credentials: 'include',
      });

      if (!res.ok) return null;

      const { data } = await res.json() as { data: { access_token: string; expires_in: number } };
      if (!data?.access_token) return null;

      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + data.expires_in * 1000));
      return data.access_token;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

export function clearApiToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }
}

// ── HTTP client ───────────────────────────────────────────────────────────────

interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
  requestId: string;
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  queryParams?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const token = await getOrExchangeToken();

  let url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  if (queryParams) {
    const qs = Object.entries(queryParams)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
    credentials: 'include',
  });

  const json = (await res.json()) as ApiResponse<T> | { message: string; statusCode: number; error?: string };

  if (!res.ok) {
    const err = json as { message: string; statusCode: number; error?: string };
    throw new ApiError(err.message ?? 'Request failed', res.status, err.error);
  }

  return (json as ApiResponse<T>).data;
}

// ── Convenience methods ───────────────────────────────────────────────────────

export const api = {
  get: <T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>('GET', path, undefined, params),
  post: <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = unknown>(path: string) => request<T>('DELETE', path),
};

// ── Typed API methods ─────────────────────────────────────────────────────────

// Auth
export const authApi = {
  me: () => api.get('/auth/me'),
  updateMe: (data: { full_name?: string; avatar_url?: string }) => api.patch('/auth/me', data),
};

// CRM
export const leadsApi = {
  list: (params?: Record<string, string | number | undefined>) => api.get('/crm/leads', params),
  get: (id: string) => api.get(`/crm/leads/${id}`),
  create: (data: unknown) => api.post('/crm/leads', data),
  update: (id: string, data: unknown) => api.patch(`/crm/leads/${id}`, data),
  delete: (id: string) => api.delete(`/crm/leads/${id}`),
  stats: () => api.get('/crm/leads/stats'),
  addActivity: (id: string, type: string, content: string) =>
    api.post(`/crm/leads/${id}/activities`, { type, content }),
};

export const dealsApi = {
  list: (params?: Record<string, string | undefined>) => api.get('/crm/deals', params),
  get: (id: string) => api.get(`/crm/deals/${id}`),
  create: (data: unknown) => api.post('/crm/deals', data),
  update: (id: string, data: unknown) => api.patch(`/crm/deals/${id}`, data),
  delete: (id: string) => api.delete(`/crm/deals/${id}`),
  pipeline: () => api.get('/crm/deals/pipeline'),
  addActivity: (id: string, type: string, content: string) =>
    api.post(`/crm/deals/${id}/activities`, { type, content }),
};

export const contactsApi = {
  list: (params?: Record<string, string | undefined>) => api.get('/crm/contacts', params),
  get: (id: string) => api.get(`/crm/contacts/${id}`),
  create: (data: unknown) => api.post('/crm/contacts', data),
  update: (id: string, data: unknown) => api.patch(`/crm/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/crm/contacts/${id}`),
};

export const campaignsApi = {
  list: (params?: Record<string, string | undefined>) => api.get('/crm/campaigns', params),
  get: (id: string) => api.get(`/crm/campaigns/${id}`),
  create: (data: unknown) => api.post('/crm/campaigns', data),
  updateStatus: (id: string, status: string) => api.patch(`/crm/campaigns/${id}/status`, { status }),
};

// HRMS
export const employeesApi = {
  list: (params?: Record<string, string | undefined>) => api.get('/hrms/employees', params),
  get: (id: string) => api.get(`/hrms/employees/${id}`),
  create: (data: unknown) => api.post('/hrms/employees', data),
  update: (id: string, data: unknown) => api.patch(`/hrms/employees/${id}`, data),
  stats: () => api.get('/hrms/employees/stats'),
};

export const attendanceApi = {
  today: () => api.get('/hrms/attendance/today'),
  summary: (date?: string) => api.get('/hrms/attendance/summary', date ? { date } : undefined),
  checkIn: (location?: { lat: number; lng: number }) => api.post('/hrms/attendance/check-in', { location }),
  checkOut: (location?: { lat: number; lng: number }) => api.post('/hrms/attendance/check-out', { location }),
};

export const leavesApi = {
  applications: (params?: Record<string, string | undefined>) => api.get('/hrms/leave-applications', params),
  apply: (employeeId: string, data: unknown) => api.post(`/hrms/employees/${employeeId}/leaves`, data),
  decide: (id: string, decision: 'approved' | 'rejected', reason?: string) =>
    api.post(`/hrms/leave-applications/${id}/decide`, { decision, rejection_reason: reason }),
  balances: (employeeId: string, year?: number) =>
    api.get(`/hrms/employees/${employeeId}/leave-balances`, year ? { year } : undefined),
};

export const payrollApi = {
  runs: () => api.get('/hrms/payroll/runs'),
  createRun: (month: number, year: number) => api.post('/hrms/payroll/runs', { month, year }),
  process: (runId: string) => api.post(`/hrms/payroll/runs/${runId}/process`),
  payslips: (runId: string) => api.get(`/hrms/payroll/runs/${runId}/payslips`),
};

// Invoices
export const invoicesApi = {
  list: (params?: Record<string, string | undefined>) => api.get('/invoices', params),
  get: (id: string) => api.get(`/invoices/${id}`),
  create: (data: unknown) => api.post('/invoices', data),
  update: (id: string, data: unknown) => api.patch(`/invoices/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/invoices/${id}/status`, { status }),
  recordPayment: (id: string, data: unknown) => api.post(`/invoices/${id}/payments`, data),
  stats: () => api.get('/invoices/stats'),
  settings: () => api.get('/invoices/settings'),
  updateSettings: (data: unknown) => api.patch('/invoices/settings', data),
};

export { ApiError };
