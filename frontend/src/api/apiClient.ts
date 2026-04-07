import axios from 'axios';

export const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const mockHcmClient = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface TimeOffRequestDto {
  id: string;
  employeeId: string;
  locationId: string;
  daysRequested: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  hcmSyncStatus: 'UNSYNCED' | 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
  createdAt: string;
}

export interface LeaveBalanceDto {
  employeeId: string;
  locationId: string;
  balanceDays: number;
  reservedDays: number;
  availableDays: number;
  version: number;
}
