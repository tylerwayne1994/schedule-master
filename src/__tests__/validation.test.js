import { 
  validators, 
  validateBookingForm, 
  validateLoginForm, 
  validateRegisterForm 
} from '../utils/validation';

describe('Validators', () => {
  describe('required', () => {
    it('should return error for empty string', () => {
      expect(validators.required('', 'Field')).toBe('Field is required');
    });

    it('should return error for null', () => {
      expect(validators.required(null, 'Field')).toBe('Field is required');
    });

    it('should return null for valid value', () => {
      expect(validators.required('value', 'Field')).toBeNull();
    });
  });

  describe('email', () => {
    it('should return null for empty value', () => {
      expect(validators.email('')).toBeNull();
    });

    it('should return error for invalid email', () => {
      expect(validators.email('invalid')).toBe('Please enter a valid email address');
      expect(validators.email('invalid@')).toBe('Please enter a valid email address');
      expect(validators.email('@domain.com')).toBe('Please enter a valid email address');
    });

    it('should return null for valid email', () => {
      expect(validators.email('test@example.com')).toBeNull();
      expect(validators.email('user.name@domain.org')).toBeNull();
    });
  });

  describe('phone', () => {
    it('should return null for empty value', () => {
      expect(validators.phone('')).toBeNull();
    });

    it('should return error for invalid phone', () => {
      expect(validators.phone('123')).toBe('Please enter a valid phone number');
      expect(validators.phone('abc')).toBe('Please enter a valid phone number');
    });

    it('should return null for valid phone numbers', () => {
      expect(validators.phone('1234567890')).toBeNull();
      expect(validators.phone('123-456-7890')).toBeNull();
      expect(validators.phone('(123) 456-7890')).toBeNull();
      expect(validators.phone('+1 234 567 8901')).toBeNull();
    });
  });

  describe('password', () => {
    it('should return error for empty password', () => {
      expect(validators.password('')).toBe('Password is required');
    });

    it('should return error for short password', () => {
      expect(validators.password('12345')).toBe('Password must be at least 6 characters');
    });

    it('should return null for valid password', () => {
      expect(validators.password('password123')).toBeNull();
    });
  });

  describe('endTimeAfterStart', () => {
    it('should return error when end time is before start on same day', () => {
      expect(validators.endTimeAfterStart(10, 9, true)).toBe('End time must be after start time');
    });

    it('should return null when end time is after start', () => {
      expect(validators.endTimeAfterStart(9, 10, true)).toBeNull();
    });

    it('should return null on different days', () => {
      expect(validators.endTimeAfterStart(10, 9, false)).toBeNull();
    });
  });
});

describe('validateBookingForm', () => {
  const validBooking = {
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    customerPhone: '123-456-7890',
    helicopterId: 'heli-001',
    date: '2026-04-01',
    endDate: '2026-04-01',
    startTime: 9,
    endTime: 11,
    type: 'flight'
  };

  it('should pass for valid booking', () => {
    const result = validateBookingForm(validBooking);
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('should fail for missing customer name', () => {
    const result = validateBookingForm({ ...validBooking, customerName: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.customerName).toBeDefined();
  });

  it('should fail for invalid email', () => {
    const result = validateBookingForm({ ...validBooking, customerEmail: 'invalid' });
    expect(result.isValid).toBe(false);
    expect(result.errors.customerEmail).toBeDefined();
  });

  it('should fail for missing helicopter', () => {
    const result = validateBookingForm({ ...validBooking, helicopterId: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.helicopterId).toBeDefined();
  });

  it('should fail for end date before start date', () => {
    const result = validateBookingForm({ 
      ...validBooking, 
      date: '2026-04-02',
      endDate: '2026-04-01'
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.endDate).toBeDefined();
  });

  it('should fail for end time before start time on same day', () => {
    const result = validateBookingForm({ 
      ...validBooking, 
      startTime: 11,
      endTime: 9
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.endTime).toBeDefined();
  });
});

describe('validateLoginForm', () => {
  it('should pass for valid login', () => {
    const result = validateLoginForm({ email: 'test@example.com', password: 'password' });
    expect(result.isValid).toBe(true);
  });

  it('should fail for missing email', () => {
    const result = validateLoginForm({ email: '', password: 'password' });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it('should fail for invalid email', () => {
    const result = validateLoginForm({ email: 'invalid', password: 'password' });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it('should fail for missing password', () => {
    const result = validateLoginForm({ email: 'test@example.com', password: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });
});

describe('validateRegisterForm', () => {
  const validRegister = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    confirmPassword: 'password123'
  };

  it('should pass for valid registration', () => {
    const result = validateRegisterForm(validRegister);
    expect(result.isValid).toBe(true);
  });

  it('should fail for missing name', () => {
    const result = validateRegisterForm({ ...validRegister, name: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('should fail for short password', () => {
    const result = validateRegisterForm({ ...validRegister, password: '12345', confirmPassword: '12345' });
    expect(result.isValid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });

  it('should fail for mismatched passwords', () => {
    const result = validateRegisterForm({ ...validRegister, confirmPassword: 'different' });
    expect(result.isValid).toBe(false);
    expect(result.errors.confirmPassword).toBeDefined();
  });
});
