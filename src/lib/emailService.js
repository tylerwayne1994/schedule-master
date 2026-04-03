// Notification Service using Twilio SMS via Vercel serverless function

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
 * Format date for display (shorter format for SMS)
 */
function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Send SMS notification to CFI when scheduled for a flight
 * @param {Object} booking - The booking data
 * @param {Object} instructor - The instructor being notified
 * @param {Object} helicopter - The helicopter data
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendCFINotification(booking, instructor, helicopter) {
  if (!instructor?.phone) {
    console.warn('No instructor phone provided');
    return { success: false, error: 'No instructor phone number' };
  }

  const formattedDate = formatDateShort(booking.date);
  const formattedEndDate = booking.endDate && booking.endDate !== booking.date 
    ? formatDateShort(booking.endDate) 
    : null;
  
  const dateDisplay = formattedEndDate 
    ? `${formattedDate} - ${formattedEndDate}`
    : formattedDate;

  const payload = {
    to_phone: instructor.phone,
    to_name: instructor.name || 'Instructor',
    flight_date: dateDisplay,
    flight_time: `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`,
    helicopter_tail: helicopter?.tailNumber || 'N/A',
    helicopter_model: helicopter?.model || 'N/A',
    flight_type: booking.flightType || booking.type || 'Flight',
    customer_name: booking.customerName || 'Not specified',
    customer_phone: booking.customerPhone || ''
  };

  try {
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('SMS API error:', result);
      return { success: false, error: result.error || 'Failed to send SMS' };
    }

    console.log('CFI notification sent to:', instructor.phone);
    return { success: true };
  } catch (error) {
    console.error('Failed to send CFI notification:', error);
    return { success: false, error: error.message };
  }
}
