import React, { useState, useId } from 'react';
import { format } from 'date-fns';
import { useSchedule } from '../../contexts/ScheduleContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateGoogleCalendarUrl, createGoogleCalendarEvent, generateBookingMailtoUrl } from '../../lib/notifications';
import { validateBookingForm } from '../../utils/validation';
import { useFocusTrap } from '../../hooks/useFocusTrap';

// Generate time options in half-hour increments for 24 hours
const TIME_OPTIONS = [];
for (let hour = 0; hour < 24; hour++) {
  TIME_OPTIONS.push({ value: hour, label: formatTimeLabel(hour) });
  TIME_OPTIONS.push({ value: hour + 0.5, label: formatTimeLabel(hour + 0.5) });
}

function formatTimeLabel(decimal) {
  const hour = Math.floor(decimal);
  const minute = decimal % 1 === 0.5 ? '30' : '00';
  if (hour === 0) return `12:${minute} AM`;
  if (hour === 12) return `12:${minute} PM`;
  if (hour < 12) return `${hour}:${minute} AM`;
  return `${hour - 12}:${minute} PM`;
}

function BookingModal({ booking, slot, onClose }) {
  const { helicopters, instructors, createBooking, updateBooking, deleteBooking, cancelBooking } = useSchedule();
  const { currentUser, isAdmin, users, hasGoogleCalendarAccess, getGoogleAccessToken } = useAuth();
  
  const isEditing = !!booking;
  const isOwner = booking?.userId === currentUser?.id;
  const canEdit = isAdmin() || isOwner || !isEditing;
  const isAdminUser = isAdmin();
  const initialUserId = booking?.userId || (isAdminUser ? '' : currentUser?.id || '');
  const initialCustomerName = booking?.customerName || (isAdminUser ? '' : currentUser?.name || '');
  const initialCustomerEmail = booking?.customerEmail || (isAdminUser ? '' : currentUser?.email || '');

  const [formData, setFormData] = useState({
    userId: initialUserId,
    helicopterId: slot?.helicopterId || booking?.helicopterId || '',
    date: slot?.date || booking?.date || format(new Date(), 'yyyy-MM-dd'),
    endDate: slot?.date || booking?.endDate || booking?.date || format(new Date(), 'yyyy-MM-dd'),
    startTime: slot?.startTime || booking?.startTime || 8,
    endTime: slot?.endTime || booking?.endTime || 9,
    customerName: initialCustomerName,
    customerPhone: booking?.customerPhone || '',
    customerEmail: initialCustomerEmail,
    instructorId: booking?.instructorId || '',
    type: booking?.type || 'training',
    notes: booking?.notes || ''
  });

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [sendEmailDraft, setSendEmailDraft] = useState(true);
  
  // Accessibility: unique IDs for form elements
  const formId = useId();
  const errorId = `${formId}-error`;
  
  // Accessibility: focus trap for modal
  const modalRef = useFocusTrap(true, {
    autoFocus: true,
    restoreFocus: true,
    escapeDeactivates: true,
    onEscape: onClose
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: null }));
    }
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: name === 'startTime' || name === 'endTime' ? parseFloat(value) : value
      };

      if (name === 'userId' && isAdminUser) {
        const selectedUser = (users || []).find(u => u.id === value);
        if (selectedUser) {
          newData.customerName = selectedUser.name || '';
          newData.customerEmail = selectedUser.email || '';
          newData.customerPhone = selectedUser.phone || '';
        } else if (!isEditing) {
          newData.customerName = '';
          newData.customerEmail = '';
          newData.customerPhone = '';
        }
      }
      
      // Auto-sync endDate when start date changes (if endDate would be before new start date)
      if (name === 'date' && newData.endDate < value) {
        newData.endDate = value;
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Validate form using validation utility
    const validation = validateBookingForm(formData);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      // Show first error as main error message
      const firstError = Object.values(validation.errors)[0];
      setError(firstError);
      return;
    }

    const bookingData = {
      ...formData,
      userId: isAdminUser ? formData.userId : currentUser.id
    };

    if (isAdminUser && !bookingData.userId) {
      setError('Select a user for this booking');
      return;
    }

    let savedBooking;

    if (isEditing) {
      const result = await updateBooking(booking.id, bookingData);
      if (!result?.success) {
        setError(result?.error || 'Unable to update booking');
        return;
      }
      savedBooking = { ...booking, ...bookingData };
    } else {
      const result = await createBooking(bookingData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      savedBooking = result.booking;
    }

    if (sendEmailDraft) {
      const mailtoUrl = generateBookingMailtoUrl(
        {
          ...savedBooking,
          ...getEmailBookingData()
        },
        isEditing ? 'updated' : 'created'
      );

      if (mailtoUrl) {
        window.location.href = mailtoUrl;
      }
    }

    onClose();
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      const result = await deleteBooking(booking.id);
      if (!result?.success) {
        setError(result?.error || 'Unable to delete booking');
        return;
      }
      onClose();
    }
  };

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      const result = await cancelBooking(booking.id);
      if (!result?.success) {
        setError(result?.error || 'Unable to cancel booking');
        return;
      }
      onClose();
    }
  };

  const selectedHelicopter = helicopters.find(h => h.id === formData.helicopterId);
  const selectedInstructor = instructors.find(i => i.id === formData.instructorId);
  const selectedInstructorCertifications = Array.isArray(selectedInstructor?.certifications)
    ? selectedInstructor.certifications
    : [];
  
  // Calculate duration across days
  const calculateDuration = () => {
    const startDate = new Date(formData.date);
    const endDate = new Date(formData.endDate);
    const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      return formData.endTime - formData.startTime;
    } else {
      // Hours from start day (until midnight) + full days + hours on end day
      const hoursFirstDay = 24 - formData.startTime;
      const hoursLastDay = formData.endTime;
      const fullDaysHours = (daysDiff - 1) * 24;
      return hoursFirstDay + fullDaysHours + hoursLastDay;
    }
  };
  
  const duration = calculateDuration();

  // Prepare booking data for calendar
  const getCalendarBookingData = () => ({
    date: formData.date,
    endDate: formData.endDate,
    startTime: formData.startTime,
    endTime: formData.endTime,
    helicopter: selectedHelicopter,
    instructor: selectedInstructor,
    customerName: formData.customerName,
    customerEmail: formData.customerEmail,
    flightType: formData.type,
    notes: formData.notes
  });

  const getEmailBookingData = () => ({
    ...formData,
    helicopter: selectedHelicopter,
    instructor: selectedInstructor,
    flightType: formData.type
  });

  const handleAddToGoogleCalendar = async () => {
    if (!selectedHelicopter) {
      setError('Select a helicopter before adding to Google Calendar');
      return;
    }
    
    const bookingData = getCalendarBookingData();
    setError('');
    
    // If user has Google Calendar access via OAuth, create event directly
    if (hasGoogleCalendarAccess()) {
      setAddingToCalendar(true);
      try {
        const token = getGoogleAccessToken();
        await createGoogleCalendarEvent(token, bookingData);
        setCalendarAdded(true);
      } catch (err) {
        // Fallback to URL method
        const calendarUrl = generateGoogleCalendarUrl(bookingData);
        const popup = window.open(calendarUrl, '_blank', 'noopener,noreferrer');
        if (!popup) {
          setError('Google Calendar popup was blocked. Allow popups and try again.');
        } else {
          setCalendarAdded(true);
        }
      }
      setAddingToCalendar(false);
    } else {
      // Open Google Calendar URL in new tab
      const calendarUrl = generateGoogleCalendarUrl(bookingData);
      const popup = window.open(calendarUrl, '_blank', 'noopener,noreferrer');
      if (!popup) {
        setError('Google Calendar popup was blocked. Allow popups and try again.');
        return;
      }
      setCalendarAdded(true);
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      role="presentation"
    >
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        aria-describedby={error ? errorId : undefined}
      >
        <div className="modal-header">
          <h2 id={`${formId}-title`}>{isEditing ? 'Edit Booking' : 'New Booking'}</h2>
          <button 
            className="modal-close" 
            onClick={onClose}
            aria-label="Close dialog"
            type="button"
          >
            &times;
          </button>
        </div>

        {error && (
          <div 
            className="modal-error" 
            id={errorId}
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="booking-form">
          {isAdminUser && (
            <div className="form-row">
              <div className="form-group">
                <label>Book For</label>
                <select
                  name="userId"
                  value={formData.userId}
                  onChange={handleChange}
                  disabled={!canEdit}
                  required
                >
                  <option value="">Select User</option>
                  {(users || []).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Helicopter</label>
              <select 
                name="helicopterId" 
                value={formData.helicopterId} 
                onChange={handleChange}
                disabled={!canEdit}
                required
              >
                <option value="">Select Helicopter</option>
                {helicopters.filter(h => h.status === 'available' || h.id === formData.helicopterId).map(h => (
                  <option key={h.id} value={h.id}>
                    {h.tailNumber} - {h.model} (${h.hourlyRate}/hr)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                disabled={!canEdit}
                required
              />
            </div>

            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                disabled={!canEdit}
                required
                min={formData.date}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Time</label>
              <select 
                name="startTime" 
                value={formData.startTime} 
                onChange={handleChange}
                disabled={!canEdit}
              >
                {TIME_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>End Time</label>
              <select 
                name="endTime" 
                value={formData.endTime} 
                onChange={handleChange}
                disabled={!canEdit}
              >
                {TIME_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Customer Name</label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                disabled={!canEdit}
                required
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="customerEmail"
                value={formData.customerEmail}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </div>

            <div className="form-group">
              <label>Instructor (Optional)</label>
              <select 
                name="instructorId" 
                value={formData.instructorId} 
                onChange={handleChange}
                disabled={!canEdit}
              >
                <option value="">No Instructor</option>
                {instructors.filter(i => i.status === 'active').map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name}{Array.isArray(i.certifications) && i.certifications.length > 0 ? ` (${i.certifications.join(', ')})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Booking Type</label>
            <select 
              name="type" 
              value={formData.type} 
              onChange={handleChange}
              disabled={!canEdit}
            >
              <option value="training">Flight Training</option>
              <option value="rental">Rental</option>
              <option value="tour">Tour</option>
              <option value="checkride">Checkride</option>
              {isAdmin() && <option value="maintenance">Maintenance</option>}
            </select>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              disabled={!canEdit}
              rows={3}
              placeholder="Any special requirements or notes..."
            />
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={sendEmailDraft}
                onChange={(e) => setSendEmailDraft(e.target.checked)}
                disabled={!canEdit}
              />
              Open booking email draft for student and CFI after save
            </label>
          </div>

          {selectedHelicopter && (
            <div className="booking-summary">
              <div className="summary-row">
                <span>Duration:</span>
                <span>{duration} hour{duration > 1 ? 's' : ''}</span>
              </div>
              {selectedInstructor && (
                <div className="summary-row">
                  <span>CFI:</span>
                  <span>
                    {selectedInstructor.name}
                    {selectedInstructorCertifications.length > 0 ? ` (${selectedInstructorCertifications.join(', ')})` : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            {canEdit && (
              <button type="submit" className="btn-primary">
                {isEditing ? 'Update Booking' : 'Create Booking'}
              </button>
            )}
            
            {selectedHelicopter && canEdit && (
              <button 
                type="button" 
                className="btn-calendar"
                onClick={handleAddToGoogleCalendar}
                disabled={addingToCalendar || calendarAdded}
              >
                {calendarAdded ? 'Added to Calendar' : addingToCalendar ? 'Adding...' : 'Add to Google Calendar'}
              </button>
            )}
            
            {isEditing && (isAdmin() || isOwner) && (
              <>
                <button type="button" className="btn-secondary" onClick={handleCancel}>
                  Cancel Booking
                </button>
                {isAdmin() && (
                  <button type="button" className="btn-danger" onClick={handleDelete}>
                    Delete
                  </button>
                )}
              </>
            )}
            
            <button type="button" className="btn-cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookingModal;
