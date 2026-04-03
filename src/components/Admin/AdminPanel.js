import React, { useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { useSchedule } from '../../contexts/ScheduleContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import BookingModal from '../Schedule/BookingModal';
import ScheduleGrid from '../Schedule/ScheduleGrid';
import './Admin.css';

function formatAdminTime(decimal) {
  const hour = Math.floor(decimal);
  const minute = decimal % 1 === 0.5 ? '30' : '00';
  if (hour === 0) return `12:${minute} AM`;
  if (hour === 12) return `12:${minute} PM`;
  if (hour < 12) return `${hour}:${minute} AM`;
  return `${hour - 12}:${minute} PM`;
}

function getBookingSegmentForDate(booking, dateStr) {
  const bookingEndDate = booking.endDate || booking.date;
  if (dateStr < booking.date || dateStr > bookingEndDate) {
    return null;
  }

  const isStartDay = dateStr === booking.date;
  const isEndDay = dateStr === bookingEndDate;

  return {
    ...booking,
    displayStart: isStartDay ? booking.startTime : 0,
    displayEnd: isEndDay ? booking.endTime : 24,
    isContinuation: !isStartDay
  };
}

function HelicopterManagement() {
  const { helicopters, addHelicopter, updateHelicopter, deleteHelicopter } = useSchedule();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    tailNumber: '',
    model: '',
    hourlyRate: '',
    status: 'available',
    hobbsTime: '',
    inspection50Hour: '',
    inspection100Hour: ''
  });

  const resetForm = () => {
    setFormData({
      tailNumber: '',
      model: '',
      hourlyRate: '',
      status: 'available',
      hobbsTime: '',
      inspection50Hour: '',
      inspection100Hour: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (helicopter) => {
    setFormData({
      tailNumber: helicopter.tailNumber,
      model: helicopter.model,
      hourlyRate: helicopter.hourlyRate,
      status: helicopter.status,
      hobbsTime: helicopter.hobbsTime || 0,
      inspection50Hour: helicopter.inspection50Hour || '',
      inspection100Hour: helicopter.inspection100Hour || ''
    });
    setEditingId(helicopter.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      hourlyRate: parseFloat(formData.hourlyRate),
      hobbsTime: parseFloat(formData.hobbsTime) || 0,
      inspection50Hour: formData.inspection50Hour ? parseFloat(formData.inspection50Hour) : null,
      inspection100Hour: formData.inspection100Hour ? parseFloat(formData.inspection100Hour) : null
    };

    if (editingId) {
      await updateHelicopter(editingId, data);
    } else {
      await addHelicopter(data);
    }
    resetForm();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this helicopter?')) {
      await deleteHelicopter(id);
    }
  };

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>Helicopter Fleet</h2>
        <button className="btn-add" onClick={() => setShowForm(true)}>
          + Add Helicopter
        </button>
      </div>

      {showForm && (
        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Tail Number</label>
              <input
                type="text"
                value={formData.tailNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, tailNumber: e.target.value }))}
                required
                placeholder="N44NL"
              />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                required
                placeholder="R44 Raven II"
              />
            </div>
            <div className="form-group">
              <label>Hourly Rate ($)</label>
              <input
                type="number"
                value={formData.hourlyRate}
                onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                required
                min="0"
                placeholder="350"
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="available">Available</option>
                <option value="maintenance">Maintenance</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
            <div className="form-group">
              <label>Hobbs Time (hrs)</label>
              <input
                type="number"
                step="0.1"
                value={formData.hobbsTime}
                onChange={(e) => setFormData(prev => ({ ...prev, hobbsTime: e.target.value }))}
                required
                min="0"
                placeholder="0.0"
              />
            </div>
            <div className="form-group">
              <label>50hr Inspection Due At (hrs)</label>
              <input
                type="number"
                step="0.1"
                value={formData.inspection50Hour}
                onChange={(e) => setFormData(prev => ({ ...prev, inspection50Hour: e.target.value }))}
                min="0"
                placeholder="Hobbs time when due"
              />
            </div>
            <div className="form-group">
              <label>100hr Inspection Due At (hrs)</label>
              <input
                type="number"
                step="0.1"
                value={formData.inspection100Hour}
                onChange={(e) => setFormData(prev => ({ ...prev, inspection100Hour: e.target.value }))}
                min="0"
                placeholder="Hobbs time when due"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingId ? 'Update' : 'Add'} Helicopter
            </button>
            <button type="button" className="btn-cancel" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Tail Number</th>
            <th>Model</th>
            <th>Rate/hr</th>
            <th>Status</th>
            <th>Hobbs Time</th>
            <th>50hr Insp</th>
            <th>100hr Insp</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {helicopters.map(h => {
            const hobbsTime = h.hobbsTime || 0;
            const due50 = h.inspection50Hour != null ? parseFloat(h.inspection50Hour) : null;
            const due100 = h.inspection100Hour != null ? parseFloat(h.inspection100Hour) : null;
            const remaining50 = due50 != null ? (due50 - hobbsTime) : null;
            const remaining100 = due100 != null ? (due100 - hobbsTime) : null;
            return (
            <tr key={h.id}>
              <td className="tail-number">{h.tailNumber}</td>
              <td>{h.model}</td>
              <td className="rate">${h.hourlyRate}</td>
              <td>
                <span className={`status-badge ${h.status}`}>
                  {h.status}
                </span>
              </td>
              <td className="hobbs-time">{hobbsTime.toFixed(1)} hrs</td>
              <td className={`inspection-cell ${remaining50 !== null && remaining50 <= 5 ? 'due-soon' : ''} ${remaining50 !== null && remaining50 <= 0 ? 'overdue' : ''}`}>
                {remaining50 !== null ? `${remaining50.toFixed(1)} hrs left` : '-'}
              </td>
              <td className={`inspection-cell ${remaining100 !== null && remaining100 <= 10 ? 'due-soon' : ''} ${remaining100 !== null && remaining100 <= 0 ? 'overdue' : ''}`}>
                {remaining100 !== null ? `${remaining100.toFixed(1)} hrs left` : '-'}
              </td>
              <td className="actions">
                <button className="btn-edit" onClick={() => handleEdit(h)}>Edit</button>
                <button className="btn-delete" onClick={() => handleDelete(h.id)}>Delete</button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UserManagement() {
  const { users, deleteUser } = useAuth();

  const handleDelete = (userId, userName) => {
    if (window.confirm(`Are you sure you want to delete user "${userName}"?`)) {
      const result = deleteUser(userId);
      if (!result.success) {
        alert(result.error);
      }
    }
  };

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>Registered Users</h2>
        <span className="user-count">{users.length} users</span>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Registered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td className="user-name">{user.name}</td>
              <td>{user.email}</td>
              <td>
                <span className={`role-badge ${user.role}`}>
                  {user.role}
                </span>
              </td>
              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
              <td className="actions">
                {user.role !== 'admin' && (
                  <button 
                    className="btn-delete" 
                    onClick={() => handleDelete(user.id, user.name)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminDashboard() {
  const { helicopters, bookings, instructors, approveFlightHours } = useSchedule();
  const { users, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [notificationActionError, setNotificationActionError] = useState('');
  const [approvingBookingId, setApprovingBookingId] = useState(null);
  const [notificationsCollapsed, setNotificationsCollapsed] = useState(false);
  const [deletingNotificationId, setDeletingNotificationId] = useState(null);

  const loadNotifications = React.useCallback(async () => {
      if (!isAdmin()) {
        setNotifications([]);
        setNotificationsLoading(false);
        return;
      }
      if (!isSupabaseConfigured()) {
        setNotifications([]);
        setNotificationsError('Supabase is not configured. Notifications require Supabase.');
        setNotificationsLoading(false);
        return;
      }

      setNotificationsLoading(true);
      setNotificationsError('');
      
      try {
        const query = supabase
          .from('notifications')
          .select('*')
          .is('recipient_user_id', null)
          .order('created_at', { ascending: false })
          .limit(20);

        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timed out')), 10000)
        );
        
        const { data, error } = await Promise.race([query, timeoutPromise]);

        if (data && !error) {
          setNotifications(data);
        } else if (error) {
          console.error('Admin notifications error:', error);
          setNotifications([]);
          setNotificationsError(error.message || 'Unable to load notifications');
        }
      } catch (err) {
        console.error('Admin notifications error:', err);
        setNotifications([]);
        setNotificationsError(err.message || 'Unable to load notifications');
      } finally {
        setNotificationsLoading(false);
      }
    }, [isAdmin]);

  React.useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleApproveHours = async (bookingId) => {
    setNotificationActionError('');
    setApprovingBookingId(bookingId);
    const result = await approveFlightHours(bookingId);
    setApprovingBookingId(null);

    if (!result?.success) {
      setNotificationActionError(result?.error || 'Unable to approve flight hours');
      return;
    }

    await loadNotifications();
  };

  const handleDeleteNotification = async (notificationId) => {
    if (!isSupabaseConfigured()) return;
    
    setDeletingNotificationId(notificationId);
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    
    setDeletingNotificationId(null);
    
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }
  };
  const compactWeekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 0 }), []);
  const compactWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(compactWeekStart, index)),
    [compactWeekStart]
  );

  const activeBookings = bookings.filter(b => b.status === 'confirmed').length;
  const availableHelicopters = helicopters.filter(h => h.status === 'available').length;

  const bookingsByCompactDay = compactWeekDays.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayBookings = bookings
      .filter(booking => booking.status === 'confirmed')
      .map(booking => getBookingSegmentForDate(booking, dateStr))
      .filter(Boolean)
      .sort((left, right) => left.displayStart - right.displayStart);

    return {
      date: day,
      dateStr,
      bookings: dayBookings
    };
  });

  return (
    <div className="admin-dashboard">
      <h2>Dashboard Overview</h2>

      {isAdmin() && (
        <div className="admin-notifications-panel">
          <div 
            className="admin-notifications-header"
            onClick={() => setNotificationsCollapsed(!notificationsCollapsed)}
          >
            <div className="admin-notifications-title">
              <span className={`collapse-icon ${notificationsCollapsed ? 'collapsed' : ''}`}>▼</span>
              <h3>Notifications</h3>
              {notifications.length > 0 && (
                <span className="notification-count-badge">{notifications.length}</span>
              )}
            </div>
            <span className="admin-notifications-hint">{notificationsCollapsed ? 'Click to expand' : 'Click to minimize'}</span>
          </div>
          {!notificationsCollapsed && (
            <div className="admin-notifications-body">
              {notificationActionError && (
                <div className="admin-notification-error">{notificationActionError}</div>
              )}
              {notificationsLoading ? (
                <div className="admin-notification-empty">Loading notifications...</div>
              ) : notificationsError ? (
                <div className="admin-notification-empty">{notificationsError}</div>
              ) : notifications.length === 0 ? (
                <div className="admin-notification-empty">No notifications yet.</div>
              ) : (
                notifications.map(n => {
                  const relatedBooking = bookings.find(b => b.id === n.booking_id);
                  const helicopter = relatedBooking ? helicopters.find(h => h.id === relatedBooking.helicopterId) : null;
                  const canApprove = n.type === 'flight_hours_submitted'
                    && relatedBooking
                    && relatedBooking.actualHoursStatus === 'pending';
                  const currentHobbs = helicopter?.hobbsTime || 0;
                  const newHobbs = currentHobbs + (relatedBooking?.actualHours || 0);

                  return (
                    <div key={n.id} className="admin-notification-item">
                      <div className="admin-notification-content">
                        <div className="admin-notification-title">{n.title || n.type}</div>
                        <div className="admin-notification-message">{n.message}</div>
                        {canApprove && helicopter && (
                          <div className="admin-notification-hobbs">
                            <strong>{helicopter.tailNumber}</strong> Hobbs: {currentHobbs.toFixed(1)} hrs → {newHobbs.toFixed(1)} hrs (+{relatedBooking.actualHours} hrs)
                          </div>
                        )}
                        {canApprove && (
                          <div className="admin-notification-actions">
                            <button
                              type="button"
                              className="btn-approve-sm"
                              onClick={() => handleApproveHours(relatedBooking.id)}
                              disabled={approvingBookingId === relatedBooking.id}
                            >
                              {approvingBookingId === relatedBooking.id ? 'Approving...' : `Approve ${relatedBooking.actualHours} hrs`}
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-delete-notification"
                        onClick={() => handleDeleteNotification(n.id)}
                        disabled={deletingNotificationId === n.id}
                        title="Delete notification"
                      >
                        {deletingNotificationId === n.id ? '...' : '×'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{helicopters.length}</div>
          <div className="stat-label">Total Helicopters</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{availableHelicopters}</div>
          <div className="stat-label">Available Now</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeBookings}</div>
          <div className="stat-label">Active Bookings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Registered Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{instructors.length}</div>
          <div className="stat-label">CFIs</div>
        </div>
      </div>

      <div className="admin-mini-calendar-panel">
        <div className="admin-mini-calendar-header">
          <h3>This Week's Bookings</h3>
          <span>{format(compactWeekStart, 'MMM d')} - {format(addDays(compactWeekStart, 6), 'MMM d, yyyy')}</span>
        </div>
        <div className="admin-mini-calendar-grid">
          {bookingsByCompactDay.map((day) => (
            <div key={day.dateStr} className="admin-mini-day">
              <div className="admin-mini-day-header">
                <div className="admin-mini-day-name">{format(day.date, 'EEE')}</div>
                <div className="admin-mini-day-date">{format(day.date, 'MMM d')}</div>
              </div>
              <div className="admin-mini-day-body">
                {day.bookings.length === 0 ? (
                  <div className="admin-mini-empty">No bookings</div>
                ) : (
                  day.bookings.map((booking) => {
                    const helicopter = helicopters.find(h => h.id === booking.helicopterId);
                    return (
                      <div key={`${day.dateStr}-${booking.id}`} className="admin-mini-booking-card">
                        <div className="admin-mini-booking-time">
                          {formatAdminTime(booking.displayStart)} - {formatAdminTime(booking.displayEnd)}
                        </div>
                        <div className="admin-mini-booking-name">
                          {booking.isContinuation ? '... ' : ''}{booking.customerName || 'Booked Flight'}
                        </div>
                        <div className="admin-mini-booking-meta">
                          {helicopter ? `${helicopter.tailNumber} ${helicopter.model}` : 'Helicopter'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminScheduleManagement() {
  return <ScheduleGrid />;
}

function BookingListManagement() {
  const { bookings, helicopters, instructors } = useSchedule();
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
  const [selectedBooking, setSelectedBooking] = useState(null);

  const sortedBookings = useMemo(() => {
    const rows = bookings
      .filter(booking => booking.type !== 'maintenance')
      .map(booking => ({
        ...booking,
        helicopterLabel: helicopters.find(h => h.id === booking.helicopterId)?.tailNumber || '-',
        instructorLabel: instructors.find(i => i.id === booking.instructorId)?.name || '-',
        customerLabel: booking.customerName || '-',
        statusLabel: booking.status || 'confirmed'
      }));

    rows.sort((left, right) => {
      const leftValue = left[sortConfig.key] ?? '';
      const rightValue = right[sortConfig.key] ?? '';

      if (leftValue < rightValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [bookings, helicopters, instructors, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>Booking List</h2>
        <span className="user-count">{sortedBookings.length} bookings</span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('date')}>Date</th>
              <th className="sortable" onClick={() => handleSort('customerLabel')}>Student</th>
              <th className="sortable" onClick={() => handleSort('instructorLabel')}>CFI</th>
              <th className="sortable" onClick={() => handleSort('helicopterLabel')}>Helicopter</th>
              <th>Time</th>
              <th className="sortable" onClick={() => handleSort('statusLabel')}>Status</th>
              <th>Quick Edit</th>
            </tr>
          </thead>
          <tbody>
            {sortedBookings.map(booking => (
              <tr key={booking.id}>
                <td>{booking.date}{booking.endDate && booking.endDate !== booking.date ? ` to ${booking.endDate}` : ''}</td>
                <td className="user-name">{booking.customerLabel}</td>
                <td>{booking.instructorLabel}</td>
                <td>{booking.helicopterLabel}</td>
                <td>{formatAdminTime(booking.startTime)} - {formatAdminTime(booking.endTime)}</td>
                <td>
                  <span className={`status-badge ${booking.statusLabel}`}>
                    {booking.statusLabel}
                  </span>
                </td>
                <td className="actions">
                  <button className="btn-edit" onClick={() => setSelectedBooking(booking)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
}

function MaintenanceManagement() {
  const { helicopters, bookings, createBooking, updateBooking, deleteBooking } = useSchedule();
  const { currentUser } = useAuth();
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    helicopterId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: 0,
    endTime: 24,
    notes: ''
  });

  const maintenanceBookings = useMemo(() => (
    bookings
      .filter(booking => booking.type === 'maintenance' && booking.status !== 'cancelled')
      .sort((left, right) => `${left.date}-${left.startTime}`.localeCompare(`${right.date}-${right.startTime}`))
  ), [bookings]);

  const resetForm = () => {
    setEditingId(null);
    setError('');
    setFormData({
      helicopterId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      startTime: 0,
      endTime: 24,
      notes: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentUser?.id) {
      setError('You must be signed in to create maintenance blocks.');
      return;
    }

    if (!formData.helicopterId) {
      setError('Please select a helicopter.');
      return;
    }

    if (!formData.date || !formData.endDate) {
      setError('Please select start and end dates.');
      return;
    }

    if (formData.date === formData.endDate && Number(formData.endTime) <= Number(formData.startTime)) {
      setError('End time must be after start time for same-day maintenance.');
      return;
    }

    const maintenanceBooking = {
      helicopterId: formData.helicopterId,
      date: formData.date,
      endDate: formData.endDate,
      startTime: Number(formData.startTime),
      endTime: Number(formData.endTime),
      customerName: 'Maintenance Block',
      customerPhone: '',
      customerEmail: '',
      instructorId: '',
      type: 'maintenance',
      notes: formData.notes,
      userId: currentUser?.id
    };

    try {
      const result = editingId
        ? await updateBooking(editingId, maintenanceBooking)
        : await createBooking(maintenanceBooking);

      if (!result?.success) {
        setError(result?.error || 'Unable to save maintenance block. Please try again.');
        return;
      }

      resetForm();
    } catch (err) {
      console.error('Maintenance booking error:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleEdit = (booking) => {
    setEditingId(booking.id);
    setError('');
    setFormData({
      helicopterId: booking.helicopterId,
      date: booking.date,
      endDate: booking.endDate || booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      notes: booking.notes || ''
    });
  };

  const handleDelete = async (bookingId) => {
    if (window.confirm('Delete this maintenance block?')) {
      await deleteBooking(bookingId);
    }
  };

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>Maintenance Scheduling</h2>
        <span className="user-count">Block aircraft by date range</span>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>Helicopter</label>
            <select
              value={formData.helicopterId}
              onChange={(e) => setFormData(prev => ({ ...prev, helicopterId: e.target.value }))}
              required
            >
              <option value="">Select Helicopter</option>
              {helicopters.map(helicopter => (
                <option key={helicopter.id} value={helicopter.id}>
                  {helicopter.tailNumber} - {helicopter.model}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value, endDate: prev.endDate < e.target.value ? e.target.value : prev.endDate }))}
              required
            />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              value={formData.endDate}
              min={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Start Time</label>
            <select
              value={formData.startTime}
              onChange={(e) => setFormData(prev => ({ ...prev, startTime: Number(e.target.value) }))}
            >
              <option value={0}>12:00 AM</option>
              <option value={6}>6:00 AM</option>
              <option value={8}>8:00 AM</option>
              <option value={12}>12:00 PM</option>
              <option value={18}>6:00 PM</option>
            </select>
          </div>
          <div className="form-group">
            <label>End Time</label>
            <select
              value={formData.endTime}
              onChange={(e) => setFormData(prev => ({ ...prev, endTime: Number(e.target.value) }))}
            >
              <option value={6}>6:00 AM</option>
              <option value={12}>12:00 PM</option>
              <option value={18}>6:00 PM</option>
              <option value={24}>11:59 PM</option>
            </select>
          </div>
          <div className="form-group form-group-wide">
            <label>Notes</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Maintenance reason or work scope"
            />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editingId ? 'Update Maintenance Block' : 'Add Maintenance Block'}
          </button>
          <button type="button" className="btn-cancel" onClick={resetForm}>
            Clear
          </button>
        </div>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Helicopter</th>
              <th>Date Range</th>
              <th>Time</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {maintenanceBookings.map(booking => {
              const helicopter = helicopters.find(item => item.id === booking.helicopterId);
              return (
                <tr key={booking.id}>
                  <td>{helicopter ? `${helicopter.tailNumber} ${helicopter.model}` : 'Helicopter'}</td>
                  <td>{booking.date}{(booking.endDate || booking.date) !== booking.date ? ` to ${booking.endDate}` : ''}</td>
                  <td>{formatAdminTime(booking.startTime)} - {formatAdminTime(booking.endTime === 24 ? 23.5 : booking.endTime)}{booking.endTime === 24 ? ' +' : ''}</td>
                  <td>{booking.notes || '-'}</td>
                  <td className="actions">
                    <button className="btn-edit" onClick={() => handleEdit(booking)}>Edit</button>
                    <button className="btn-delete" onClick={() => handleDelete(booking.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InstructorManagement() {
  const { instructors, addInstructor, updateInstructor, deleteInstructor } = useSchedule();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    certifications: '',
    status: 'active'
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      certifications: '',
      status: 'active'
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (instructor) => {
    setFormData({
      name: instructor.name,
      email: instructor.email || '',
      phone: instructor.phone || '',
      certifications: Array.isArray(instructor.certifications) ? instructor.certifications.join(', ') : '',
      status: instructor.status || 'active'
    });
    setEditingId(instructor.id);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const certArray = formData.certifications
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    
    const submitData = {
      ...formData,
      certifications: certArray
    };
    
    if (editingId) {
      updateInstructor(editingId, submitData);
    } else {
      addInstructor(submitData);
    }
    resetForm();
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete CFI "${name}"?`)) {
      deleteInstructor(id);
    }
  };

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>CFI Management</h2>
        <button className="btn-add" onClick={() => setShowForm(true)}>
          + Add CFI
        </button>
      </div>

      {showForm && (
        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Certifications (comma-separated)</label>
              <input
                type="text"
                value={formData.certifications}
                onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                placeholder="e.g. CFI, CFII, MEI"
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-save">
              {editingId ? 'Update CFI' : 'Add CFI'}
            </button>
            <button type="button" className="btn-cancel" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Certifications</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {instructors.map(i => (
            <tr key={i.id}>
              <td className="cfi-name">{i.name}</td>
              <td>{i.email || '-'}</td>
              <td>{i.phone || '-'}</td>
              <td>{Array.isArray(i.certifications) && i.certifications.length > 0 ? i.certifications.join(', ') : '-'}</td>
              <td>
                <span className={`status-badge ${i.status}`}>
                  {i.status}
                </span>
              </td>
              <td className="actions">
                <button className="btn-edit" onClick={() => handleEdit(i)}>Edit</button>
                <button className="btn-delete" onClick={() => handleDelete(i.id, i.name)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { HelicopterManagement, UserManagement, AdminDashboard, InstructorManagement, BookingListManagement, MaintenanceManagement, AdminScheduleManagement };
