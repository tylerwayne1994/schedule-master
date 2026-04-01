import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { useSchedule } from '../../contexts/ScheduleContext';
import { useAuth } from '../../contexts/AuthContext';
import BookingModal from './BookingModal';
import './Schedule.css';

// Generate 24-hour time slots in half-hour increments (48 slots per day)
const TIME_SLOTS = [];
for (let hour = 0; hour < 24; hour++) {
  TIME_SLOTS.push({ hour, minute: 0, decimal: hour });
  TIME_SLOTS.push({ hour, minute: 30, decimal: hour + 0.5 });
}

// Business hours display (5am to 11pm) - can scroll outside
const BUSINESS_START_HOUR = 5;
const BUSINESS_END_HOUR = 23;

const BASE_SLOT_WIDTH = 80; // pixels per half hour (wider columns)
const DAYS_IN_WEEK = 7;
const SLOTS_PER_DAY = 48;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.75;
const ZOOM_STEP = 0.25;

function ScheduleGrid() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [filter, setFilter] = useState('all');
  const [draggedBooking, setDraggedBooking] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  const gridRef = useRef(null);
  const scrollRef = useRef(null);
  const slotWidth = Math.round(BASE_SLOT_WIDTH * zoomLevel);
  const dayWidth = slotWidth * SLOTS_PER_DAY;

  // Generate array of 7 days
  const weekDays = useMemo(() => {
    return Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to business hours (5am) on load, or current time if within view
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const dayIndex = weekDays.findIndex(d => format(d, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd'));
      
      if (dayIndex >= 0) {
        const dayOffset = dayIndex * dayWidth;
        const currentHour = now.getHours();
        
        // If current time is within business hours, scroll to show it
        if (currentHour >= BUSINESS_START_HOUR && currentHour <= BUSINESS_END_HOUR) {
          const hourOffset = currentHour * slotWidth * 2;
          scrollRef.current.scrollLeft = dayOffset + hourOffset - 200;
        } else {
          // Otherwise scroll to business start (5am)
          const businessStartOffset = BUSINESS_START_HOUR * slotWidth * 2;
          scrollRef.current.scrollLeft = dayOffset + businessStartOffset;
        }
      } else {
        // Not viewing current week, scroll to business hours of first day
        const businessStartOffset = BUSINESS_START_HOUR * slotWidth * 2;
        scrollRef.current.scrollLeft = businessStartOffset;
      }
    }
  }, [weekDays, slotWidth, dayWidth]);

  // Drag-to-scroll handlers
  const handleMouseDown = useCallback((e) => {
    // Don't start drag scroll if clicking on a booking or interactive element
    if (e.target.closest('.booking-block') || e.target.closest('button') || e.target.closest('select')) {
      return;
    }
    
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
    scrollRef.current.style.cursor = 'grabbing';
    scrollRef.current.style.userSelect = 'none';
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      scrollRef.current.style.cursor = 'grab';
      scrollRef.current.style.userSelect = '';
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (scrollRef.current) {
      scrollRef.current.style.cursor = 'grab';
      scrollRef.current.style.userSelect = '';
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    scrollRef.current.scrollLeft = scrollLeft - walk;
  }, [isDragging, startX, scrollLeft]);

  const { helicopters, bookings, updateBooking } = useSchedule();
  const { currentUser, isAdmin } = useAuth();

  // Filter helicopters
  const filteredHelicopters = useMemo(() => {
    if (filter === 'all') return helicopters;
    if (filter === 'available') return helicopters.filter(h => h.status === 'available');
    if (filter === 'maintenance') return helicopters.filter(h => h.status === 'maintenance');
    return helicopters;
  }, [helicopters, filter]);

  const handlePrevWeek = () => setWeekStart(subWeeks(weekStart, 1));
  const handleNextWeek = () => setWeekStart(addWeeks(weekStart, 1));
  const handleThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const handleZoomIn = () => setZoomLevel(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  const handleZoomReset = () => setZoomLevel(1);

  const handleSlotClick = (helicopter, day, slot) => {
    if (helicopter.status === 'maintenance' && !isAdmin()) {
      alert('This helicopter is currently under maintenance');
      return;
    }

    setSelectedSlot({
      helicopterId: helicopter.id,
      helicopter,
      date: format(day, 'yyyy-MM-dd'),
      startTime: slot.decimal,
      endTime: slot.decimal + 0.5
    });
    setSelectedBooking(null);
    setShowBookingModal(true);
  };

  const handleBookingClick = (booking, e) => {
    e.stopPropagation();
    if (!draggedBooking) {
      setSelectedBooking(booking);
      setSelectedSlot(null);
      setShowBookingModal(true);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (booking, e) => {
    if (booking.userId !== currentUser?.id && !isAdmin()) return;
    
    const rect = e.target.getBoundingClientRect();
    const offset = e.clientX - rect.left;
    setDragOffset(offset);
    setDraggedBooking(booking);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', booking.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (helicopter, day, e) => {
    e.preventDefault();
    if (!draggedBooking) return;

    const timeSlotsContainer = e.currentTarget;
    const rect = timeSlotsContainer.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset;
    
    // Calculate new start time based on drop position
    const slotIndex = Math.max(0, Math.floor(x / slotWidth));
    const newStartTime = Math.min(23.5, slotIndex * 0.5);
    const originalStart = new Date(`${draggedBooking.date}T00:00:00`);
    originalStart.setHours(Math.floor(draggedBooking.startTime), draggedBooking.startTime % 1 === 0.5 ? 30 : 0, 0, 0);
    const originalEnd = new Date(`${draggedBooking.endDate || draggedBooking.date}T00:00:00`);
    originalEnd.setHours(Math.floor(draggedBooking.endTime), draggedBooking.endTime % 1 === 0.5 ? 30 : 0, 0, 0);
    const durationMs = originalEnd.getTime() - originalStart.getTime();

    const newStartDate = new Date(`${format(day, 'yyyy-MM-dd')}T00:00:00`);
    newStartDate.setHours(Math.floor(newStartTime), newStartTime % 1 === 0.5 ? 30 : 0, 0, 0);
    const newEndDate = new Date(newStartDate.getTime() + durationMs);
    let resolvedEndDate = newEndDate;
    let newEndTime = newEndDate.getHours() + (newEndDate.getMinutes() >= 30 ? 0.5 : 0);

    // The database represents midnight as 24:00 on the previous day, not 0:00 on the next day.
    if (newEndDate.getHours() === 0 && newEndDate.getMinutes() === 0) {
      resolvedEndDate = new Date(newEndDate.getTime() - (24 * 60 * 60 * 1000));
      newEndTime = 24;
    }

    // Update the booking
    const result = await updateBooking(draggedBooking.id, {
      helicopterId: helicopter.id,
      date: format(day, 'yyyy-MM-dd'),
      endDate: format(resolvedEndDate, 'yyyy-MM-dd'),
      startTime: newStartTime,
      endTime: newEndTime
    });

    if (!result?.success) {
      alert(result?.error || 'Unable to move booking');
    }

    setDraggedBooking(null);
    setDragOffset(0);
  };

  const handleDragEnd = () => {
    setDraggedBooking(null);
    setDragOffset(0);
  };

  const getBookingStyle = (booking) => {
    const startSlots = booking.startTime * 2;
    const duration = (booking.endTime - booking.startTime) * 2;
    
    return {
      left: `${startSlots * slotWidth}px`,
      width: `${Math.max(duration * slotWidth - 4, slotWidth - 4)}px`
    };
  };

  const getBookingColor = (booking) => {
    if (booking.type === 'maintenance') return '#dc2626';
    if (booking.userId === currentUser?.id) return '#16a34a';
    return '#2563eb';
  };

  const formatTimeSlot = (slot) => {
    const hour = slot.hour;
    if (hour === 0) return '12a';
    if (hour === 12) return '12p';
    if (hour < 12) return `${hour}a`;
    return `${hour - 12}p`;
  };

  // Calculate current time position
  const getCurrentTimeInfo = () => {
    const now = currentTime;
    const todayStr = format(now, 'yyyy-MM-dd');
    const dayIndex = weekDays.findIndex(d => format(d, 'yyyy-MM-dd') === todayStr);
    if (dayIndex < 0) return null;
    
    const timePosition = (now.getHours() + now.getMinutes() / 60) * 2 * slotWidth;
    const dayOffset = dayIndex * dayWidth;
    return { position: dayOffset + timePosition, dayIndex };
  };

  const currentTimeInfo = getCurrentTimeInfo();

  return (
    <div className="schedule-container">
      {/* Header Controls */}
      <div className="schedule-header">
        <div className="schedule-nav">
          <button className="new-booking-btn" onClick={() => {
            setSelectedSlot(null);
            setSelectedBooking(null);
            setShowBookingModal(true);
          }}>
            + New Booking
          </button>
          <div className="zoom-controls">
            <span className="zoom-label">Zoom</span>
            <div className="zoom-segmented" role="group" aria-label="Schedule zoom controls">
              <button type="button" className="zoom-button" onClick={handleZoomOut} disabled={zoomLevel <= MIN_ZOOM}>
                -
              </button>
              <button type="button" className="zoom-readout" onClick={handleZoomReset}>
                {Math.round(zoomLevel * 100)}%
              </button>
              <button type="button" className="zoom-button" onClick={handleZoomIn} disabled={zoomLevel >= MAX_ZOOM}>
                +
              </button>
            </div>
          </div>
        </div>

        <div className="date-nav">
          <button onClick={handlePrevWeek}>&lt;&lt;</button>
          <button onClick={handleThisWeek}>This Week</button>
          <span className="current-date">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button onClick={handleNextWeek}>&gt;&gt;</button>
        </div>

        <div className="filters">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Helicopters</option>
            <option value="available">Available Only</option>
            <option value="maintenance">Under Maintenance</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="schedule-toolbar">
        <div className="legend">
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#16a34a' }}></span>
            My Bookings
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#2563eb' }}></span>
            Other Bookings
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#dc2626' }}></span>
            Maintenance
          </div>
        </div>
        <div className="drag-hint">Click and drag to scroll. Shows 5am-11pm by default. Drag bookings to reschedule.</div>
      </div>

      {/* Schedule Grid */}
      <div className="schedule-grid-wrapper" ref={gridRef}>
        <div 
          className={`schedule-grid-scroll ${isDragging ? 'is-dragging' : ''}`}
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <div
            className="schedule-grid"
            style={{
              width: dayWidth * DAYS_IN_WEEK + 160,
              '--slot-width': `${slotWidth}px`
            }}
          >
            {/* Day headers row */}
            <div className="grid-header">
              <div className="resource-header">Helicopters</div>
              <div className="days-header">
                {weekDays.map((day, dayIndex) => (
                  <div 
                    key={dayIndex} 
                    className={`day-header ${format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'today' : ''}`}
                    style={{ width: dayWidth }}
                  >
                    <div className="day-name">{format(day, 'EEE')}</div>
                    <div className="day-date">{format(day, 'MMM d')}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time header row */}
            <div className="grid-header time-row">
              <div className="resource-header"></div>
              <div className="time-header">
                {weekDays.map((day, dayIndex) => (
                  <div key={dayIndex} className="day-times" style={{ width: dayWidth }}>
                    {TIME_SLOTS.filter(s => s.minute === 0).map((slot, i) => (
                      <div 
                        key={i} 
                        className="time-slot-header"
                        style={{ width: slotWidth * 2 }}
                      >
                        {formatTimeSlot(slot)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Current time indicator */}
            {currentTimeInfo && (
              <div 
                className="current-time-line" 
                style={{ left: currentTimeInfo.position + 160 }} 
              />
            )}

            {/* Helicopter rows */}
            {filteredHelicopters.map(helicopter => (
              <div key={helicopter.id} className="resource-row">
                <div className={`resource-info ${helicopter.status === 'maintenance' ? 'maintenance' : ''}`}>
                  <span className="resource-tail">{helicopter.tailNumber}</span>
                  <span className="resource-model">{helicopter.model}</span>
                  <span className="resource-rate">${helicopter.hourlyRate}/hr</span>
                </div>
                <div className="week-slots">
                  {weekDays.map((day, dayIndex) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    // Include multi-day bookings that span this date
                    const dayBookings = bookings.filter(b => {
                      if (b.helicopterId !== helicopter.id || b.status === 'cancelled') return false;
                      const endDate = b.endDate || b.date;
                      return dateStr >= b.date && dateStr <= endDate;
                    });

                    return (
                      <div 
                        key={dayIndex}
                        className={`day-slots ${format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'today' : ''}`}
                        style={{ width: dayWidth }}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(helicopter, day, e)}
                      >
                        {TIME_SLOTS.map((slot, i) => (
                          <div 
                            key={i} 
                            className={`time-slot ${helicopter.status === 'maintenance' ? 'maintenance' : ''} ${slot.minute === 0 ? 'hour-mark' : ''}`}
                            style={{ width: slotWidth, minWidth: slotWidth }}
                            onClick={() => handleSlotClick(helicopter, day, slot)}
                          />
                        ))}
                        {/* Bookings overlay */}
                        {dayBookings.map(booking => {
                          const canDrag = booking.userId === currentUser?.id || isAdmin();
                          // Determine if this day is start, middle, or end of multi-day booking
                          const isStartDay = dateStr === booking.date;
                          const isEndDay = dateStr === (booking.endDate || booking.date);
                          const dayStartTime = isStartDay ? booking.startTime : 0;
                          const dayEndTime = isEndDay ? booking.endTime : 24;
                          
                          return (
                            <div
                              key={booking.id}
                              className={`booking-block ${canDrag ? 'draggable' : ''} ${draggedBooking?.id === booking.id ? 'dragging' : ''} ${!isStartDay ? 'multi-day-continue' : ''}`}
                              style={{
                                ...getBookingStyle({ ...booking, startTime: dayStartTime, endTime: dayEndTime }),
                                background: getBookingColor(booking)
                              }}
                              draggable={canDrag && isStartDay}
                              onDragStart={(e) => handleDragStart(booking, e)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => handleBookingClick(booking, e)}
                            >
                              <span className="booking-name">
                                {isStartDay ? booking.customerName : `... ${booking.customerName}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModal
          booking={selectedBooking}
          slot={selectedSlot}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedBooking(null);
            setSelectedSlot(null);
          }}
        />
      )}
    </div>
  );
}

export default ScheduleGrid;
