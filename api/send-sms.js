// Vercel Serverless Function for sending SMS via Twilio
const twilio = require('twilio');

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for Twilio credentials
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken || !messagingServiceSid) {
    console.error('Twilio credentials not configured');
    return res.status(500).json({ error: 'SMS service not configured' });
  }

  const client = twilio(accountSid, authToken);

  const {
    to_phone,
    to_name,
    flight_date,
    flight_time,
    helicopter_tail,
    helicopter_model,
    flight_type,
    customer_name,
    customer_phone
  } = req.body;

  // Validate required fields
  if (!to_phone) {
    return res.status(400).json({ error: 'Recipient phone number is required' });
  }

  // Format phone number (ensure it starts with +1 for US)
  let formattedPhone = to_phone.replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = '+1' + formattedPhone;
  } else if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  const message = `Next Level Helicopters - Flight Scheduled

Hi ${to_name || 'Instructor'},

You've been assigned a flight:
Date: ${flight_date}
Time: ${flight_time}
Aircraft: ${helicopter_tail} (${helicopter_model})
Type: ${flight_type}
Student: ${customer_name || 'TBD'}${customer_phone ? `\nStudent Phone: ${customer_phone}` : ''}

Please arrive 15 min early.`;

  try {
    const result = await client.messages.create({
      body: message,
      messagingServiceSid: messagingServiceSid,
      to: formattedPhone
    });

    console.log('SMS sent:', result.sid);
    return res.status(200).json({ success: true, sid: result.sid });
  } catch (error) {
    console.error('Twilio error:', error);
    return res.status(500).json({ 
      error: 'Failed to send SMS',
      details: error.message 
    });
  }
}
