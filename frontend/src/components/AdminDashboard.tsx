import React, { useState } from 'react';
import { apiClient, mockHcmClient } from '../api/apiClient';
import { Zap, ServerCrash, RefreshCw, AlertTriangle } from 'lucide-react';

export const AdminDashboard = () => {
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [hcmLog, setHcmLog] = useState('');

  const targetEmployee = 'emp-456';
  const targetLocation = 'UK-LON';

  const triggerAnniversary = async () => {
    try {
      await mockHcmClient.post(`/mock-hcm/trigger/anniversary/${targetEmployee}`);
      setHcmLog(`✅ Successfully triggered Anniversary drift (+10 days) on mock HCM for ${targetEmployee}. Egress webhook may have synced it automatically!`);
    } catch (e: any) {
      setHcmLog(`❌ Anniversary Failed: ${e.message}`);
    }
  };

  const manualReconcile = async () => {
    setReconcileLoading(true);
    try {
      const res = await apiClient.post('/admin/reconcile', {
        employeeId: targetEmployee,
        locationId: targetLocation
      });
      setReconcileResult(res.data);
    } catch (e: any) {
      console.error(e);
      setReconcileResult({ error: e.response?.data?.message || e.message });
    } finally {
      setReconcileLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title gradient-text">System Reconciliation Engine</h1>
        <p className="page-subtitle">Trigger Mock HCM anomalies and manually reconcile SQLite cache.</p>
      </div>

      <div className="dashboard-grid">
        <div className="glass-panel" style={{ padding: '32px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <ServerCrash className="text-warning" size={24} />
              <h2>Mock HCM Controls</h2>
           </div>
           <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: '1.5' }}>
             The Mock HCM maintains the Source of Truth. Firing an anniversary drops 10 days onto an employee's balance directly in the Mock Server.
           </p>

           <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '24px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              Target: {targetEmployee} ({targetLocation})
           </div>

           <button className="btn btn-secondary" onClick={triggerAnniversary} style={{ width: '100%', marginBottom: '16px' }}>
             <Zap size={16} className="text-warning" /> Trigger HCM Anniversary
           </button>

           {hcmLog && (
             <div style={{ padding: '12px', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
               {hcmLog}
             </div>
           )}
        </div>

        <div className="glass-panel" style={{ padding: '32px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <RefreshCw className="text-success" size={24} />
              <h2>ReadyOn Drift Detector</h2>
           </div>
           <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: '1.5' }}>
             Manual Reconcile parses the HCM truth and diffs it against localized SQLite limits. Discrepancies are logged in `SyncLog` and corrected.
           </p>

           <button className="btn btn-primary" onClick={manualReconcile} disabled={reconcileLoading} style={{ width: '100%', marginBottom: '24px' }}>
             {reconcileLoading ? 'Reconciling...' : 'Execute Drift Reconcile'}
           </button>

           {reconcileResult && (
             <div style={{ padding: '20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-muted)' }}>
               <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Reconciliation Report</h4>
               
               {reconcileResult.error ? (
                  <div style={{ color: 'var(--error)', display: 'flex', gap: '8px', alignItems: 'center' }}><AlertTriangle size={16} /> {reconcileResult.error}</div>
               ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-muted)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Drift Detected</span>
                      <strong style={{ color: reconcileResult.reconciled ? 'var(--warning)' : 'var(--success)' }}>
                         {reconcileResult.reconciled ? 'Yes' : 'No'}
                      </strong>
                    </div>
                    {reconcileResult.reconciled && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Delta (Days)</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{reconcileResult.delta}</strong>
                      </div>
                    )}
                  </div>
               )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
