// Vercel Serverless Function for sending emails via Twilio SendGrid
const sgMail = require('@sendgrid/mail');

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.error('SENDGRID_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  sgMail.setApiKey(apiKey);

  const {
    to_email,
    to_name,
    flight_date,
    flight_time,
    helicopter_tail,
    helicopter_model,
    flight_type,
    customer_name,
    customer_email,
    customer_phone,
    notes
  } = req.body;

  // Validate required fields
  if (!to_email) {
    return res.status(400).json({ error: 'Recipient email is required' });
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@nextlevelhelicopters.com';
  const fromName = process.env.SENDGRID_FROM_NAME || 'Next Level Helicopters';

  const msg = {
    to: to_email,
    from: {
      email: fromEmail,
      name: fromName
    },
    subject: `Flight Scheduled: ${helicopter_tail} on ${flight_date}`,
    text: `
Hi ${to_name || 'Instructor'},

You have been scheduled for a flight.

FLIGHT DETAILS
--------------
Date: ${flight_date}
Time: ${flight_time}
Aircraft: ${helicopter_tail} (${helicopter_model})
Flight Type: ${flight_type}

STUDENT INFO
------------
Name: ${customer_name || 'Not specified'}
Email: ${customer_email || 'Not provided'}
Phone: ${customer_phone || 'Not provided'}

Notes: ${notes || 'None'}

Please arrive 15 minutes before the scheduled time.

Best regards,
Next Level Helicopters
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 20px; background: #f9f9f9; }
    .details { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #1a365d; }
    .label { font-weight: bold; color: #1a365d; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background: #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Next Level Helicopters</h1>
      <p style="margin: 5px 0 0 0;">Flight Assignment Notification</p>
    </div>
    
    <div class="content">
      <p>Hi ${to_name || 'Instructor'},</p>
      
      <p>You have been scheduled for a flight.</p>
      
      <div class="details">
        <p><span class="label">Date:</span> ${flight_date}</p>
        <p><span class="label">Time:</span> ${flight_time}</p>
        <p><span class="label">Aircraft:</span> ${helicopter_tail} (${helicopter_model})</p>
        <p><span class="label">Flight Type:</span> ${flight_type}</p>
      </div>
      
      <div class="details">
        <p><span class="label">Student:</span> ${customer_name || 'Not specified'}</p>
        <p><span class="label">Email:</span> ${customer_email || 'Not provided'}</p>
        <p><span class="label">Phone:</span> ${customer_phone || 'Not provided'}</p>
      </div>
      
      ${notes ? `<div class="details"><p><span class="label">Notes:</span> ${notes}</p></div>` : ''}
      
      <p>Please arrive 15 minutes before the scheduled time.</p>
    </div>
    
    <div class="footer">
      <p>Next Level Helicopters<br>Schedule Master System</p>
    </div>
  </div>
</body>
</html>
    `.trim()
  };

  try {
    await sgMail.send(msg);
    console.log('Email sent to:', to_email);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('SendGrid error:', error);
    if (error.response) {
      console.error('SendGrid response body:', error.response.body);
    }
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
}
