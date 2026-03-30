-- =============================================
-- Next Level Helicopters - Supabase Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES TABLE (extends Supabase Auth)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  address TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- HELICOPTERS TABLE
-- =============================================
CREATE TABLE helicopters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tail_number TEXT UNIQUE NOT NULL,
  model TEXT NOT NULL,
  hourly_rate DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'unavailable')),
  hobbs_time DECIMAL(10, 1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INSTRUCTORS TABLE
-- =============================================
CREATE TABLE instructors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  certifications TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BOOKINGS TABLE
-- =============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  helicopter_id UUID NOT NULL REFERENCES helicopters(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  date DATE NOT NULL,              -- Start date
  end_date DATE NOT NULL,          -- End date (can be same as date or later)
  start_time DECIMAL(4, 2) NOT NULL, -- 9.5 = 9:30 AM
  end_time DECIMAL(4, 2) NOT NULL,   -- 11.0 = 11:00 AM
  flight_type TEXT DEFAULT 'training' CHECK (flight_type IN ('training', 'rental', 'tour', 'maintenance', 'checkride')),
  notes TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  actual_hours DECIMAL(10, 1),
  actual_hours_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure end_date >= date
  CONSTRAINT valid_date_range CHECK (end_date >= date),
  -- Ensure times are valid (0-24)
  CONSTRAINT valid_start_time CHECK (start_time >= 0 AND start_time < 24),
  CONSTRAINT valid_end_time CHECK (end_time > 0 AND end_time <= 24),
  -- For same-day bookings, end_time must be after start_time
  CONSTRAINT valid_same_day_time CHECK (end_date > date OR end_time > start_time)
);

-- Index for faster booking queries
CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_bookings_helicopter ON bookings(helicopter_id, date);
CREATE INDEX idx_bookings_user ON bookings(user_id);

-- =============================================
-- NOTIFICATIONS TABLE (Admin alerts)
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT,
  message TEXT NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE helicopters ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (is_admin());

-- HELICOPTERS POLICIES (everyone can view, only admins can modify)
CREATE POLICY "Everyone can view helicopters"
  ON helicopters FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert helicopters"
  ON helicopters FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update helicopters"
  ON helicopters FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete helicopters"
  ON helicopters FOR DELETE
  USING (is_admin());

-- INSTRUCTORS POLICIES (everyone can view, only admins can modify)
CREATE POLICY "Everyone can view instructors"
  ON instructors FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert instructors"
  ON instructors FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update instructors"
  ON instructors FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete instructors"
  ON instructors FOR DELETE
  USING (is_admin());

-- BOOKINGS POLICIES
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view all bookings for scheduling"
  ON bookings FOR SELECT
  USING (true); -- Everyone sees all bookings on the schedule grid

CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookings"
  ON bookings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can do everything with bookings"
  ON bookings FOR ALL
  USING (is_admin());

-- NOTIFICATIONS POLICIES (admins only)
CREATE POLICY "Admins can view notifications"
  ON notifications FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update notifications"
  ON notifications FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete notifications"
  ON notifications FOR DELETE
  USING (is_admin());

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_helicopters_updated_at
  BEFORE UPDATE ON helicopters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_instructors_updated_at
  BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- SEED DATA
-- =============================================

-- Default helicopters
INSERT INTO helicopters (tail_number, model, hourly_rate, status, hobbs_time) VALUES
  ('N44NL', 'R44 Raven II', 350.00, 'available', 1245.3),
  ('N22NL', 'R22 Beta II', 250.00, 'available', 2340.8),
  ('N66NL', 'R66 Turbine', 550.00, 'available', 856.2),
  ('N300NL', 'EC130 B4', 850.00, 'available', 1523.5),
  ('N407NL', 'Bell 407', 950.00, 'maintenance', 3102.1);

-- Default instructors
INSERT INTO instructors (name, certifications, status) VALUES
  ('John Smith', ARRAY['CFI', 'CFII'], 'active'),
  ('Sarah Johnson', ARRAY['CFI', 'CFII', 'MEI'], 'active'),
  ('Mike Davis', ARRAY['CFI'], 'active');
