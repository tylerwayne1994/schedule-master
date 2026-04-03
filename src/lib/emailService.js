// Email Service using Twilio SendGrid via Vercel serverless function

/**
 * Check if email service is available (always true since backend handles config)
 */
export function isEmailConfigured() {
  return true; // Config is server-side now
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

  const payload = {
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
    notes: booking.notes || 'None'
  };

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Email API error:', result);
      return { success: false, error: result.error || 'Failed to send email' };
    }

    console.log('CFI notification sent:', instructor.email);
    return { success: true };
  } catch (error) {
    console.error('Failed to send CFI notification:', error);
    return { success: false, error: error.message };
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

  const payload = {
    to_email: booking.customerEmail,
    to_name: booking.customerName || 'Customer',
    flight_date: dateDisplay,
    flight_time: `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`,
    helicopter_tail: helicopter?.tailNumber || 'N/A',
    helicopter_model: helicopter?.model || 'N/A',
    flight_type: booking.flightType || booking.type || 'Flight',
    customer_name: booking.customerName || '',
    customer_email: '',
    customer_phone: '',
    notes: booking.notes || 'None'
  };

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Email API error:', result);
      return { success: false, error: result.error || 'Failed to send email' };
    }

    console.log('Booking confirmation sent:', booking.customerEmail);
    return { success: true };
  } catch (error) {
    console.error('Failed to send booking confirmation:', error);
    return { success: false, error: error.message };
  }
}
