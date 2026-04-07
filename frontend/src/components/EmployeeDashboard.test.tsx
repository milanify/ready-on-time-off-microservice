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

  test('renders balance and opens request modal', async () => {
    render(
      <MemoryRouter>
        <ActorProvider>
          <EmployeeDashboard />
        </ActorProvider>
      </MemoryRouter>
    );

    // Header check
    expect(screen.getByText(/Time Off Portal/i)).toBeInTheDocument();
    
    // Wait for balance to load
    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    // Open Modal
    const requestBtn = screen.getByText(/Request Time Off/i);
    fireEvent.click(requestBtn);

    expect(screen.getByText(/Days Requested/i)).toBeInTheDocument();
    
    // Submit valid request
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'req-123' } });
    
    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '3' } });
    
    const submitBtn = screen.getByText(/Submit/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/requests', expect.objectContaining({
        daysRequested: 3
      }));
    });
  });

  test('displays existing request history sorted by newest first with precise timestamps', async () => {
    const olderDate = '2024-01-01T10:00:00Z';
    const newerDate = '2024-01-01T12:30:45Z';
    
    (apiClient.get as jest.Mock).mockImplementation((url) => {
       if (url.includes('/balances')) return Promise.resolve({ data: { availableDays: 20, reservedDays: 0, balanceDays: 20 } });
       if (url === '/requests') return Promise.resolve({ 
         data: [
           { id: 'req-old', daysRequested: 2, status: 'APPROVED', hcmSyncStatus: 'SYNCED', createdAt: olderDate },
           { id: 'req-new', daysRequested: 5, status: 'PENDING', hcmSyncStatus: 'UNSYNCED', createdAt: newerDate }
         ] 
       });
       return Promise.reject(new Error('not found'));
    });

    render(
      <MemoryRouter>
        <ActorProvider>
          <EmployeeDashboard />
        </ActorProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const requestItems = screen.getAllByText(/Days Off/i);
      expect(requestItems).toHaveLength(2);
      
      // The newest one (5 days) should be first
      expect(requestItems[0]).toHaveTextContent('5 Days Off');
      expect(requestItems[1]).toHaveTextContent('2 Days Off');
      
      // Verify precise timestamp format pattern: MMM dd, yyyy HH:mm:ss
      // Since the actual hour depends on the runner's timezone, we check for the presence of the minutes/seconds
      expect(screen.getByText(/Jan 01, 2024 \d{2}:30:45/i)).toBeInTheDocument();
      expect(screen.getByText(/Jan 01, 2024 \d{2}:00:00/i)).toBeInTheDocument();
    });

    // Test Refresh Button
    const refreshBtn = screen.getByText(/Refresh/i);
    fireEvent.click(refreshBtn);
    
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(4); // 2 on initial load, 2 on refresh
    });
  });
});
