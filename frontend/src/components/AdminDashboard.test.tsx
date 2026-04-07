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

describe('AdminDashboard', () => {
  const mockComparison = {
    employeeId: 'emp-456',
    localBalance: 20,
    hcmBalance: 20,
    drift: 0
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockComparison });
  });

  test('renders comparison and triggers HCM anniversary', async () => {
    (mockHcmClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

    render(
      <ActorProvider>
        <AdminDashboard />
      </ActorProvider>
    );

    // Should find the drift visualization header
    await waitFor(() => {
      expect(screen.getByText(/Drift Visualization: Sarah/i)).toBeInTheDocument();
    });

    const anniversaryBtn = screen.getByText(/Trigger HCM Anniversary/i);
    fireEvent.click(anniversaryBtn);

    await waitFor(() => {
      expect(mockHcmClient.post).toHaveBeenCalledWith(expect.stringContaining('/mock-hcm/trigger/anniversary/emp-456'));
    });
  });

  test('injects manual drift and updates stats', async () => {
    (mockHcmClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
    
    // Initial fetch
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockComparison });
    // Fetch after drift
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ 
      data: { ...mockComparison, hcmBalance: 25, drift: 5 } 
    });

    render(
      <ActorProvider>
        <AdminDashboard />
      </ActorProvider>
    );

    await waitFor(() => screen.getByText(/Drift Visualization: Sarah/i));

    const input = screen.getByDisplayValue('5');
    fireEvent.change(input, { target: { value: '10' } });

    const driftBtn = screen.getByText(/Inject Manual Drift/i);
    fireEvent.click(driftBtn);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('+5')).toBeInTheDocument();
    });
  });
});
