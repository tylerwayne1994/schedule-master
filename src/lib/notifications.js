// Booking notifications - Email and Google Calendar integration

/**
 * Generate Google Calendar event URL (opens in new tab)
 */
export function generateGoogleCalendarUrl(booking) {
  const { date, endDate, startTime, endTime, helicopter, instructor, flightType, notes, customerName, customerEmail } = booking;
  
  // Convert decimal time to Date objects
  const startDate = new Date(date);
  const endDateTime = new Date(endDate || date);
  
  const startHour = Math.floor(startTime);
  const startMin = (startTime % 1) * 60;
  const endHour = Math.floor(endTime);
  const endMin = (endTime % 1) * 60;
  
  startDate.setHours(startHour, startMin, 0);
  endDateTime.setHours(endHour, endMin, 0);
  
  // Format for Google Calendar
  const formatDate = (d) => d.toISOString().replace(/-|:|\.\d{3}/g, '');
  
  const title = encodeURIComponent(`Flight: ${helicopter.tailNumber} - ${helicopter.model}`);
  const details = encodeURIComponent(
    (customerName ? `Booked For: ${customerName}\n` : '') +
    (customerEmail ? `Email: ${customerEmail}\n` : '') +
    `Flight Type: ${flightType}\n` +
    `Helicopter: ${helicopter.tailNumber} (${helicopter.model})\n` +
    `Rate: $${helicopter.hourlyRate}/hr\n` +
    (instructor ? `Instructor: ${instructor.name}\n` : '') +
    (notes ? `Notes: ${notes}` : '')
  );
  const location = encodeURIComponent('Next Level Helicopters');
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(startDate)}/${formatDate(endDateTime)}&details=${details}&location=${location}`;
}

/**
 * Create Google Calendar event using API (requires OAuth token)
 */
export async function createGoogleCalendarEvent(accessToken, booking) {
  const { date, endDate, startTime, endTime, helicopter, instructor, flightType, notes, customerName, customerEmail } = booking;

  if (!accessToken) {
    throw new Error('Missing Google OAuth access token');
  }

  if (!helicopter) {
    throw new Error('Missing helicopter data for calendar event');
  }
  
  const startDate = new Date(date);
  const endDateTime = new Date(endDate || date);
  
  const startHour = Math.floor(startTime);
  const startMin = (startTime % 1) * 60;
  const endHour = Math.floor(endTime);
  const endMin = (endTime % 1) * 60;
  
  startDate.setHours(startHour, startMin, 0);
  endDateTime.setHours(endHour, endMin, 0);

  const attendees = [];
  if (customerEmail) {
    attendees.push({ email: customerEmail, displayName: customerName || 'Student' });
  }
  if (instructor?.email) {
    attendees.push({ email: instructor.email, displayName: instructor.name || 'Instructor' });
  }
  
  const event = {
    summary: `Flight: ${helicopter.tailNumber} - ${helicopter.model}`,
    description: 
      (customerName ? `Booked For: ${customerName}\n` : '') +
      (customerEmail ? `Email: ${customerEmail}\n` : '') +
      `Flight Type: ${flightType}\n` +
      `Helicopter: ${helicopter.tailNumber} (${helicopter.model})\n` +
      `Rate: $${helicopter.hourlyRate}/hr\n` +
      (instructor ? `Instructor: ${instructor.name}\n` : '') +
      (notes ? `Notes: ${notes}` : ''),
    location: 'Next Level Helicopters',
    start: {
      dateTime: startDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    attendees,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 60 }       // 1 hour before
      ]
    }
  };
  
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(responseText);
      } catch {
        parsedError = null;
      }
      throw new Error(
        parsedError?.error?.message || `Failed to create calendar event (${response.status} ${response.statusText}): ${responseText}`
      );
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to create Google Calendar event:', error);
    throw error;
  }
}

/**
 * Format time from decimal to display string (e.g., 9.5 -> "9:30 AM")
 */
export function formatTime(decimal) {
  const hours = Math.floor(decimal);
  const minutes = (decimal % 1) * 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Generate email body for booking confirmation
 */
export function generateBookingEmailBody(booking, userName) {
  const { date, endDate, startTime, endTime, helicopter, instructor, flightType, type, notes } = booking;
  
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedEndDate = new Date(endDate || date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const dayDiff = Math.floor((new Date(endDate || date) - new Date(date)) / (1000 * 60 * 60 * 24));
  const duration = dayDiff === 0
    ? endTime - startTime
    : (24 - startTime) + ((dayDiff - 1) * 24) + endTime;
  const resolvedFlightType = flightType || type || 'flight';
  const formattedDateLine = formattedDate === formattedEndDate
    ? formattedDate
    : `${formattedDate} through ${formattedEndDate}`;
  
  return `
Hello ${userName},

Your flight has been scheduled with Next Level Helicopters!

BOOKING DETAILS
---------------
Date: ${formattedDateLine}
Time: ${formatTime(startTime)} - ${formatTime(endTime)} (${duration} hours)
Flight Type: ${resolvedFlightType}

AIRCRAFT
--------
Tail Number: ${helicopter.tailNumber}
Model: ${helicopter.model}
Rate: $${helicopter.hourlyRate}/hour
${instructor ? `\nINSTRUCTOR\n----------\n${instructor.name}` : ''}
${notes ? `\nNOTES\n-----\n${notes}` : ''}

Please arrive 15 minutes before your scheduled flight time.

Thank you for flying with Next Level Helicopters!

---
Next Level Helicopters
Schedule Master
  `.trim();
}

export function generateBookingEmailSubject(booking, mode = 'created') {
  const { helicopter, date, type, flightType } = booking;
  const resolvedFlightType = flightType || type || 'flight';
  const action = mode === 'updated' ? 'Updated Booking' : 'Booking Confirmation';
  return `${action}: ${helicopter.tailNumber} on ${date} (${resolvedFlightType})`;
}

export function generateBookingMailtoUrl(booking, mode = 'created') {
  const recipients = [];

  if (booking.customerEmail) {
    recipients.push(booking.customerEmail);
  }

  if (booking.instructor?.email && !recipients.includes(booking.instructor.email)) {
    recipients.push(booking.instructor.email);
  }

  if (recipients.length === 0) {
    return null;
  }

  const subject = encodeURIComponent(generateBookingEmailSubject(booking, mode));
  const body = encodeURIComponent(generateBookingEmailBody(booking, booking.customerName || 'Customer'));

  return `mailto:${recipients.join(',')}?subject=${subject}&body=${body}`;
}
