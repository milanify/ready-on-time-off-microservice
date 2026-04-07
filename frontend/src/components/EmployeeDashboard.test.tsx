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

  test('displays existing request history', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url) => {
       if (url.includes('/balances')) return Promise.resolve({ data: { availableDays: 20, reservedDays: 0, balanceDays: 20 } });
       if (url === '/requests') return Promise.resolve({ 
         data: [{ id: 'req-abc', daysRequested: 5, status: 'APPROVED', hcmSyncStatus: 'SYNCED', createdAt: new Date().toISOString() }] 
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
      expect(screen.getByText(/5 Days Off/i)).toBeInTheDocument();
      expect(screen.getByText(/APPROVED/i)).toBeInTheDocument();
    });
  });
});
