import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManagerDashboard } from './ManagerDashboard';
import { ActorProvider } from '../context/ActorContext';
import { apiClient } from '../api/apiClient';

jest.mock('../api/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const renderManager = () =>
  render(
    <ActorProvider>
      <ManagerDashboard />
    </ActorProvider>
  );

describe('ManagerDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  // ─── Page Rendering ───────────────────────────────────

  describe('Page Rendering', () => {
    test('renders Manager Workflow title', async () => {
      renderManager();
      await waitFor(() => {
        expect(screen.getByText(/Manager Workflow/i)).toBeInTheDocument();
      });
    });

    test('renders subtitle about outbox sync', async () => {
      renderManager();
      await waitFor(() => {
        expect(screen.getByText(/Outbox sync/i)).toBeInTheDocument();
      });
    });

    test('shows loading state initially', () => {
      (apiClient.get as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves
      renderManager();
      expect(screen.getByText(/Loading pending approvals/i)).toBeInTheDocument();
    });
  });

  // ─── Empty State ──────────────────────────────────────

  describe('Empty State', () => {
    test('shows empty message when no pending requests', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      renderManager();
      await waitFor(() => {
        expect(screen.getByText(/No pending requests/i)).toBeInTheDocument();
      });
    });

    test('shows "all caught up" when queue is empty', async () => {
      renderManager();
      await waitFor(() => {
        expect(screen.getByText(/caught up/i)).toBeInTheDocument();
      });
    });
  });

  // ─── Name Resolution ──────────────────────────────────

  describe('Name Resolution', () => {
    test('resolves emp-456 to Sarah', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-1', employeeId: 'emp-456', daysRequested: 3, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() }]
      });
      renderManager();
      await waitFor(() => {
        expect(screen.getByText(/Sarah/i)).toBeInTheDocument();
      });
    });

    test('resolves emp-123 to John', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-2', employeeId: 'emp-123', daysRequested: 1, status: 'PENDING', locationId: 'US-NY', createdAt: new Date().toISOString() }]
      });
      renderManager();
      await waitFor(() => {
        expect(screen.getByText(/John/i)).toBeInTheDocument();
      });
    });

    test('falls back to raw employeeId for unknown employees', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-3', employeeId: 'emp-unknown-999', daysRequested: 1, status: 'PENDING', locationId: 'US-LA', createdAt: new Date().toISOString() }]
      });
      renderManager();
      await waitFor(() => {
        expect(screen.getAllByText(/emp-unknown-999/i).length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  // ─── Request Card Details ─────────────────────────────

  describe('Request Card Details', () => {
    test('displays days requested prominently', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-d', employeeId: 'emp-456', daysRequested: 7, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() }]
      });
      renderManager();
      await waitFor(() => {
        expect(screen.getByText('7')).toBeInTheDocument();
        expect(screen.getByText(/Days Requested/i)).toBeInTheDocument();
      });
    });

    test('displays location and employee ID', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-loc', employeeId: 'emp-456', daysRequested: 1, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() }]
      });
      renderManager();
      await waitFor(() => {
        expect(screen.getByText(/UK-LON/i)).toBeInTheDocument();
      });
    });

    test('displays PENDING badge for each request', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-badge', employeeId: 'emp-456', daysRequested: 1, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() }]
      });
      renderManager();
      await waitFor(() => {
        expect(screen.getByText('PENDING')).toBeInTheDocument();
      });
    });

    test('displays submission timestamp', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-time', employeeId: 'emp-456', daysRequested: 1, status: 'PENDING', locationId: 'UK-LON', createdAt: '2024-06-15T14:30:00Z' }]
      });
      renderManager();
      await waitFor(() => {
        expect(screen.getByText(/Submitted Jun 15, 2024/i)).toBeInTheDocument();
      });
    });

    test('shows "Recently" when createdAt is null', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-notime', employeeId: 'emp-456', daysRequested: 1, status: 'PENDING', locationId: 'UK-LON', createdAt: null }]
      });
      renderManager();
      await waitFor(() => {
        expect(screen.getByText(/Recently/i)).toBeInTheDocument();
      });
    });
  });

  // ─── Approve / Reject Actions ─────────────────────────

  describe('Approve / Reject Actions', () => {
    test('calls approve endpoint on Approve click', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-approve', employeeId: 'emp-456', daysRequested: 3, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() }]
      });
      (apiClient.post as jest.Mock).mockResolvedValue({});
      renderManager();

      await waitFor(() => screen.getByText(/Sarah/i));
      fireEvent.click(screen.getByText(/Approve/i));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/requests/req-approve/approve');
      });
    });

    test('calls reject endpoint on Reject click', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-reject', employeeId: 'emp-123', daysRequested: 5, status: 'PENDING', locationId: 'US-NY', createdAt: new Date().toISOString() }]
      });
      (apiClient.post as jest.Mock).mockResolvedValue({});
      renderManager();

      await waitFor(() => screen.getByText(/John/i));
      fireEvent.click(screen.getByText(/Reject/i));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/requests/req-reject/reject');
      });
    });

    test('reloads request list after approval', async () => {
      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: [{ id: 'req-reload', employeeId: 'emp-456', daysRequested: 1, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() }] })
        .mockResolvedValueOnce({ data: [] }); // after reload
      (apiClient.post as jest.Mock).mockResolvedValue({});
      renderManager();

      await waitFor(() => screen.getByText(/Sarah/i));
      fireEvent.click(screen.getByText(/Approve/i));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(2);
      });
    });

    test('renders multiple request cards simultaneously', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [
          { id: 'req-m1', employeeId: 'emp-456', daysRequested: 2, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() },
          { id: 'req-m2', employeeId: 'emp-123', daysRequested: 4, status: 'PENDING', locationId: 'US-NY', createdAt: new Date().toISOString() },
        ]
      });
      renderManager();

      await waitFor(() => {
        expect(screen.getByText(/Sarah/i)).toBeInTheDocument();
        expect(screen.getByText(/John/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Approve/i)).toHaveLength(2);
        expect(screen.getAllByText(/Reject/i)).toHaveLength(2);
      });
    });
  });

  // ─── Error Handling ───────────────────────────────────

  describe('Error Handling', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test('handles API error on load gracefully', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));
      renderManager();

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('shows alert on approve/reject failure', async () => {
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-fail', employeeId: 'emp-456', daysRequested: 1, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() }]
      });
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Network crash'));
      renderManager();

      await waitFor(() => screen.getByText(/Sarah/i));
      fireEvent.click(screen.getByText(/Approve/i));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Action failed'));
      });
      alertMock.mockRestore();
    });
  });

  describe('UI Icons & Styles', () => {
    test('renders Check icon in Approve button', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-icon1', employeeId: 'emp-456', daysRequested: 1, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() }]
      });
      renderManager();
      await waitFor(() => {
        const btn = screen.getByText(/Approve/i);
        expect(btn.querySelector('svg')).toBeInTheDocument();
      });
    });

    test('renders X icon in Reject button', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'req-icon2', employeeId: 'emp-456', daysRequested: 1, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() }]
      });
      renderManager();
      await waitFor(() => {
        const btn = screen.getByText(/Reject/i);
        expect(btn.querySelector('svg')).toBeInTheDocument();
      });
    });

    test('has animate-fade-in class for entrance', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [] });
      renderManager();
      await waitFor(() => {
        const div = document.querySelector('.animate-fade-in');
        expect(div).toBeInTheDocument();
      });
    });
  });
});
