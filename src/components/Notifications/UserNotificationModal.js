import React from 'react';
import './Notifications.css';

export default function UserNotificationModal({ notification, onClose, onMarkRead, busy }) {
  if (!notification) return null;

  const handleAcknowledge = async () => {
    await onMarkRead(notification.id);
  };

  return (
    <div className="nlh-modal-overlay" role="dialog" aria-modal="true" aria-label="Booking update notification">
      <div className="nlh-modal">
        <div className="nlh-modal-header">
          <h3>{notification.title || 'Booking update'}</h3>
          <button type="button" className="nlh-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="nlh-modal-body">
          <div className="nlh-modal-hint">You have a new booking update.</div>
          <div className="nlh-modal-meta">
            <div>{notification.message}</div>
          </div>
          <div className="nlh-modal-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={handleAcknowledge}>
              {busy ? 'Saving...' : 'Acknowledge'}
            </button>
            <button type="button" className="btn-cancel" disabled={busy} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
