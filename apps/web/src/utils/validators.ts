/**
 * Validation utility functions
 */

export function validateRequired(value: any, fieldName: string): string | null {
  if (value == null || value === '') {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
}

export function validateMinLength(value: string, minLength: number, fieldName: string): string | null {
  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters long`;
  }
  return null;
}

export function validateMaxLength(value: string, maxLength: number, fieldName: string): string | null {
  if (value.length > maxLength) {
    return `${fieldName} must be no more than ${maxLength} characters long`;
  }
  return null;
}

export function validatePattern(value: string, pattern: RegExp, message: string): string | null {
  if (!pattern.test(value)) {
    return message;
  }
  return null;
}

export function validateUrl(url: string): string | null {
  try {
    new URL(url);
    return null;
  } catch {
    return 'Please enter a valid URL';
  }
}

export function validatePhoneNumber(phone: string): string | null {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
    return 'Please enter a valid phone number';
  }
  return null;
}

export function validateDate(date: string): string | null {
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return 'Please enter a valid date';
  }
  return null;
}

export function validateFutureDate(date: string): string | null {
  const parsedDate = new Date(date);
  const now = new Date();
  if (parsedDate <= now) {
    return 'Date must be in the future';
  }
  return null;
}

export function validatePastDate(date: string): string | null {
  const parsedDate = new Date(date);
  const now = new Date();
  if (parsedDate >= now) {
    return 'Date must be in the past';
  }
  return null;
}

const validators = {
  required: validateRequired,
  email: validateEmail,
  minLength: validateMinLength,
  maxLength: validateMaxLength,
  pattern: validatePattern,
  url: validateUrl,
  phone: validatePhoneNumber,
  date: validateDate,
  futureDate: validateFutureDate,
  pastDate: validatePastDate,
};

export default validators;
