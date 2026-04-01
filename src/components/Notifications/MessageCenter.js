import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSchedule } from '../../contexts/ScheduleContext';
import './MessageCenter.css';

export default function MessageCenter({ isOpen, onClose, onApproveHours }) {
  const { currentUser, isAdmin } = useAuth();
  const { bookings, helicopters } = useSchedule();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState(null);

  const loadMessages = useCallback(async () => {
    if (!currentUser?.id || !isSupabaseConfigured()) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Admins see notifications where recipient_user_id is null (broadcast to admins)
      // Users see notifications where recipient_user_id matches their ID
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (isAdmin()) {
        // Admins see both their own messages and admin broadcast messages
        query = query.or(`recipient_user_id.is.null,recipient_user_id.eq.${currentUser.id}`);
      } else {
        // Regular users only see their own messages
        query = query.eq('recipient_user_id', currentUser.id);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message || 'Unable to load messages');
        setMessages([]);
      } else {
        setMessages(data || []);
      }
    } catch (err) {
      setError('Unable to load messages');
      setMessages([]);
    }

    setLoading(false);
  }, [currentUser?.id, isAdmin]);

  useEffect(() => {
    if (isOpen) {
      loadMessages();
    }
  }, [isOpen, loadMessages]);

  const handleMarkRead = async (messageId) => {
    if (!isSupabaseConfigured()) return;

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);

    if (!updateError) {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, read_at: new Date().toISOString() } : m
      ));
    }
  };

  const handleApproveHours = async (bookingId) => {
    setApprovingId(bookingId);
    
    if (onApproveHours) {
      const result = await onApproveHours(bookingId);
      if (result?.success) {
        // Refresh messages after approval
        await loadMessages();
      }
    }
    
    setApprovingId(null);
  };

  const getHelicopterInfo = (helicopterId) => {
    const heli = helicopters.find(h => h.id === helicopterId);
    return heli ? `${heli.tailNumber} - ${heli.model}` : 'Helicopter';
  };

  if (!isOpen) return null;

  // Get pending flight hour approvals (for admins)
  const pendingApprovals = isAdmin() 
    ? messages.filter(m => {
        if (m.type !== 'flight_hours_submitted') return false;
        const booking = bookings.find(b => b.id === m.booking_id);
        return booking && booking.actualHoursStatus === 'pending';
      })
    : [];

  const otherMessages = messages.filter(m => !pendingApprovals.includes(m));

  return (
    <div className="message-center-overlay" onClick={onClose}>
      <div className="message-center-panel" onClick={e => e.stopPropagation()}>
        <div className="message-center-header">
          <h3>Message Center</h3>
          <button type="button" className="message-center-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="message-center-body">
          {loading ? (
            <div className="message-center-empty">Loading messages...</div>
          ) : error ? (
            <div className="message-center-error">{error}</div>
          ) : messages.length === 0 ? (
            <div className="message-center-empty">No messages</div>
          ) : (
            <>
              {/* Pending Approvals Section (Admin only) */}
              {pendingApprovals.length > 0 && (
                <div className="message-section">
                  <div className="message-section-header">
                    <span className="message-section-icon">!</span>
                    Pending Flight Hour Approvals ({pendingApprovals.length})
                  </div>
                  {pendingApprovals.map(msg => {
                    const booking = bookings.find(b => b.id === msg.booking_id);
                    return (
                      <div key={msg.id} className="message-item message-item-urgent">
                        <div className="message-item-content">
                          <div className="message-item-title">{msg.title || msg.type}</div>
                          <div className="message-item-text">{msg.message}</div>
                          {booking && (
                            <div className="message-item-meta">
                              {getHelicopterInfo(booking.helicopterId)} | {booking.actualHours} hrs submitted
                            </div>
                          )}
                          <div className="message-item-date">
                            {format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}
                          </div>
                        </div>
                        {booking && (
                          <div className="message-item-actions">
                            <button
                              type="button"
                              className="btn-approve"
                              onClick={() => handleApproveHours(booking.id)}
                              disabled={approvingId === booking.id}
                            >
                              {approvingId === booking.id ? 'Approving...' : `Approve ${booking.actualHours} hrs`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Other Messages Section */}
              {otherMessages.length > 0 && (
                <div className="message-section">
                  {pendingApprovals.length > 0 && (
                    <div className="message-section-header">Other Messages</div>
                  )}
                  {otherMessages.map(msg => (
                    <div 
                      key={msg.id} 
                      className={`message-item ${msg.read_at ? 'message-item-read' : ''}`}
                    >
                      <div className="message-item-content">
                        <div className="message-item-title">{msg.title || msg.type}</div>
                        <div className="message-item-text">{msg.message}</div>
                        <div className="message-item-date">
                          {format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                      {!msg.read_at && (
                        <div className="message-item-actions">
                          <button
                            type="button"
                            className="btn-mark-read"
                            onClick={() => handleMarkRead(msg.id)}
                          >
                            Mark Read
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
