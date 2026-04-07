import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminDashboard } from './AdminDashboard';
import { ActorProvider } from '../context/ActorContext';
import { apiClient, mockHcmClient } from '../api/apiClient';

jest.mock('../api/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
  },
  mockHcmClient: {
    post: jest.fn(),
  },
}));

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('triggers HCM anniversary', async () => {
    (mockHcmClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

    render(
      <ActorProvider>
        <AdminDashboard />
      </ActorProvider>
    );

    const anniversaryBtn = screen.getByText(/Trigger HCM Anniversary/i);
    fireEvent.click(anniversaryBtn);

    await waitFor(() => {
      expect(mockHcmClient.post).toHaveBeenCalledWith(expect.stringContaining('/mock-hcm/trigger/anniversary/emp-456'));
      expect(screen.getByText(/Successfully triggered Anniversary drift/i)).toBeInTheDocument();
    });
  });

  test('injects manual drift', async () => {
    (mockHcmClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

    render(
      <ActorProvider>
        <AdminDashboard />
      </ActorProvider>
    );

    const input = screen.getByDisplayValue('5');
    fireEvent.change(input, { target: { value: '10' } });

    const driftBtn = screen.getByText(/Inject Manual Drift/i);
    fireEvent.click(driftBtn);

    await waitFor(() => {
      expect(mockHcmClient.post).toHaveBeenCalledWith('/mock-hcm/trigger/adjust', {
        employeeId: 'emp-456',
        amount: 10
      });
      expect(screen.getByText(/Manual Drift of 10 days injected/i)).toBeInTheDocument();
    });
  });

  test('executes drift reconcile and shows deltas', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { reconciled: true, delta: 10, critical: false }
    });

    render(
      <ActorProvider>
        <AdminDashboard />
      </ActorProvider>
    );

    const reconcileBtn = screen.getByText(/Execute Drift Reconcile/i);
    fireEvent.click(reconcileBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/admin/reconcile', expect.anything());
      expect(screen.getByText('Reconciliation Report')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  test('shows critical drift warning', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { reconciled: true, delta: -5, critical: true }
    });

    render(
      <ActorProvider>
        <AdminDashboard />
      </ActorProvider>
    );

    const reconcileBtn = screen.getByText(/Execute Drift Reconcile/i);
    fireEvent.click(reconcileBtn);

    await waitFor(() => {
      expect(screen.getByText(/Critical Drift: Balance below reserved!/i)).toBeInTheDocument();
    });
  });
});
