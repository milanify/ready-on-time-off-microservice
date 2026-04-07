import { render, screen, fireEvent } from '@testing-library/react';
import { Layout } from './Layout';
import { ActorProvider, defaultActors } from '../context/ActorContext';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
};

describe('Layout Navigation Logic', () => {
  test('navigates to /admin when System Admin is selected', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ActorProvider>
          <Routes>
            <Route path="*" element={<><Layout /><LocationDisplay /></>} />
          </Routes>
        </ActorProvider>
      </MemoryRouter>
    );

    const select = screen.getByTestId('actor-select');
    const adminActor = defaultActors.find(a => a.role === 'admin');
    
    fireEvent.change(select, { target: { value: adminActor?.employeeId } });

    expect(screen.getByTestId('location-display').textContent).toBe('/admin');
  });

  test('navigates to /manager when Manager is selected', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ActorProvider>
          <Routes>
            <Route path="*" element={<><Layout /><LocationDisplay /></>} />
          </Routes>
        </ActorProvider>
      </MemoryRouter>
    );

    const select = screen.getByTestId('actor-select');
    const managerActor = defaultActors.find(a => a.role === 'manager');
    
    fireEvent.change(select, { target: { value: managerActor?.employeeId } });

    expect(screen.getByTestId('location-display').textContent).toBe('/manager');
  });

  test('navigates to / when Employee is selected', () => {
    // Start at /admin to see it change to /
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <ActorProvider>
          <Routes>
            <Route path="*" element={<><Layout /><LocationDisplay /></>} />
          </Routes>
        </ActorProvider>
      </MemoryRouter>
    );

    const select = screen.getByTestId('actor-select');
    const employeeActor = defaultActors.find(a => a.role === 'employee');
    
    if (employeeActor) {
      fireEvent.change(select, { target: { value: employeeActor.employeeId } });
      expect(screen.getByTestId('location-display').textContent).toBe('/');
    }
  });
});
