import React from 'react';
import { format } from 'date-fns';
import { useSchedule } from '../../contexts/ScheduleContext';
import { useAuth } from '../../contexts/AuthContext';
import './MyBookings.css';

function MyBookings() {
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

  const handleCancel = (id) => {
    if (window.confirm('Cancel this booking?')) {
      cancelBooking(id);
    }
  };

  const upcomingBookings = myBookings.filter(b => 
    b.status === 'confirmed' && new Date(b.date) >= new Date(format(new Date(), 'yyyy-MM-dd'))
  );
  const pastBookings = myBookings.filter(b => 
    b.status === 'confirmed' && new Date(b.date) < new Date(format(new Date(), 'yyyy-MM-dd'))
  );
  const cancelledBookings = myBookings.filter(b => b.status === 'cancelled');

  return (
    <div className="my-bookings">
      <h2>My Bookings</h2>

      <div className="bookings-section">
        <h3>Upcoming ({upcomingBookings.length})</h3>
        {upcomingBookings.length === 0 ? (
          <p className="no-bookings">No upcoming bookings</p>
        ) : (
          <div className="booking-cards">
            {upcomingBookings.map(booking => {
              const heli = getHelicopter(booking.helicopterId);
              const instructor = getInstructor(booking.instructorId);
              const duration = booking.endTime - booking.startTime;
              const cost = heli ? heli.hourlyRate * duration : 0;

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
                  <div className="booking-cost">${cost}</div>
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
