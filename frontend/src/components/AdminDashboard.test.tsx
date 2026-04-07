import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminDashboard } from './AdminDashboard';
import { ActorProvider } from '../context/ActorContext';
import { apiClient, mockHcmClient } from '../api/apiClient';

jest.mock('../api/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  mockHcmClient: {
    post: jest.fn(),
  },
}));

const renderAdmin = () =>
  render(
    <ActorProvider>
      <AdminDashboard />
    </ActorProvider>
  );

describe('AdminDashboard', () => {
  const mockComparison = {
    employeeId: 'emp-456',
    localBalance: 20,
    localReserved: 2,
    hcmBalance: 20,
    drift: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockComparison });
  });

  // ─── Page Rendering ───────────────────────────────────

  describe('Page Rendering', () => {
    test('renders Drift Visualization header', async () => {
      renderAdmin();
      await waitFor(() => {
        expect(screen.getByText(/Drift Visualization/i)).toBeInTheDocument();
      });
    });

    test('renders employee name in header (Sarah)', async () => {
      renderAdmin();
      await waitFor(() => {
        expect(screen.getByText(/Sarah/i)).toBeInTheDocument();
      });
    });

    test('renders section title for System Reconciliation Engine', async () => {
      renderAdmin();
      await waitFor(() => {
        expect(screen.getByText(/System Reconciliation Engine/i)).toBeInTheDocument();
      });
    });
  });

  // ─── Balance Comparison ───────────────────────────────

  describe('Balance Comparison', () => {
    test('displays local balance value', async () => {
      renderAdmin();
      await waitFor(() => {
        expect(screen.getAllByText(/20/i).length).toBeGreaterThan(0);
      });
    });

    test('displays zero drift indicator', async () => {
      renderAdmin();
      await waitFor(() => {
        // Look for the drift element specifically if possible, or use a regex
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });

    test('displays positive drift correctly', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { ...mockComparison, hcmBalance: 30, drift: 10 }
      });
      renderAdmin();
      await waitFor(() => {
        expect(screen.getByText('+10')).toBeInTheDocument();
      });
    });

    test('displays negative drift correctly', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { ...mockComparison, hcmBalance: 15, drift: -5 }
      });
      renderAdmin();
      await waitFor(() => {
        expect(screen.getByText('-5')).toBeInTheDocument();
      });
    });

    test('shows "Offline" when drift is null', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { ...mockComparison, hcmBalance: null, drift: null }
      });
      renderAdmin();
      await waitFor(() => {
        expect(screen.getByText(/Offline/i)).toBeInTheDocument();
      });
    });
  });

  // ─── HCM Mock Controls ───────────────────────────────

  describe('HCM Mock Controls', () => {
    test('triggers anniversary event on button click', async () => {
      (mockHcmClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
      renderAdmin();
      await waitFor(() => screen.getByText(/Drift Visualization/i));

      fireEvent.click(screen.getByText(/Trigger HCM Anniversary/i));

      await waitFor(() => {
        expect(mockHcmClient.post).toHaveBeenCalledWith(
          expect.stringContaining('/mock-hcm/trigger/anniversary/emp-456')
        );
      });
    });

    test('triggers year reset on button click', async () => {
      (mockHcmClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
      renderAdmin();
      await waitFor(() => screen.getByText(/Drift Visualization/i));

      fireEvent.click(screen.getByText(/Global Year-End Reset/i));

      await waitFor(() => {
        expect(mockHcmClient.post).toHaveBeenCalledWith(
          expect.stringContaining('/mock-hcm/trigger/year-reset')
        );
      });
    });

    test('injects manual drift with custom amount', async () => {
      (mockHcmClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { ...mockComparison, hcmBalance: 25, drift: 5 }
      });
      renderAdmin();
      await waitFor(() => screen.getByText(/Drift Visualization/i));

      const input = screen.getByDisplayValue('5');
      fireEvent.change(input, { target: { value: '15' } });

      fireEvent.click(screen.getByText(/Inject Manual Drift/i));

      await waitFor(() => {
        expect(mockHcmClient.post).toHaveBeenCalledWith(
          '/mock-hcm/trigger/adjust',
          expect.objectContaining({ amount: 15 })
        );
      });
    });

    test('refreshes comparison after HCM action', async () => {
      (mockHcmClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
      renderAdmin();
      await waitFor(() => screen.getByText(/Drift Visualization/i));

      const initialCalls = (apiClient.get as jest.Mock).mock.calls.length;
      fireEvent.click(screen.getByText(/Trigger HCM Anniversary/i));

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCalls);
      }, { timeout: 3000 });
    });
  });

  // ─── Reconciliation ───────────────────────────────────

  describe('Reconciliation', () => {
    test('triggers reconcile on button click', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { reconciled: true, delta: 5 }
      });
      renderAdmin();
      await waitFor(() => screen.getByText(/Drift Visualization/i));

      fireEvent.click(screen.getByText(/Execute Drift Reconcile/i));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/admin/reconcile', expect.objectContaining({
          employeeId: 'emp-456',
        }));
      });
    });

    test('displays "Yes" for drift detected when reconcile finds diff', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { reconciled: true, delta: 5, critical: false }
      });
      renderAdmin();
      await waitFor(() => screen.getByText(/Drift Visualization/i));

      fireEvent.click(screen.getByText(/Execute Drift Reconcile/i));

      await waitFor(() => {
        expect(screen.getByText('Yes')).toBeInTheDocument();
      });
    });

    test('displays "No" for drift detected when reconcile finds nothing', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { reconciled: false, delta: 0 }
      });
      renderAdmin();
      await waitFor(() => screen.getByText(/Drift Visualization/i));

      fireEvent.click(screen.getByText(/Execute Drift Reconcile/i));

      await waitFor(() => {
        expect(screen.getByText('No')).toBeInTheDocument();
      });
    });
  });

  // ─── Error Handling ───────────────────────────────────

  describe('Error Handling', () => {
    test('handles comparison API failure gracefully', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));
      renderAdmin();
      await waitFor(() => {
        expect(screen.getByText(/System Reconciliation Engine/i)).toBeInTheDocument();
      });
    });
  });
});
