import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useSchedule } from '../../contexts/ScheduleContext';
import './Notifications.css';

function formatTimeLabel(decimal) {
  const hour = Math.floor(decimal);
  const minute = decimal % 1 === 0.5 ? '30' : '00';
  if (hour === 0) return `12:${minute} AM`;
  if (hour === 12) return `12:${minute} PM`;
  if (hour < 12) return `${hour}:${minute} AM`;
  return `${hour - 12}:${minute} PM`;
}

export default function CompleteFlightModal({ booking, onClose }) {
  const { helicopters, completeFlightHours } = useSchedule();
  const [actualHours, setActualHours] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const helicopter = useMemo(
    () => helicopters.find(h => h.id === booking.helicopterId),
    [helicopters, booking.helicopterId]
  );

  const scheduledDuration = useMemo(() => {
    const endDateStr = booking.endDate || booking.date;
    if (endDateStr !== booking.date) {
      return null;
    }
    return (booking.endTime - booking.startTime);
  }, [booking]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const result = await completeFlightHours(booking.id, actualHours);
    setSaving(false);

    if (!result?.success) {
      setError(result?.error || 'Unable to save flight time');
      return;
    }

    onClose();
  };

  return (
    <div className="nlh-modal-overlay" role="dialog" aria-modal="true" aria-label="Complete flight">
      <div className="nlh-modal">
        <div className="nlh-modal-header">
          <h3>Completed Flight</h3>
          <button type="button" className="nlh-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="nlh-modal-body">
          <div className="nlh-modal-meta">
            <div><strong>Date:</strong> {format(new Date(booking.date), 'MMM d, yyyy')}</div>
            <div><strong>Time:</strong> {formatTimeLabel(booking.startTime)} - {formatTimeLabel(booking.endTime)}</div>
            <div><strong>Helicopter:</strong> {helicopter ? `${helicopter.tailNumber} - ${helicopter.model}` : 'Helicopter'}</div>
          </div>

          {scheduledDuration != null && (
            <div className="nlh-modal-hint">
              Scheduled: {scheduledDuration.toFixed(1)} hrs
            </div>
          )}

          {error && <div className="nlh-modal-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <label className="nlh-modal-label">
              Enter actual flight time (hrs)
              <input
                className="nlh-modal-input"
                type="number"
                step="0.1"
                min="0.1"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                required
                autoFocus
              />
            </label>

            <div className="nlh-modal-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Submit'}
              </button>
              <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>
                Not now
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
