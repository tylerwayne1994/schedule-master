// Email Service using EmailJS for automatic notifications
import emailjs from '@emailjs/browser';

// Initialize EmailJS with public key
const EMAILJS_SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;

/**
 * Check if EmailJS is configured
 */
export function isEmailConfigured() {
  return !!(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);
}

/**
 * Format time from decimal to display string (e.g., 9.5 -> "9:30 AM")
 */
function formatTime(decimal) {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal % 1) * 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Send email notification to CFI when scheduled for a flight
 * @param {Object} booking - The booking data
 * @param {Object} instructor - The instructor being notified
 * @param {Object} helicopter - The helicopter data
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendCFINotification(booking, instructor, helicopter) {
  if (!isEmailConfigured()) {
    console.warn('EmailJS not configured - skipping CFI notification');
    return { success: false, error: 'Email service not configured' };
  }

  if (!instructor?.email) {
    console.warn('No instructor email provided');
    return { success: false, error: 'No instructor email' };
  }

  const formattedDate = formatDate(booking.date);
  const formattedEndDate = booking.endDate && booking.endDate !== booking.date 
    ? formatDate(booking.endDate) 
    : null;
  
  const dateDisplay = formattedEndDate 
    ? `${formattedDate} through ${formattedEndDate}`
    : formattedDate;

  const templateParams = {
    to_email: instructor.email,
    to_name: instructor.name || 'Instructor',
    flight_date: dateDisplay,
    flight_time: `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`,
    helicopter_tail: helicopter?.tailNumber || 'N/A',
    helicopter_model: helicopter?.model || 'N/A',
    flight_type: booking.flightType || booking.type || 'Flight',
    customer_name: booking.customerName || 'Not specified',
    customer_email: booking.customerEmail || '',
    customer_phone: booking.customerPhone || '',
    notes: booking.notes || 'None',
    from_name: 'Next Level Helicopters'
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.log('CFI notification sent:', response);
    return { success: true };
  } catch (error) {
    console.error('Failed to send CFI notification:', error);
    return { success: false, error: error.text || error.message };
  }
}

/**
 * Send booking confirmation to customer
 * @param {Object} booking - The booking data
 * @param {Object} helicopter - The helicopter data
 * @param {Object} instructor - The instructor (optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendBookingConfirmation(booking, helicopter, instructor) {
  if (!isEmailConfigured()) {
    console.warn('EmailJS not configured - skipping booking confirmation');
    return { success: false, error: 'Email service not configured' };
  }

  if (!booking?.customerEmail) {
    console.warn('No customer email provided');
    return { success: false, error: 'No customer email' };
  }

  const formattedDate = formatDate(booking.date);
  const formattedEndDate = booking.endDate && booking.endDate !== booking.date 
    ? formatDate(booking.endDate) 
    : null;
  
  const dateDisplay = formattedEndDate 
    ? `${formattedDate} through ${formattedEndDate}`
    : formattedDate;

  const templateParams = {
    to_email: booking.customerEmail,
    to_name: booking.customerName || 'Customer',
    flight_date: dateDisplay,
    flight_time: `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`,
    helicopter_tail: helicopter?.tailNumber || 'N/A',
    helicopter_model: helicopter?.model || 'N/A',
    flight_type: booking.flightType || booking.type || 'Flight',
    instructor_name: instructor?.name || 'Not assigned',
    notes: booking.notes || 'None',
    from_name: 'Next Level Helicopters'
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.log('Booking confirmation sent:', response);
    return { success: true };
  } catch (error) {
    console.error('Failed to send booking confirmation:', error);
    return { success: false, error: error.text || error.message };
  }
}
