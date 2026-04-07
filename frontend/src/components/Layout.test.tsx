import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Layout } from './Layout';
import { ActorProvider, defaultActors } from '../context/ActorContext';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
};

const renderLayout = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ActorProvider>
        <Routes>
          <Route path="*" element={<><Layout /><LocationDisplay /></>} />
        </Routes>
      </ActorProvider>
    </MemoryRouter>
  );

describe('Layout', () => {

  // ─── Navigation by Role ───────────────────────────────

  describe('Navigation by Role Selection', () => {
    test('navigates to /admin when System Admin is selected', () => {
      renderLayout();
      const select = screen.getByTestId('actor-select');
      const adminActor = defaultActors.find(a => a.role === 'admin');
      fireEvent.change(select, { target: { value: adminActor?.employeeId } });
      expect(screen.getByTestId('location-display').textContent).toBe('/admin');
    });

    test('navigates to /manager when Manager is selected', () => {
      renderLayout();
      const select = screen.getByTestId('actor-select');
      const managerActor = defaultActors.find(a => a.role === 'manager');
      fireEvent.change(select, { target: { value: managerActor?.employeeId } });
      expect(screen.getByTestId('location-display').textContent).toBe('/manager');
    });

    test('navigates to / when Employee is selected from /admin', () => {
      renderLayout('/admin');
      const select = screen.getByTestId('actor-select');
      const employeeActor = defaultActors.find(a => a.role === 'employee');
      if (employeeActor) {
        fireEvent.change(select, { target: { value: employeeActor.employeeId } });
        expect(screen.getByTestId('location-display').textContent).toBe('/');
      }
    });

    test('stays on / when employee switches to another employee', () => {
      renderLayout();
      const select = screen.getByTestId('actor-select');
      const john = defaultActors.find(a => a.employeeId === 'emp-123');
      if (john) {
        fireEvent.change(select, { target: { value: john.employeeId } });
        expect(screen.getByTestId('location-display').textContent).toBe('/');
      }
    });
  });

  // ─── Sidebar Branding ────────────────────────────────

  describe('Sidebar Branding', () => {
    test('renders ReadyOn brand text', () => {
      renderLayout();
      expect(screen.getByText('ReadyOn')).toBeInTheDocument();
    });

    test('renders "Simulate User Role" label', () => {
      renderLayout();
      expect(screen.getByText('Simulate User Role')).toBeInTheDocument();
    });
  });

  // ─── Navigation Links ────────────────────────────────

  describe('Navigation Links', () => {
    test('always shows "My Dashboard" nav link', () => {
      renderLayout();
      expect(screen.getByText('My Dashboard')).toBeInTheDocument();
    });

    test('does NOT show Approvals link for employee role', () => {
      renderLayout();
      expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    });

    test('does NOT show Reconciliation link for employee role', () => {
      renderLayout();
      expect(screen.queryByText('Reconciliation')).not.toBeInTheDocument();
    });

    test('shows Approvals link when manager is selected', () => {
      renderLayout();
      const select = screen.getByTestId('actor-select');
      const mgr = defaultActors.find(a => a.role === 'manager');
      fireEvent.change(select, { target: { value: mgr?.employeeId } });
      expect(screen.getByText('Approvals')).toBeInTheDocument();
    });

    test('shows Reconciliation link when admin is selected', () => {
      renderLayout();
      const select = screen.getByTestId('actor-select');
      const admin = defaultActors.find(a => a.role === 'admin');
      fireEvent.change(select, { target: { value: admin?.employeeId } });
      expect(screen.getByText('Reconciliation')).toBeInTheDocument();
    });

    test('does NOT show Approvals link for admin role', () => {
      renderLayout();
      const select = screen.getByTestId('actor-select');
      const admin = defaultActors.find(a => a.role === 'admin');
      fireEvent.change(select, { target: { value: admin?.employeeId } });
      expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    });

    test('does NOT show Reconciliation link for manager role', () => {
      renderLayout();
      const select = screen.getByTestId('actor-select');
      const mgr = defaultActors.find(a => a.role === 'manager');
      fireEvent.change(select, { target: { value: mgr?.employeeId } });
      expect(screen.queryByText('Reconciliation')).not.toBeInTheDocument();
    });
  });

  // ─── Actor Dropdown ───────────────────────────────────

  describe('Actor Dropdown', () => {
    test('renders all actors in dropdown', () => {
      renderLayout();
      defaultActors.forEach(a => {
        expect(screen.getByText(a.label)).toBeInTheDocument();
      });
    });

    test('defaults to first actor (Sarah)', () => {
      renderLayout();
      const select = screen.getByTestId('actor-select') as HTMLSelectElement;
      expect(select.value).toBe('emp-456');
    });

    test('updates selection when changed', () => {
      renderLayout();
      const select = screen.getByTestId('actor-select') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'emp-123' } });
      expect(select.value).toBe('emp-123');
    });
  });

  // ─── Refresh Sync ─────────────────────────────────────

  describe('Page Refresh URL-Role Sync', () => {
    test('redirects /admin to / for default employee actor', async () => {
      renderLayout('/admin');
      await waitFor(() => {
        expect(screen.getByTestId('location-display').textContent).toBe('/');
      });
    });

    test('redirects /manager to / for default employee actor', async () => {
      renderLayout('/manager');
      await waitFor(() => {
        expect(screen.getByTestId('location-display').textContent).toBe('/');
      });
    });

    test('stays on / for default employee actor', async () => {
      renderLayout('/');
      await waitFor(() => {
        expect(screen.getByTestId('location-display').textContent).toBe('/');
      });
    });
  });
});
