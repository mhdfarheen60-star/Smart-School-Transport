import axios, { AxiosError } from 'axios';
import type { Meta } from '../types';

const TOKEN_KEY = 'sst_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 on an authenticated call means the session expired: drop it and go to login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}
http.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.includes('/auth/login') && tokenStore.get()) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export interface ApiError {
  message: string;
  status?: number;
  fields: Record<string, string>;
}

export function parseError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    const fields: Record<string, string> = {};
    if (Array.isArray(data?.details)) {
      for (const d of data.details) if (d.field && !fields[d.field]) fields[d.field] = d.message;
    }
    if (!err.response) {
      return { message: 'Cannot reach the server. Check your connection and that the API is running.', fields };
    }
    return { message: data?.message || err.message, status: err.response.status, fields };
  }
  return { message: err instanceof Error ? err.message : 'Something went wrong', fields: {} };
}

export async function get<T>(url: string, params?: object): Promise<{ data: T; meta?: Meta }> {
  const r = await http.get(url, { params });
  return { data: r.data.data as T, meta: r.data.meta as Meta | undefined };
}
export async function post<T>(url: string, body?: unknown): Promise<T> {
  return (await http.post(url, body)).data.data as T;
}
export async function patch<T>(url: string, body?: unknown): Promise<T> {
  return (await http.patch(url, body)).data.data as T;
}
export async function del<T>(url: string): Promise<T> {
  return (await http.delete(url)).data.data as T;
}

export async function downloadReport(
  type: string,
  format: 'csv' | 'pdf',
  params: { from?: string; to?: string }
) {
  const r = await http.get(`/reports/${type}`, { params: { ...params, format }, responseType: 'blob' });
  const url = URL.createObjectURL(r.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-report.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
