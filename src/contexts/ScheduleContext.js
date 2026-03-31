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

const normalizeBookingType = (value) => {
  switch (value) {
    case 'flight':
      return 'training';
    case 'charter':
      return 'tour';
    default:
      return value || 'training';
  }
};

const formatSupabaseError = (error, fallbackMessage) => {
  if (!error) {
    return fallbackMessage;
  }

  const parts = [error.message, error.details, error.hint].filter(Boolean);
  if (error.code) {
    parts.push(`code: ${error.code}`);
  }

  return parts.length > 0 ? parts.join(' | ') : fallbackMessage;
};

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
    type: normalizeBookingType(b.flight_type || b.type),
    notes: b.notes || '',
    status: b.status || 'confirmed',
    actualHours: b.actual_hours != null ? (typeof b.actual_hours === 'number' ? b.actual_hours : parseFloat(b.actual_hours)) : null,
    actualHoursSubmittedAt: b.actual_hours_submitted_at || null,
    actualHoursStatus: b.actual_hours_status || 'not_submitted',
    actualHoursApprovedAt: b.actual_hours_approved_at || null,
    actualHoursApprovedBy: b.actual_hours_approved_by || null,
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
    flight_type: normalizeBookingType(booking.type),
    notes: booking.notes || null,
    status: booking.status || 'confirmed',
    actual_hours: booking.actualHours ?? null,
    actual_hours_submitted_at: booking.actualHoursSubmittedAt ?? null,
    actual_hours_status: booking.actualHoursStatus ?? 'not_submitted',
    actual_hours_approved_at: booking.actualHoursApprovedAt ?? null,
    actual_hours_approved_by: booking.actualHoursApprovedBy ?? null
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
      const payload = mapBookingToDb(newBooking);
      const { data, error } = await supabase.rpc('create_booking_record', {
        p_user_id: payload.user_id,
        p_helicopter_id: payload.helicopter_id,
        p_date: payload.date,
        p_end_date: payload.end_date,
        p_start_time: payload.start_time,
        p_end_time: payload.end_time,
        p_instructor_id: payload.instructor_id,
        p_customer_name: payload.customer_name,
        p_customer_phone: payload.customer_phone,
        p_customer_email: payload.customer_email,
        p_flight_type: payload.flight_type,
        p_notes: payload.notes,
        p_status: payload.status
      });

      if (data && !error) {
        const saved = mapBookingFromDb(data);
        setBookings(prev => [saved, ...prev]);
        return { success: true, booking: saved };
      }

      const directInsertPayload = {
        user_id: payload.user_id,
        helicopter_id: payload.helicopter_id,
        date: payload.date,
        end_date: payload.end_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        instructor_id: payload.instructor_id,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        customer_email: payload.customer_email,
        flight_type: payload.flight_type,
        notes: payload.notes,
        status: payload.status
      };

      const { data: directData, error: directError } = await supabase
        .from('bookings')
        .insert(directInsertPayload)
        .select()
        .single();

      if (directData && !directError) {
        const saved = mapBookingFromDb(directData);
        setBookings(prev => [saved, ...prev]);
        return { success: true, booking: saved };
      }

      console.error('Failed to create booking via RPC:', error);
      console.error('Failed to create booking via direct insert:', directError);
      return {
        success: false,
        error: formatSupabaseError(directError || error, 'Unable to create booking')
      };
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
      const { data, error } = await supabase.rpc('update_booking_record', {
        p_booking_id: id,
        p_user_id: dbUpdates.user_id,
        p_helicopter_id: dbUpdates.helicopter_id,
        p_date: dbUpdates.date,
        p_end_date: dbUpdates.end_date,
        p_start_time: dbUpdates.start_time,
        p_end_time: dbUpdates.end_time,
        p_instructor_id: dbUpdates.instructor_id,
        p_customer_name: dbUpdates.customer_name,
        p_customer_phone: dbUpdates.customer_phone,
        p_customer_email: dbUpdates.customer_email,
        p_flight_type: dbUpdates.flight_type,
        p_notes: dbUpdates.notes,
        p_status: dbUpdates.status,
        p_actual_hours: dbUpdates.actual_hours,
        p_actual_hours_submitted_at: dbUpdates.actual_hours_submitted_at,
        p_actual_hours_status: dbUpdates.actual_hours_status,
        p_actual_hours_approved_at: dbUpdates.actual_hours_approved_at,
        p_actual_hours_approved_by: dbUpdates.actual_hours_approved_by
      });

      if (error) {
        console.error('Failed to update booking:', error);
        return { success: false, error: error?.message || 'Unable to update booking' };
      }

      if (data) {
        setBookings(prev => prev.map(b => 
          b.id === id ? mapBookingFromDb(data) : b
        ));
        return { success: true };
      }
    }

    setBookings(prev => prev.map(b => 
      b.id === id ? { ...b, ...updates } : b
    ));

    return { success: true };
  };

  const cancelBooking = async (id) => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.rpc('cancel_booking_record', {
        p_booking_id: id
      });

      if (error) {
        console.error('Failed to cancel booking:', error);
        return { success: false, error: error?.message || 'Unable to cancel booking' };
      }

      if (data) {
        setBookings(prev => prev.map(b => 
          b.id === id ? mapBookingFromDb(data) : b
        ));
        return { success: true };
      }
    }

    setBookings(prev => prev.map(b => 
      b.id === id ? { ...b, status: 'cancelled' } : b
    ));
    return { success: true };
  };

  const deleteBooking = async (id) => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.rpc('delete_booking_record', {
        p_booking_id: id
      });

      if (error) {
        console.error('Failed to delete booking:', error);
        return { success: false, error: error?.message || 'Unable to delete booking' };
      }
    }

    setBookings(prev => prev.filter(b => b.id !== id));
    return { success: true };
  };

  const submitFlightHours = async (bookingId, actualHours) => {
    const hours = parseFloat(actualHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return { success: false, error: 'Enter a valid flight time' };
    }

    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase.rpc('submit_flight_hours', {
        p_booking_id: bookingId,
        p_actual_hours: hours
      });

      if (error) {
        console.error('Failed to submit flight hours:', error);
        return { success: false, error: error?.message || 'Unable to submit flight hours' };
      }
    }

    setBookings(prev => prev.map(b => (
      b.id === bookingId
        ? {
            ...b,
            actualHours: hours,
            actualHoursSubmittedAt: new Date().toISOString(),
            actualHoursStatus: 'pending'
          }
        : b
    )));

    return { success: true };
  };

  const approveFlightHours = async (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (!Number.isFinite(parseFloat(booking.actualHours)) || booking.actualHoursStatus !== 'pending') {
      return { success: false, error: 'Booking does not have pending submitted hours' };
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase.rpc('approve_flight_hours', {
        p_booking_id: bookingId
      });

      if (error) {
        console.error('Failed to approve flight hours:', error);
        return { success: false, error: error?.message || 'Unable to approve flight hours' };
      }
    }

    setBookings(prev => prev.map(b => (
      b.id === bookingId
        ? {
            ...b,
            status: 'completed',
            actualHoursStatus: 'approved',
            actualHoursApprovedAt: new Date().toISOString()
          }
        : b
    )));

    setHelicopters(prev => prev.map(h => (
      h.id === booking.helicopterId
        ? { ...h, hobbsTime: (parseFloat(h.hobbsTime) || 0) + parseFloat(booking.actualHours || 0) }
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
    submitFlightHours,
    approveFlightHours,
    completeFlightHours: submitFlightHours,
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
