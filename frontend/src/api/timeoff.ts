import axios from 'axios';
const API_BASE = 'http://localhost:3000/timeoff';

export const getBalance = async (employeeId: string) => {
  const res = await axios.get(`${API_BASE}/balance/${employeeId}`);
  return res.data;
};

export const requestTimeOff = async (payload: { employeeId: string; locationId: string; days: number }) => {
  const res = await axios.post(`${API_BASE}/request`, payload);
  return res.data;
};