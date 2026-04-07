import React, { useEffect, useState } from 'react';
import { defaultActors, useActor } from '../context/ActorContext';
import { apiClient, TimeOffRequestDto } from '../api/apiClient';
import { Check, X } from 'lucide-react';
import { format } from 'date-fns';

export const ManagerDashboard = () => {
  const { actor } = useActor();
  const [requests, setRequests] = useState<TimeOffRequestDto[]>([]);
  const [loading, setLoading] = useState(true);

  const resolveName = (id: string) => {
    const found = defaultActors.find(a => a.employeeId === id);
    return found ? found.label.split('(')[0].trim() || id : id;
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      // For simplicity, Manager queries all PENDING globally, though backend could filter by locationId
      const res = await apiClient.get('/requests', {
         params: { status: 'PENDING' }
      });
      setRequests(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [actor]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
       await apiClient.post(`/requests/${id}/${action}`);
       loadRequests();
    } catch (e) {
       console.error(e);
       alert('Action failed. Check console.');
    }
  };

  if (loading) return <div style={{ opacity: 0.5 }}>Loading pending approvals...</div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title gradient-text">Manager Workflow</h1>
        <p className="page-subtitle">Review incoming leave requests queued for final Outbox sync.</p>
      </div>

      <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
        {requests.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No pending requests in your queue. You're all caught up!</div>}
        
        {requests.map(req => (
          <div key={req.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                   <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Employee: {resolveName(req.employeeId)}</h3>
                   <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Location: {req.locationId} ({req.employeeId})</p>
                </div>
                <span className="badge badge-pending">PENDING</span>
             </div>

             <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                   <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>{req.daysRequested}</strong>
                   <span style={{ color: 'var(--text-secondary)' }}>Days Requested</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                   Submitted {req.createdAt ? format(new Date(req.createdAt), 'MMM dd, yyyy HH:mm') : 'Recently'}
                </div>
             </div>

             <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '20px', marginTop: 'auto', display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" style={{ flex: 1, borderColor: 'var(--error)', color: 'var(--error)' }} onClick={() => handleAction(req.id, 'reject')}>
                   <X size={16} /> Reject
                </button>
                <button className="btn btn-primary" style={{ flex: 1, background: 'var(--success)' }} onClick={() => handleAction(req.id, 'approve')}>
                   <Check size={16} /> Approve
                </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};
