import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const ScheduleContext = createContext();

// Default helicopters
const DEFAULT_HELICOPTERS = [
  { id: 'heli-001', tailNumber: 'N44NL', model: 'R44 Raven II', hourlyRate: 350, status: 'available', hobbsTime: 1245.3 },
  { id: 'heli-002', tailNumber: 'N22NL', model: 'R22 Beta II', hourlyRate: 250, status: 'available', hobbsTime: 2340.8 },
  { id: 'heli-003', tailNumber: 'N66NL', model: 'R66 Turbine', hourlyRate: 550, status: 'available', hobbsTime: 856.2 },
  { id: 'heli-004', tailNumber: 'N300NL', model: 'EC130 B4', hourlyRate: 850, status: 'available', hobbsTime: 1523.5 },
  { id: 'heli-005', tailNumber: 'N407NL', model: 'Bell 407', hourlyRate: 950, status: 'maintenance', hobbsTime: 3102.1 },
];

const DEFAULT_INSTRUCTORS = [
  { id: 'inst-001', name: 'John Smith', certifications: ['CFI', 'CFII'], status: 'active' },
  { id: 'inst-002', name: 'Sarah Johnson', certifications: ['CFI', 'CFII', 'MEI'], status: 'active' },
  { id: 'inst-003', name: 'Mike Davis', certifications: ['CFI'], status: 'active' },
];

export function ScheduleProvider({ children }) {
  const [helicopters, setHelicopters] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const storedHelicopters = localStorage.getItem('nlh_helicopters');
    const storedInstructors = localStorage.getItem('nlh_instructors');
    const storedBookings = localStorage.getItem('nlh_bookings');

    if (storedHelicopters) {
      setHelicopters(JSON.parse(storedHelicopters));
    } else {
      setHelicopters(DEFAULT_HELICOPTERS);
      localStorage.setItem('nlh_helicopters', JSON.stringify(DEFAULT_HELICOPTERS));
    }

    if (storedInstructors) {
      setInstructors(JSON.parse(storedInstructors));
    } else {
      setInstructors(DEFAULT_INSTRUCTORS);
      localStorage.setItem('nlh_instructors', JSON.stringify(DEFAULT_INSTRUCTORS));
    }

    if (storedBookings) {
      setBookings(JSON.parse(storedBookings));
    }

    setLoading(false);
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('nlh_helicopters', JSON.stringify(helicopters));
    }
  }, [helicopters, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem('nlh_instructors', JSON.stringify(instructors));
    }
  }, [instructors, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem('nlh_bookings', JSON.stringify(bookings));
    }
  }, [bookings, loading]);

  // Helicopter CRUD
  const addHelicopter = (helicopter) => {
    const newHelicopter = {
      id: uuidv4(),
      ...helicopter,
      createdAt: new Date().toISOString()
    };
    setHelicopters(prev => [...prev, newHelicopter]);
    return newHelicopter;
  };

  const updateHelicopter = (id, updates) => {
    setHelicopters(prev => prev.map(h => 
      h.id === id ? { ...h, ...updates } : h
    ));
  };

  const deleteHelicopter = (id) => {
    setHelicopters(prev => prev.filter(h => h.id !== id));
  };

  // Instructor CRUD
  const addInstructor = (instructor) => {
    const newInstructor = {
      id: uuidv4(),
      ...instructor,
      createdAt: new Date().toISOString()
    };
    setInstructors(prev => [...prev, newInstructor]);
    return newInstructor;
  };

  const updateInstructor = (id, updates) => {
    setInstructors(prev => prev.map(i => 
      i.id === id ? { ...i, ...updates } : i
    ));
  };

  const deleteInstructor = (id) => {
    setInstructors(prev => prev.filter(i => i.id !== id));
  };

  const hasBookingConflict = (candidateBooking, bookingIdToIgnore = null) => {
    const bookingStart = new Date(candidateBooking.date);
    const bookingEnd = new Date(candidateBooking.endDate || candidateBooking.date);

    return bookings.some(existingBooking => {
      if (existingBooking.id === bookingIdToIgnore) return false;
      if (existingBooking.helicopterId !== candidateBooking.helicopterId || existingBooking.status === 'cancelled') {
        return false;
      }

      const existingStart = new Date(existingBooking.date);
      const existingEnd = new Date(existingBooking.endDate || existingBooking.date);
      const datesOverlap = bookingStart <= existingEnd && bookingEnd >= existingStart;

      if (!datesOverlap) return false;

      if (
        candidateBooking.date === existingBooking.date &&
        (candidateBooking.endDate || candidateBooking.date) === (existingBooking.endDate || existingBooking.date) &&
        candidateBooking.date === (candidateBooking.endDate || candidateBooking.date)
      ) {
        return (
          (candidateBooking.startTime >= existingBooking.startTime && candidateBooking.startTime < existingBooking.endTime) ||
          (candidateBooking.endTime > existingBooking.startTime && candidateBooking.endTime <= existingBooking.endTime) ||
          (candidateBooking.startTime <= existingBooking.startTime && candidateBooking.endTime >= existingBooking.endTime)
        );
      }

      return true;
    });
  };

  // Booking CRUD
  const createBooking = (booking) => {
    if (hasBookingConflict(booking)) {
      return { success: false, error: 'Time slot already booked' };
    }

    const newBooking = {
      id: uuidv4(),
      ...booking,
      endDate: booking.endDate || booking.date, // Ensure endDate is set
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };
    setBookings(prev => [...prev, newBooking]);
    return { success: true, booking: newBooking };
  };

  const updateBooking = (id, updates) => {
    const existingBooking = bookings.find(booking => booking.id === id);
    if (!existingBooking) {
      return { success: false, error: 'Booking not found' };
    }

    const mergedBooking = {
      ...existingBooking,
      ...updates,
      endDate: updates.endDate || existingBooking.endDate || existingBooking.date
    };

    if (hasBookingConflict(mergedBooking, id)) {
      return { success: false, error: 'Time slot already booked' };
    }

    setBookings(prev => prev.map(b => 
      b.id === id ? { ...b, ...updates } : b
    ));

    return { success: true };
  };

  const cancelBooking = (id) => {
    setBookings(prev => prev.map(b => 
      b.id === id ? { ...b, status: 'cancelled' } : b
    ));
  };

  const deleteBooking = (id) => {
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  const getBookingsForDate = (date) => {
    // Include multi-day bookings that span this date (use string comparison)
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      const endDate = b.endDate || b.date;
      return date >= b.date && date <= endDate;
    });
  };

  const getBookingsForHelicopter = (helicopterId, date) => {
    // Include multi-day bookings that span this date (use string comparison)
    return bookings.filter(b => {
      if (b.helicopterId !== helicopterId || b.status === 'cancelled') return false;
      const endDate = b.endDate || b.date;
      return date >= b.date && date <= endDate;
    });
  };

  const getUserBookings = (userId) => {
    return bookings.filter(b => b.userId === userId);
  };

  const value = {
    helicopters,
    instructors,
    bookings,
    addHelicopter,
    updateHelicopter,
    deleteHelicopter,
    addInstructor,
    updateInstructor,
    deleteInstructor,
    createBooking,
    updateBooking,
    cancelBooking,
    deleteBooking,
    getBookingsForDate,
    getBookingsForHelicopter,
    getUserBookings,
    loading
  };

  return (
    <ScheduleContext.Provider value={value}>
      {!loading && children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}
