import React, { useState } from 'react';
import { format } from 'date-fns';
import { useSchedule } from '../../contexts/ScheduleContext';
import './Notifications.css';

export default function AdminApprovalModal({ pendingApprovals, onClose, onApprove, onViewAll }) {
  const { helicopters } = useSchedule();
  const [approvingId, setApprovingId] = useState(null);
  const [error, setError] = useState('');

  const getHelicopterInfo = (helicopterId) => {
    const heli = helicopters.find(h => h.id === helicopterId);
    return heli ? `${heli.tailNumber} - ${heli.model}` : 'Helicopter';
  };

  const handleApprove = async (booking) => {
    setApprovingId(booking.id);
    setError('');
    
    const result = await onApprove(booking.id);
    
    setApprovingId(null);
    
    if (!result?.success) {
      setError(result?.error || 'Unable to approve flight hours');
    }
  };

  if (!pendingApprovals || pendingApprovals.length === 0) {
    return null;
  }

  return (
    <div className="nlh-modal-overlay" role="dialog" aria-modal="true" aria-label="Pending flight hour approvals">
      <div className="nlh-modal" style={{ maxWidth: '600px' }}>
        <div className="nlh-modal-header">
          <h3>Pending Flight Hour Approvals</h3>
          <button type="button" className="nlh-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="nlh-modal-body">
          <div className="nlh-modal-hint">
            {pendingApprovals.length} flight{pendingApprovals.length !== 1 ? 's' : ''} waiting for approval. 
            Approving will update the hobbs time on each helicopter.
          </div>

          {error && <div className="nlh-modal-error">{error}</div>}

          <div className="approval-list">
            {pendingApprovals.map(booking => (
              <div key={booking.id} className="approval-item">
                <div className="approval-item-info">
                  <div className="approval-item-title">
                    {booking.customerName || 'Flight'} - {booking.actualHours} hrs
                  </div>
                  <div className="approval-item-meta">
                    {getHelicopterInfo(booking.helicopterId)}
                  </div>
                  <div className="approval-item-meta">
                    {format(new Date(booking.date), 'MMM d, yyyy')}
                    {booking.actualHoursSubmittedAt && (
                      <> | Submitted {format(new Date(booking.actualHoursSubmittedAt), 'MMM d, h:mm a')}</>
                    )}
                  </div>
                </div>
                <div className="approval-item-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleApprove(booking)}
                    disabled={approvingId === booking.id}
                  >
                    {approvingId === booking.id ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="nlh-modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="btn-cancel" onClick={onClose}>
              Review Later
            </button>
            <button type="button" className="btn-secondary" onClick={onViewAll}>
              View All Messages
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .approval-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
          max-height: 300px;
          overflow-y: auto;
        }
        .approval-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: #fef3c7;
          border-radius: 10px;
          border-left: 4px solid #f59e0b;
        }
        .approval-item-info {
          flex: 1;
        }
        .approval-item-title {
          font-weight: 600;
          color: #111827;
          margin-bottom: 4px;
        }
        .approval-item-meta {
          font-size: 0.85rem;
          color: #6b7280;
        }
        .approval-item-actions {
          flex-shrink: 0;
          margin-left: 12px;
        }
        .btn-secondary {
          background: #e2e8f0;
          border: none;
          color: #475569;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-secondary:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
