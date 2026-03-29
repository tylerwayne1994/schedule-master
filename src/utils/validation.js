// Validation utility functions

export const validators = {
  required: (value, fieldName) => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return `${fieldName} is required`;
    }
    return null;
  },

  email: (value) => {
    if (!value) return null; // Optional unless combined with required
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  phone: (value) => {
    if (!value) return null; // Optional unless combined with required
    // Accept various phone formats: (123) 456-7890, 123-456-7890, 1234567890, +1234567890
    // Phone validation - check minimum digits
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return 'Please enter a valid phone number';
    }
    return null;
  },

  minLength: (value, min, fieldName) => {
    if (value && value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (value, max, fieldName) => {
    if (value && value.length > max) {
      return `${fieldName} must be no more than ${max} characters`;
    }
    return null;
  },

  positiveNumber: (value, fieldName) => {
    if (value !== undefined && value !== null && (isNaN(value) || value <= 0)) {
      return `${fieldName} must be a positive number`;
    }
    return null;
  },

  dateNotInPast: (value, allowToday = true) => {
    if (!value) return null;
    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (allowToday) {
      if (date < today) {
        return 'Date cannot be in the past';
      }
    } else {
      if (date <= today) {
        return 'Date must be in the future';
      }
    }
    return null;
  },

  endDateAfterStart: (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return 'End date cannot be before start date';
    }
    return null;
  },

  endTimeAfterStart: (startTime, endTime, isSameDay) => {
    if (isSameDay && endTime <= startTime) {
      return 'End time must be after start time';
    }
    return null;
  },

  password: (value) => {
    if (!value) return 'Password is required';
    if (value.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return null;
  },

  passwordMatch: (password, confirmPassword) => {
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  }
};

// Validate an entire form
export function validateForm(data, rules) {
  const errors = {};
  
  for (const [field, fieldRules] of Object.entries(rules)) {
    for (const rule of fieldRules) {
      const error = rule(data[field], data);
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Booking form validation rules
export function validateBookingForm(data) {
  const errors = {};

  // Customer name
  if (!data.customerName || data.customerName.trim() === '') {
    errors.customerName = 'Customer name is required';
  } else if (data.customerName.length < 2) {
    errors.customerName = 'Name must be at least 2 characters';
  }

  // Customer email (optional but must be valid if provided)
  if (data.customerEmail) {
    const emailError = validators.email(data.customerEmail);
    if (emailError) errors.customerEmail = emailError;
  }

  // Customer phone (optional but must be valid if provided)
  if (data.customerPhone) {
    const phoneError = validators.phone(data.customerPhone);
    if (phoneError) errors.customerPhone = phoneError;
  }

  // Helicopter selection
  if (!data.helicopterId) {
    errors.helicopterId = 'Please select a helicopter';
  }

  // Date validation
  if (!data.date) {
    errors.date = 'Start date is required';
  }

  // End date validation
  if (!data.endDate) {
    errors.endDate = 'End date is required';
  } else if (data.date && data.endDate < data.date) {
    errors.endDate = 'End date cannot be before start date';
  }

  // Time validation
  if (data.date === data.endDate && data.endTime <= data.startTime) {
    errors.endTime = 'End time must be after start time';
  }

  // Type validation
  if (!data.type) {
    errors.type = 'Please select a booking type';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Auth form validation
export function validateLoginForm(data) {
  const errors = {};

  if (!data.email || data.email.trim() === '') {
    errors.email = 'Email is required';
  } else {
    const emailError = validators.email(data.email);
    if (emailError) errors.email = emailError;
  }

  if (!data.password) {
    errors.password = 'Password is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateRegisterForm(data) {
  const errors = {};

  if (!data.name || data.name.trim() === '') {
    errors.name = 'Name is required';
  } else if (data.name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!data.email || data.email.trim() === '') {
    errors.email = 'Email is required';
  } else {
    const emailError = validators.email(data.email);
    if (emailError) errors.email = emailError;
  }

  const passwordError = validators.password(data.password);
  if (passwordError) errors.password = passwordError;

  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export default validators;
