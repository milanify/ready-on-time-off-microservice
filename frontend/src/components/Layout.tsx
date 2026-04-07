import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { defaultActors, useActor } from '../context/ActorContext';
import { LayoutDashboard, Users, ShieldAlert } from 'lucide-react';

export const Layout = () => {
  const { actor, setActor } = useActor();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  React.useEffect(() => {
    // On mount or actor change, ensure the URL matches the role
    if (actor.role === 'admin' && pathname !== '/admin') {
      navigate('/admin');
    } else if (actor.role === 'manager' && pathname !== '/manager') {
      navigate('/manager');
    } else if (actor.role === 'employee' && pathname !== '/') {
      navigate('/');
    }
  }, [actor, navigate, pathname]);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--accent-gradient)' }}></div>
          <strong>ReadyOn</strong>
        </div>

        <div className="actor-switch glass-panel" style={{ marginBottom: '32px' }}>
          <label>Simulate User Role</label>
          <select 
             className="actor-select"
             data-testid="actor-select"
             value={actor.employeeId} 
             onChange={(e) => {
               const foundActor = defaultActors.find(a => a.employeeId === e.target.value);
               if (foundActor) {
                 setActor(foundActor);
                 if (foundActor.role === 'admin') navigate('/admin');
                 else if (foundActor.role === 'manager') navigate('/manager');
                 else navigate('/');
               }
             }}
          >
            {defaultActors.map(a => (
              <option key={a.employeeId} value={a.employeeId}>{a.label}</option>
            ))}
          </select>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} end>
            <LayoutDashboard size={20} /> My Dashboard
          </NavLink>
          {actor.role === 'manager' && (
            <NavLink to="/manager" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
               <Users size={20} /> Approvals
            </NavLink>
          )}
          {actor.role === 'admin' && (
             <NavLink to="/admin" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
               <ShieldAlert size={20} /> Reconciliation
             </NavLink>
          )}
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
