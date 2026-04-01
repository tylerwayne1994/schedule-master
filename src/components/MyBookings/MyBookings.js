import React from 'react';
import { format } from 'date-fns';
import { useSchedule } from '../../contexts/ScheduleContext';
import { useAuth } from '../../contexts/AuthContext';
import './MyBookings.css';

function MyBookings({ onOpenFlightReview }) {
  const { bookings, helicopters, instructors, cancelBooking } = useSchedule();
  const { currentUser } = useAuth();

  const myBookings = bookings
    .filter(b => b.userId === currentUser?.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const getHelicopter = (id) => helicopters.find(h => h.id === id);
  const getInstructor = (id) => instructors.find(i => i.id === id);

  const formatTime = (hour) => {
    if (hour === 12) return '12:00 PM';
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  };

  const handleCancel = async (id) => {
    if (window.confirm('Cancel this booking?')) {
      await cancelBooking(id);
    }
  };

  const today = new Date(format(new Date(), 'yyyy-MM-dd'));
  const upcomingBookings = myBookings.filter(b => 
    b.status === 'confirmed' && new Date(b.date) >= today
  );
  const pastBookings = myBookings.filter(b => 
    b.status === 'completed' || (b.status === 'confirmed' && new Date(b.date) < today)
  );
  const cancelledBookings = myBookings.filter(b => b.status === 'cancelled');

  // Find bookings that need flight hours submitted
  const now = new Date();
  const pendingFlightReviews = myBookings.filter(b => {
    if (b.status === 'cancelled') return false;
    if (b.actualHours != null) return false; // Already submitted
    if (b.actualHoursStatus && b.actualHoursStatus !== 'not_submitted') return false;
    
    // Check if flight has ended
    const endDateStr = b.endDate || b.date;
    const end = new Date(`${endDateStr}T00:00:00`);
    const hours = typeof b.endTime === 'number' ? b.endTime : parseFloat(b.endTime);
    const hourInt = Math.floor(hours);
    const minutes = hours % 1 === 0.5 ? 30 : 0;
    end.setHours(hourInt, minutes, 0, 0);
    
    return end <= now;
  });

  return (
    <div className="my-bookings">
      <h2>My Bookings</h2>

      {/* Pending Flight Reviews Section */}
      {pendingFlightReviews.length > 0 && (
        <div className="bookings-section pending-reviews">
          <h3>Pending Flight Reviews ({pendingFlightReviews.length})</h3>
          <p className="section-hint">Please enter your actual flight hours for these completed flights</p>
          <div className="booking-cards">
            {pendingFlightReviews.map(booking => {
              const heli = getHelicopter(booking.helicopterId);
              const instructor = getInstructor(booking.instructorId);
              return (
                <div key={booking.id} className="booking-card needs-review">
                  <div className="booking-date">
                    {format(new Date(booking.date), 'EEE, MMM d, yyyy')}
                  </div>
                  <div className="booking-time">
                    {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                  </div>
                  <div className="booking-heli">
                    {heli?.tailNumber} - {heli?.model}
                  </div>
                  {instructor && (
                    <div className="booking-instructor">Instructor: {instructor.name}</div>
                  )}
                  <div className="booking-type">{booking.type}</div>
                  <button 
                    className="btn-enter-hours" 
                    onClick={() => onOpenFlightReview && onOpenFlightReview(booking.id)}
                  >
                    Enter Flight Hours
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bookings-section">
        <h3>Upcoming ({upcomingBookings.length})</h3>
        {upcomingBookings.length === 0 ? (
          <p className="no-bookings">No upcoming bookings</p>
        ) : (
          <div className="booking-cards">
            {upcomingBookings.map(booking => {
              const heli = getHelicopter(booking.helicopterId);
              const instructor = getInstructor(booking.instructorId);
              // Intentionally do not compute/track booking cost

              return (
                <div key={booking.id} className="booking-card upcoming">
                  <div className="booking-date">
                    {format(new Date(booking.date), 'EEE, MMM d, yyyy')}
                  </div>
                  <div className="booking-time">
                    {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                  </div>
                  <div className="booking-heli">
                    {heli?.tailNumber} - {heli?.model}
                  </div>
                  {instructor && (
                    <div className="booking-instructor">Instructor: {instructor.name}</div>
                  )}
                  <div className="booking-type">{booking.type}</div>
                  <button className="btn-cancel-booking" onClick={() => handleCancel(booking.id)}>
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bookings-section">
        <h3>Past ({pastBookings.length})</h3>
        {pastBookings.length === 0 ? (
          <p className="no-bookings">No past bookings</p>
        ) : (
          <div className="booking-cards">
            {pastBookings.map(booking => {
              const heli = getHelicopter(booking.helicopterId);
              return (
                <div key={booking.id} className="booking-card past">
                  <div className="booking-date">
                    {format(new Date(booking.date), 'EEE, MMM d, yyyy')}
                  </div>
                  <div className="booking-time">
                    {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                  </div>
                  <div className="booking-heli">
                    {heli?.tailNumber} - {heli?.model}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cancelledBookings.length > 0 && (
        <div className="bookings-section">
          <h3>Cancelled ({cancelledBookings.length})</h3>
          <div className="booking-cards">
            {cancelledBookings.map(booking => {
              const heli = getHelicopter(booking.helicopterId);
              return (
                <div key={booking.id} className="booking-card cancelled">
                  <div className="booking-date">
                    {format(new Date(booking.date), 'EEE, MMM d, yyyy')}
                  </div>
                  <div className="booking-heli">
                    {heli?.tailNumber} - {heli?.model}
                  </div>
                  <span className="cancelled-badge">Cancelled</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MyBookings;
