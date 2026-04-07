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

describe('ManagerDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders list and handles approval', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'req-1', employeeId: 'emp-456', daysRequested: 3, status: 'PENDING', locationId: 'UK-LON', createdAt: new Date().toISOString() }]
    });

    render(
      <ActorProvider>
        <ManagerDashboard />
      </ActorProvider>
    );

    // Initial loading state
    expect(screen.getByText(/Loading pending approvals.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Manager Workflow/i)).toBeInTheDocument();
      expect(screen.getByText(/Employee: emp-456/i)).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    const approveBtn = screen.getByText(/Approve/i);
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/requests/req-1/approve');
    });
  });

  test('handles rejection', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'req-2', employeeId: 'emp-123', daysRequested: 5, status: 'PENDING', locationId: 'US-NY', createdAt: new Date().toISOString() }]
    });

    render(
      <ActorProvider>
        <ManagerDashboard />
      </ActorProvider>
    );

    await waitFor(() => expect(screen.getByText(/emp-123/i)).toBeInTheDocument());

    const rejectBtn = screen.getByText(/Reject/i);
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/requests/req-2/reject');
    });
  });
});
