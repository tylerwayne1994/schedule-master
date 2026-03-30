import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

  const mapBookingFromDb = (b) => ({
    id: b.id,
    helicopterId: b.helicopter_id,
    userId: b.user_id,
    date: b.date,
    endDate: b.end_date || b.date,
    startTime: typeof b.start_time === 'number' ? b.start_time : parseFloat(b.start_time),
    endTime: typeof b.end_time === 'number' ? b.end_time : parseFloat(b.end_time),
    instructorId: b.instructor_id || '',
    customerName: b.customer_name || '',
    customerPhone: b.customer_phone || '',
    customerEmail: b.customer_email || '',
    type: b.type || 'flight',
    notes: b.notes || '',
    status: b.status || 'confirmed',
    actualHours: b.actual_hours != null ? (typeof b.actual_hours === 'number' ? b.actual_hours : parseFloat(b.actual_hours)) : null,
    actualHoursSubmittedAt: b.actual_hours_submitted_at || null,
    createdAt: b.created_at
  });

  const mapBookingToDb = (booking) => ({
    helicopter_id: booking.helicopterId,
    user_id: booking.userId,
    date: booking.date,
    end_date: booking.endDate || booking.date,
    start_time: booking.startTime,
    end_time: booking.endTime,
    instructor_id: booking.instructorId || null,
    customer_name: booking.customerName || null,
    customer_phone: booking.customerPhone || null,
    customer_email: booking.customerEmail || null,
    type: booking.type || 'flight',
    notes: booking.notes || null,
    status: booking.status || 'confirmed',
    actual_hours: booking.actualHours ?? null,
    actual_hours_submitted_at: booking.actualHoursSubmittedAt ?? null
  });

  // Load helicopters from Supabase
  const loadHelicopters = async () => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('helicopters')
        .select('*')
        .order('tail_number');
      
      if (data && !error) {
        // Map snake_case to camelCase
        const mapped = data.map(h => ({
          id: h.id,
          tailNumber: h.tail_number,
          model: h.model,
          hourlyRate: parseFloat(h.hourly_rate),
          status: h.status,
          hobbsTime: parseFloat(h.hobbs_time) || 0,
          inspection50Hour: h.inspection_50_hour ? parseFloat(h.inspection_50_hour) : null,
          inspection100Hour: h.inspection_100_hour ? parseFloat(h.inspection_100_hour) : null,
          createdAt: h.created_at
        }));
        setHelicopters(mapped);
        return;
      }

      console.error('Failed to load helicopters from Supabase:', error);
      setHelicopters([]);
      return;
    }
    // Demo-mode fallback to localStorage
    const storedHelicopters = localStorage.getItem('nlh_helicopters');
    if (storedHelicopters) {
      setHelicopters(JSON.parse(storedHelicopters));
    } else {
      setHelicopters(DEFAULT_HELICOPTERS);
    }
  };

  const loadInstructors = async () => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('instructors')
        .select('*')
        .order('name');

      if (data && !error) {
        const mapped = data.map(i => ({
          id: i.id,
          name: i.name,
          certifications: Array.isArray(i.certifications) ? i.certifications : [],
          status: i.status || 'active',
          createdAt: i.created_at
        }));
        setInstructors(mapped);
        return;
      }

      console.error('Failed to load instructors from Supabase:', error);
      setInstructors([]);
      return;
    }

    const storedInstructors = localStorage.getItem('nlh_instructors');
    if (storedInstructors) {
      setInstructors(JSON.parse(storedInstructors));
    } else {
      setInstructors(DEFAULT_INSTRUCTORS);
      localStorage.setItem('nlh_instructors', JSON.stringify(DEFAULT_INSTRUCTORS));
    }
  };

  const loadBookings = async () => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('date', { ascending: false });

      if (data && !error) {
        setBookings(data.map(mapBookingFromDb));
        return;
      }

      console.error('Failed to load bookings from Supabase:', error);
      setBookings([]);
      return;
    }

    const storedBookings = localStorage.getItem('nlh_bookings');
    if (storedBookings) {
      setBookings(JSON.parse(storedBookings));
    }
  };

  // Initialize data
  useEffect(() => {
    const initData = async () => {
      await loadHelicopters();

      await loadInstructors();

      await loadBookings();

      setLoading(false);
    };
    
    initData();
  }, []);

  // Save helicopters to localStorage as backup (Supabase is primary)
  useEffect(() => {
    if (!isSupabaseConfigured() && !loading && helicopters.length > 0) {
      localStorage.setItem('nlh_helicopters', JSON.stringify(helicopters));
    }
  }, [helicopters, loading]);

  useEffect(() => {
    if (!isSupabaseConfigured() && !loading) {
      localStorage.setItem('nlh_instructors', JSON.stringify(instructors));
    }
  }, [instructors, loading]);

  useEffect(() => {
    if (!isSupabaseConfigured() && !loading) {
      localStorage.setItem('nlh_bookings', JSON.stringify(bookings));
    }
  }, [bookings, loading]);

  // Helicopter CRUD
  const addHelicopter = async (helicopter) => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('helicopters')
        .insert({
          tail_number: helicopter.tailNumber,
          model: helicopter.model,
          hourly_rate: helicopter.hourlyRate,
          status: helicopter.status || 'available',
          hobbs_time: helicopter.hobbsTime || 0,
          inspection_50_hour: helicopter.inspection50Hour || null,
          inspection_100_hour: helicopter.inspection100Hour || null
        })
        .select()
        .single();
      
      if (data && !error) {
        const newHelicopter = {
          id: data.id,
          tailNumber: data.tail_number,
          model: data.model,
          hourlyRate: parseFloat(data.hourly_rate),
          status: data.status,
          hobbsTime: parseFloat(data.hobbs_time) || 0,
          inspection50Hour: data.inspection_50_hour ? parseFloat(data.inspection_50_hour) : null,
          inspection100Hour: data.inspection_100_hour ? parseFloat(data.inspection_100_hour) : null,
          createdAt: data.created_at
        };
        setHelicopters(prev => [...prev, newHelicopter]);
        return newHelicopter;
      }
      console.error('Failed to add helicopter:', error);
      return null;
    }
    
    // Fallback to localStorage
    const newHelicopter = {
      id: uuidv4(),
      ...helicopter,
      createdAt: new Date().toISOString()
    };
    setHelicopters(prev => [...prev, newHelicopter]);
    return newHelicopter;
  };

  const updateHelicopter = async (id, updates) => {
    if (isSupabaseConfigured()) {
      const dbUpdates = {};
      if (updates.tailNumber !== undefined) dbUpdates.tail_number = updates.tailNumber;
      if (updates.model !== undefined) dbUpdates.model = updates.model;
      if (updates.hourlyRate !== undefined) dbUpdates.hourly_rate = updates.hourlyRate;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.hobbsTime !== undefined) dbUpdates.hobbs_time = updates.hobbsTime;
      if (updates.inspection50Hour !== undefined) dbUpdates.inspection_50_hour = updates.inspection50Hour;
      if (updates.inspection100Hour !== undefined) dbUpdates.inspection_100_hour = updates.inspection100Hour;
      
      const { error } = await supabase
        .from('helicopters')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) {
        console.error('Failed to update helicopter:', error);
        return { success: false, error: error.message };
      }
    }
    
    setHelicopters(prev => prev.map(h => 
      h.id === id ? { ...h, ...updates } : h
    ));
    return { success: true };
  };

  const deleteHelicopter = async (id) => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('helicopters')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Failed to delete helicopter:', error);
        return { success: false, error: error.message };
      }
    }
    
    setHelicopters(prev => prev.filter(h => h.id !== id));
    return { success: true };
  };

  // Instructor CRUD
  const addInstructor = async (instructor) => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('instructors')
        .insert({
          name: instructor.name,
          certifications: Array.isArray(instructor.certifications) ? instructor.certifications : [],
          status: instructor.status || 'active'
        })
        .select()
        .single();

      if (data && !error) {
        const newInstructor = {
          id: data.id,
          name: data.name,
          certifications: Array.isArray(data.certifications) ? data.certifications : [],
          status: data.status || 'active',
          createdAt: data.created_at
        };
        setInstructors(prev => [...prev, newInstructor]);
        return newInstructor;
      }

      console.error('Failed to add instructor:', error);
      return null;
    }

    const newInstructor = {
      id: uuidv4(),
      ...instructor,
      createdAt: new Date().toISOString()
    };
    setInstructors(prev => [...prev, newInstructor]);
    return newInstructor;
  };

  const updateInstructor = async (id, updates) => {
    if (isSupabaseConfigured()) {
      const dbUpdates = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.certifications !== undefined) dbUpdates.certifications = updates.certifications;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { error } = await supabase
        .from('instructors')
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
        console.error('Failed to update instructor:', error);
        return { success: false, error: error.message };
      }
    }

    setInstructors(prev => prev.map(i => 
      i.id === id ? { ...i, ...updates } : i
    ));
    return { success: true };
  };

  const deleteInstructor = async (id) => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('instructors')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete instructor:', error);
        return { success: false, error: error.message };
      }
    }

    setInstructors(prev => prev.filter(i => i.id !== id));
    return { success: true };
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
  const createBooking = async (booking) => {
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

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('bookings')
        .insert(mapBookingToDb(newBooking))
        .select()
        .single();

      if (data && !error) {
        const saved = mapBookingFromDb(data);
        setBookings(prev => [saved, ...prev]);
        return { success: true, booking: saved };
      }

      console.error('Failed to create booking:', error);
      return { success: false, error: error?.message || 'Unable to create booking' };
    }

    setBookings(prev => [...prev, newBooking]);
    return { success: true, booking: newBooking };
  };

  const updateBooking = async (id, updates) => {
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

    if (isSupabaseConfigured()) {
      const dbUpdates = mapBookingToDb({ ...existingBooking, ...updates, id });
      const { error } = await supabase
        .from('bookings')
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
        console.error('Failed to update booking:', error);
        return { success: false, error: error?.message || 'Unable to update booking' };
      }
    }

    setBookings(prev => prev.map(b => 
      b.id === id ? { ...b, ...updates } : b
    ));

    return { success: true };
  };

  const cancelBooking = async (id) => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) {
        console.error('Failed to cancel booking:', error);
        return { success: false, error: error?.message || 'Unable to cancel booking' };
      }
    }

    setBookings(prev => prev.map(b => 
      b.id === id ? { ...b, status: 'cancelled' } : b
    ));
    return { success: true };
  };

  const deleteBooking = async (id) => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete booking:', error);
        return { success: false, error: error?.message || 'Unable to delete booking' };
      }
    }

    setBookings(prev => prev.filter(b => b.id !== id));
    return { success: true };
  };

  const completeFlightHours = async (bookingId, actualHours) => {
    const hours = parseFloat(actualHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return { success: false, error: 'Enter a valid flight time' };
    }

    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase.rpc('complete_flight', {
        p_booking_id: bookingId,
        p_actual_hours: hours
      });

      if (error) {
        console.error('Failed to complete flight:', error);
        return { success: false, error: error?.message || 'Unable to complete flight' };
      }
    }

    setBookings(prev => prev.map(b => (
      b.id === bookingId
        ? { ...b, actualHours: hours, actualHoursSubmittedAt: new Date().toISOString(), status: 'completed' }
        : b
    )));

    setHelicopters(prev => prev.map(h => (
      h.id === booking.helicopterId
        ? { ...h, hobbsTime: (parseFloat(h.hobbsTime) || 0) + hours }
        : h
    )));

    return { success: true };
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
    completeFlightHours,
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
