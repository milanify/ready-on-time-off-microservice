import React, { useEffect, useState } from 'react';
import { useActor } from '../context/ActorContext';
import { apiClient, LeaveBalanceDto, TimeOffRequestDto } from '../api/apiClient';
import { CalendarDays, Clock, CheckCircle, Ban, Send } from 'lucide-react';
import { format } from 'date-fns';

export const EmployeeDashboard = () => {
  const { actor } = useActor();
  const [balance, setBalance] = useState<LeaveBalanceDto | null>(null);
  const [requests, setRequests] = useState<TimeOffRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [daysRequested, setDaysRequested] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    try {
      const balRes = await apiClient.get(`/balances/${actor.employeeId}/${actor.locationId}`);
      setBalance(balRes.data);

      const reqRes = await apiClient.get('/requests', {
         params: { employeeId: actor.employeeId }
      });
      setRequests(reqRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await apiClient.post('/requests', {
        employeeId: actor.employeeId,
        locationId: actor.locationId,
        daysRequested
      });
      setShowModal(false);
      setDaysRequested(1);
      loadDashboard();
    } catch (e: any) {
      setErrorMsg(e.response?.data?.message || 'Failed to submit request');
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'APPROVED': return <CheckCircle size={18} className="text-success" />;
      case 'REJECTED': 
      case 'CANCELLED': return <Ban size={18} className="text-error" />;
      default: return <Clock size={18} className="text-warning" />;
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title gradient-text">Time Off Portal</h1>
        <p className="page-subtitle">Welcome back, {actor.label.split(' ')[0]}</p>
      </div>

      {loading ? (
        <div style={{ opacity: 0.5 }}>Loading securely from SQLite cache...</div>
      ) : (
        <>
          <div className="dashboard-grid" style={{ marginBottom: '40px' }}>
             <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', boxSizing: 'border-box' }}>
                <h3 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Available Balance</h3>
                <div style={{ fontSize: '3.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
                  {balance ? balance.availableDays : '--'} <span style={{fontSize: '1rem', color: 'var(--text-muted)'}}>days</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                   <div>
                     <div style={{color: 'var(--text-muted)'}}>HCM Source Truth</div>
                     <div style={{fontWeight: 600}}>{balance ? balance.balanceDays : '--'}</div>
                   </div>
                   <div>
                     <div style={{color: 'var(--text-muted)'}}>Soft Reserved</div>
                     <div style={{fontWeight: 600}}>{balance ? balance.reservedDays : '--'}</div>
                   </div>
                </div>
             </div>

             <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>Ready to take a break?</div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ padding: '16px 32px', fontSize: '1.1rem' }}>
                  <CalendarDays size={20} /> Request Time Off
                </button>
             </div>
          </div>

          <h2 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Request History</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requests.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No requests created yet.</div>}
            {requests.map(req => (
               <div key={req.id} className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                     {getStatusIcon(req.status)}
                     <div>
                       <div style={{ fontWeight: 500 }}>{req.daysRequested} Days Off</div>
                       <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {req.id.substring(0, 8)} • {req.createdAt ? format(new Date(req.createdAt), 'MMM dd, yyyy') : 'Recently'}</div>
                     </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                     <span className={`badge badge-${req.status.toLowerCase()}`}>{req.status}</span>
                     <span className={`badge badge-${req.hcmSyncStatus === 'SYNCED' ? 'approved' : req.hcmSyncStatus === 'PENDING_SYNC' ? 'syncing' : 'pending'}`}>
                       HCM: {req.hcmSyncStatus}
                     </span>
                  </div>
               </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in">
             <h2 style={{ marginBottom: '24px' }}>Request Time Off</h2>
             {errorMsg && <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>{errorMsg}</div>}
             <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Days Requested</label>
                  <input 
                    type="number" 
                    min="1" 
                    className="form-input" 
                    value={daysRequested}
                    onChange={(e) => setDaysRequested(Number(e.target.value))}
                  />
                  {balance && <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>Available limit guarantees: {balance.availableDays} days</small>}
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><Send size={16} /> Submit</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
