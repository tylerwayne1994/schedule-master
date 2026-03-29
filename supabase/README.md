# Supabase Setup for Next Level Helicopters

## Setup Instructions

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your Project URL and anon/public API key from Settings > API

### 2. Run the Schema
1. Go to SQL Editor in your Supabase dashboard
2. Run these files in order:
   - `schema.sql` - Core tables and RLS policies
   - `functions.sql` - Utility functions
   - `notifications.sql` - Email notification system

### 3. Enable Google OAuth
1. Go to Authentication > Providers > Google
2. Enable Google provider
3. Get your Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Go to APIs & Services > Credentials
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase
5. Enable these Google APIs:
   - Google Calendar API (for calendar integration)
   - Gmail API (optional, for direct email)

### 4. Environment Variables
Create a `.env` file in the client folder:

```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Create Initial Admin User
After creating your first account through the app, run this SQL to make them admin:

```sql
SELECT make_user_admin('your-email@example.com');
```

### 6. Email Notifications (Optional)
For automated email notifications, you have two options:

**Option A: Supabase Edge Functions + Resend/SendGrid**
1. Create an Edge Function to process pending notifications
2. Set up a cron job or webhook to trigger it

**Option B: Use Supabase's built-in email (limited)**
- Only works for auth emails by default

## Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (extends Supabase Auth) |
| `helicopters` | Fleet inventory with hobbs time tracking |
| `instructors` | Flight instructors and their certifications |
| `bookings` | All flight bookings/reservations |
| `booking_notifications` | Email notification queue |

## Key Functions

| Function | Description |
|----------|-------------|
| `check_booking_conflict()` | Checks if a time slot is already booked |
| `get_bookings_for_date()` | Gets all bookings for a specific date with details |
| `get_user_stats()` | Gets flight stats for a user (hours, cost, etc.) |
| `get_admin_dashboard_stats()` | Aggregate stats for admin dashboard |
| `make_user_admin()` | Promote a user to admin role |
| `get_booking_recipients()` | Get all people to notify for a booking |

## Row Level Security

- **Profiles**: Users can view/edit their own profile; admins can view/edit all
- **Helicopters**: Everyone can view; only admins can create/update/delete
- **Instructors**: Everyone can view; only admins can create/update/delete
- **Bookings**: Users can view all (for scheduling), but only edit their own; admins can do everything

## Automatic Features

- **Profile Creation**: Automatically creates a profile when a new user signs up
- **Updated Timestamps**: All tables auto-update `updated_at` on changes
- **Hobbs Time Tracking**: Automatically increments hobbs time when a booking is marked "completed"
- **Notification Queue**: Automatically creates notification records when bookings are created/updated

## Google Calendar Integration

When users sign in with Google:
1. They grant calendar access
2. Bookings can be added directly to their Google Calendar
3. Calendar events include:
   - Flight details (aircraft, time, instructor)
   - Automatic reminders (1 day before and 1 hour before)
   - Location set to "Next Level Helicopters"
