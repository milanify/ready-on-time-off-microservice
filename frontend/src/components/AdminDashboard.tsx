import React, { useState } from 'react';
import { apiClient, mockHcmClient } from '../api/apiClient';
import { defaultActors } from '../context/ActorContext';
import { Zap, ServerCrash, RefreshCw, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';

export const AdminDashboard = () => {
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [hcmLog, setHcmLog] = useState('');
  const [driftAmount, setDriftAmount] = useState('5');
  const [comparison, setComparison] = useState<any>(null);

  const targetEmployee = 'emp-456';
  const targetLocation = 'UK-LON';
  const actorName = defaultActors.find(a => a.employeeId === targetEmployee)?.label.split('(')[0].trim() || 'Sarah';

  const fetchComparison = React.useCallback(async () => {
    try {
      const res = await apiClient.get(`/admin/compare/${targetEmployee}/${targetLocation}`);
      setComparison(res.data);
    } catch (e) {
      console.error('Comparison fetch failed', e);
    }
  }, [targetEmployee, targetLocation]);

  React.useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const triggerAnniversary = async () => {
    try {
      await mockHcmClient.post(`/mock-hcm/trigger/anniversary/${targetEmployee}`);
      setHcmLog(`✅ Successfully triggered Anniversary drift (+10 days) on mock HCM for ${actorName}. Egress webhook may have synced it automatically!`);
      setTimeout(fetchComparison, 1000);
    } catch (e: any) {
      setHcmLog(`❌ Anniversary Failed: ${e.message}`);
    }
  };

  const triggerYearReset = async () => {
    try {
      await mockHcmClient.post('/mock-hcm/trigger/year-reset');
      setHcmLog(`✅ Global Year-End Reset triggered. All HCM balances reset to 30 days.`);
      setTimeout(fetchComparison, 1000);
    } catch (e: any) {
      setHcmLog(`❌ Reset Failed: ${e.message}`);
    }
  };

  const injectDrift = async () => {
    try {
      await mockHcmClient.post('/mock-hcm/trigger/adjust', {
        employeeId: targetEmployee,
        amount: parseFloat(driftAmount)
      });
      setHcmLog(`✅ Manual Drift of ${driftAmount} days injected into HCM for ${actorName}.`);
      fetchComparison();
    } catch (e: any) {
      setHcmLog(`❌ Drift Injection Failed: ${e.message}`);
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
      fetchComparison();
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
        <p className="page-subtitle">Verify HCM truth and fix data discrepancies in the SQLite cache.</p>
      </div>

      {comparison && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '40px', border: '1px solid var(--accent-muted)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <TrendingUp className="text-accent" size={24} />
              <h2 style={{ margin: 0 }}>Drift Visualization: {actorName}</h2>
           </div>
           
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>ReadyOn Local Cache</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{comparison.localBalance} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>days</span></div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>HCM Truth (Mock)</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                    {comparison.hcmBalance ?? 'Offline'} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}>days</span>
                 </div>
              </div>
              <div style={{ padding: '16px', background: (comparison.drift !== 0 && comparison.drift !== null) ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Measured Drift</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 700, color: comparison.drift !== 0 ? 'var(--warning)' : 'var(--success)' }}>
                    {comparison.drift && comparison.drift > 0 ? '+' : ''}{comparison.drift ?? '--'} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>days</span>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="glass-panel" style={{ padding: '32px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <ServerCrash className="text-warning" size={24} />
              <h2>Mock HCM Controls</h2>
           </div>
           
           <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '24px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Target:</span> <strong style={{ color: 'var(--accent-secondary)' }}>{actorName}</strong> ({targetEmployee})
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <button className="btn btn-secondary" onClick={triggerAnniversary} style={{ width: '100%' }}>
               <Zap size={16} className="text-warning" /> Trigger HCM Anniversary (+10)
             </button>

             <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="number" 
                  className="form-input" 
                  value={driftAmount} 
                  onChange={(e) => setDriftAmount(e.target.value)}
                  style={{ width: '80px', padding: '8px' }}
                />
                <button className="btn btn-secondary" onClick={injectDrift} style={{ flex: 1 }}>
                   <TrendingUp size={16} className="text-accent" /> Inject Manual Drift
                </button>
             </div>

             <button className="btn btn-secondary" onClick={triggerYearReset} style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
               <Calendar size={16} className="text-error" /> Global Year-End Reset
             </button>
           </div>

           {hcmLog && (
             <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
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
                    {reconcileResult.critical && (
                      <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', gap: '6px' }}>
                         <AlertTriangle size={14} /> Critical Drift: Balance below reserved!
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
