import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmployeeDashboard } from './EmployeeDashboard';
import { ActorProvider } from '../context/ActorContext';
import { apiClient } from '../api/apiClient';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../api/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <ActorProvider>
        <EmployeeDashboard />
      </ActorProvider>
    </MemoryRouter>
  );

describe('EmployeeDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockImplementation((url) => {
      if (url.includes('/balances')) {
        return Promise.resolve({ data: { availableDays: 20, reservedDays: 2, balanceDays: 22 } });
      }
      if (url === '/requests') {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error('not found'));
    });
  });

  // ─── Balance Display ──────────────────────────────────

  describe('Balance Display', () => {
    test('renders available balance prominently', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('20')).toBeInTheDocument();
      });
    });

    test('renders HCM Source Truth label and value', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('HCM Source Truth')).toBeInTheDocument();
        expect(screen.getByText('22')).toBeInTheDocument();
      });
    });

    test('renders Soft Reserved label and value', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Soft Reserved')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    test('shows dashes when balance is null', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes('/balances')) return Promise.resolve({ data: null });
        if (url === '/requests') return Promise.resolve({ data: [] });
        return Promise.reject(new Error('not found'));
      });
      renderDashboard();
      await waitFor(() => {
        const dashes = screen.getAllByText('--');
        expect(dashes.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ─── Page Header ──────────────────────────────────────

  describe('Page Header', () => {
    test('renders Time Off Portal title', async () => {
      renderDashboard();
      expect(screen.getByText(/Time Off Portal/i)).toBeInTheDocument();
    });

    test('displays loading state initially', () => {
      renderDashboard();
      expect(screen.getByText(/Loading securely/i)).toBeInTheDocument();
    });

    test('shows welcome message with first name', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/Welcome back, Sarah/i)).toBeInTheDocument();
      });
    });
  });

  // ─── Request Modal ────────────────────────────────────

  describe('Request Modal', () => {
    test('opens modal on button click', async () => {
      renderDashboard();
      await waitFor(() => screen.getByText('20'));
      const requestBtn = screen.getByText(/Request Time Off/i);
      fireEvent.click(requestBtn);
      expect(screen.getByText(/Days Requested/i)).toBeInTheDocument();
    });

    test('modal shows available balance hint', async () => {
      renderDashboard();
      await waitFor(() => screen.getByText('20'));
      fireEvent.click(screen.getByText(/Request Time Off/i));
      expect(screen.getByText(/Available limit guarantees/i)).toBeInTheDocument();
    });

    test('submits request with correct payload', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'req-123' } });
      renderDashboard();
      await waitFor(() => screen.getByText('20'));

      fireEvent.click(screen.getByText(/Request Time Off/i));
      const input = screen.getByDisplayValue('1');
      fireEvent.change(input, { target: { value: '3' } });
      fireEvent.click(screen.getByText(/Submit/i));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/requests', expect.objectContaining({
          daysRequested: 3,
        }));
      });
    });

    test('closes modal after successful submission', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'req-new' } });
      renderDashboard();
      await waitFor(() => screen.getByText('20'));

      fireEvent.click(screen.getByText(/Request Time Off/i));
      fireEvent.click(screen.getByText(/Submit/i));

      await waitFor(() => {
        expect(screen.queryByText(/Days Requested/i)).not.toBeInTheDocument();
      });
    });

    test('closes modal on Cancel click', async () => {
      renderDashboard();
      await waitFor(() => screen.getByText('20'));
      fireEvent.click(screen.getByText(/Request Time Off/i));
      expect(screen.getByText(/Days Requested/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/Cancel/i));
      expect(screen.queryByText(/Days Requested/i)).not.toBeInTheDocument();
    });

    test('displays error message on submission failure', async () => {
      (apiClient.post as jest.Mock).mockRejectedValueOnce({
        response: { data: { message: 'Insufficient balance available locally' } },
      });
      renderDashboard();
      await waitFor(() => screen.getByText('20'));

      fireEvent.click(screen.getByText(/Request Time Off/i));
      fireEvent.click(screen.getByText(/Submit/i));

      await waitFor(() => {
        expect(screen.getByText(/Insufficient balance/i)).toBeInTheDocument();
      });
    });

    test('displays generic error when API has no message', async () => {
      (apiClient.post as jest.Mock).mockRejectedValueOnce({ response: { data: {} } });
      renderDashboard();
      await waitFor(() => screen.getByText('20'));

      fireEvent.click(screen.getByText(/Request Time Off/i));
      fireEvent.click(screen.getByText(/Submit/i));

      await waitFor(() => {
        expect(screen.getByText(/Failed to submit request/i)).toBeInTheDocument();
      });
    });

    test('resets days to 1 after successful submission', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'req-new' } });
      renderDashboard();
      await waitFor(() => screen.getByText('20'));

      fireEvent.click(screen.getByText(/Request Time Off/i));
      const input = screen.getByDisplayValue('1');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(screen.getByText(/Submit/i));

      await waitFor(() => {
        expect(screen.queryByText(/Days Requested/i)).not.toBeInTheDocument();
      });

      // Re-open modal: should be reset to 1
      fireEvent.click(screen.getByText(/Request Time Off/i));
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });
  });

  // ─── Request History ──────────────────────────────────

  describe('Request History', () => {
    test('shows "No requests" message when list is empty', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/No requests created yet/i)).toBeInTheDocument();
      });
    });

    test('displays request history sorted by newest first', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes('/balances')) return Promise.resolve({ data: { availableDays: 20, reservedDays: 0, balanceDays: 20 } });
        if (url === '/requests') return Promise.resolve({
          data: [
            { id: 'req-old00', daysRequested: 2, status: 'APPROVED', hcmSyncStatus: 'SYNCED', createdAt: '2024-01-01T10:00:00Z' },
            { id: 'req-new00', daysRequested: 5, status: 'PENDING', hcmSyncStatus: 'UNSYNCED', createdAt: '2024-06-15T14:30:00Z' }
          ]
        });
        return Promise.reject(new Error('not found'));
      });

      renderDashboard();

      await waitFor(() => {
        const items = screen.getAllByText(/Days Off/i);
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent('5 Days Off');
        expect(items[1]).toHaveTextContent('2 Days Off');
      });
    });

    test('shows precise timestamps (HH:mm:ss)', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes('/balances')) return Promise.resolve({ data: { availableDays: 20, reservedDays: 0, balanceDays: 20 } });
        if (url === '/requests') return Promise.resolve({
          data: [{ id: 'req-ts0000', daysRequested: 1, status: 'PENDING', hcmSyncStatus: 'UNSYNCED', createdAt: '2024-03-15T09:45:30Z' }]
        });
        return Promise.reject(new Error('not found'));
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Mar 15, 2024 \d{2}:45:30/i)).toBeInTheDocument();
      });
    });

    test('shows "Recently" when createdAt is missing', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes('/balances')) return Promise.resolve({ data: { availableDays: 20, reservedDays: 0, balanceDays: 20 } });
        if (url === '/requests') return Promise.resolve({
          data: [{ id: 'req-nodate', daysRequested: 1, status: 'PENDING', hcmSyncStatus: 'UNSYNCED', createdAt: null }]
        });
        return Promise.reject(new Error('not found'));
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Recently/i)).toBeInTheDocument();
      });
    });

    test('displays correct status badges', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes('/balances')) return Promise.resolve({ data: { availableDays: 20, reservedDays: 0, balanceDays: 20 } });
        if (url === '/requests') return Promise.resolve({
          data: [
            { id: 'req-a00000', daysRequested: 1, status: 'APPROVED', hcmSyncStatus: 'SYNCED', createdAt: '2024-01-01T00:00:00Z' },
            { id: 'req-p00000', daysRequested: 2, status: 'PENDING', hcmSyncStatus: 'PENDING_SYNC', createdAt: '2024-01-02T00:00:00Z' },
          ]
        });
        return Promise.reject(new Error('not found'));
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('APPROVED')).toBeInTheDocument();
        expect(screen.getByText('PENDING')).toBeInTheDocument();
        expect(screen.getByText(/HCM: SYNCED/i)).toBeInTheDocument();
        expect(screen.getByText(/HCM: PENDING_SYNC/i)).toBeInTheDocument();
      });
    });

    test('refresh button re-fetches data', async () => {
      renderDashboard();
      await waitFor(() => screen.getByText('20'));

      const refreshBtn = screen.getByText(/Refresh/i);
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(4); // 2 initial + 2 refresh
      });
    });

    test('displays truncated request ID', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes('/balances')) return Promise.resolve({ data: { availableDays: 20, reservedDays: 0, balanceDays: 20 } });
        if (url === '/requests') return Promise.resolve({
          data: [{ id: 'abcdefgh-1234-5678-9012', daysRequested: 1, status: 'PENDING', hcmSyncStatus: 'UNSYNCED', createdAt: '2024-01-01T00:00:00Z' }]
        });
        return Promise.reject(new Error('not found'));
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/abcdefgh/i)).toBeInTheDocument();
      });
    });
  });

  // ─── API Integration ──────────────────────────────────

  describe('API Integration', () => {
    test('calls balance endpoint with correct actor params', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/balances/emp-456/UK-LON');
      });
    });

    test('calls requests endpoint with correct employeeId param', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/requests', { params: { employeeId: 'emp-456' } });
      });
    });

    test('handles API error gracefully (no crash)', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));
      renderDashboard();

      await waitFor(() => {
        expect(screen.queryByText(/Loading securely/i)).not.toBeInTheDocument();
      });
    });

    test('reloads dashboard after submitting a request', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'req-new' } });
      renderDashboard();
      await waitFor(() => screen.getByText('20'));

      const callsBefore = (apiClient.get as jest.Mock).mock.calls.length;
      fireEvent.click(screen.getByText(/Request Time Off/i));
      fireEvent.click(screen.getByText(/Submit/i));

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });
  });
});
