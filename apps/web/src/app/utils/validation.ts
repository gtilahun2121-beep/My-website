/**
 * Validation Utilities
 * Type-safe validation helpers for forms and data
 */

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationSchema {
  private errors: ValidationError[] = [];

  /**
   * Phone Number Validation
   */
  static validatePhone(phone: string): { valid: boolean; error?: string } {
    if (!phone) {
      return { valid: false, error: 'Phone number is required' };
    }
    // Accept: +251912345678, 0912345678, 9 followed by 8 digits, spaces/dashes allowed
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    if (!cleanPhone.match(/^(\+251|0|251)?9\d{8}$/)) {
      return { valid: false, error: 'Enter valid Ethiopian phone (9XX XXX XXXX)' };
    }
    return { valid: true };
  }

  /**
   * PIN Validation
   */
  static validatePin(pin: string, fieldName = 'PIN'): { valid: boolean; error?: string } {
    if (!pin) {
      return { valid: false, error: `${fieldName} is required` };
    }
    if (!/^\d{4}$/.test(pin)) {
      return { valid: false, error: `${fieldName} must be exactly 4 digits` };
    }
    return { valid: true };
  }

  /**
   * Full Name Validation
   */
  static validateFullName(name: string): { valid: boolean; error?: string } {
    if (!name || !name.trim()) {
      return { valid: false, error: 'Full name is required' };
    }
    if (name.trim().length < 3) {
      return { valid: false, error: 'Full name must be at least 3 characters' };
    }
    if (name.trim().length > 100) {
      return { valid: false, error: 'Full name cannot exceed 100 characters' };
    }
    return { valid: true };
  }

  /**
   * Fayda Number Validation
   */
  static validateFaydaNumber(fayda: string): { valid: boolean; error?: string } {
    if (!fayda || !fayda.trim()) {
      return { valid: false, error: 'Fayda number is required' };
    }
    if (!/^\d{6,12}$/.test(fayda.trim())) {
      return { valid: false, error: 'Fayda number must be 6-12 digits' };
    }
    return { valid: true };
  }

  /**
   * Email Validation
   */
  static validateEmail(email: string): { valid: boolean; error?: string } {
    if (!email) {
      return { valid: false, error: 'Email is required' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { valid: false, error: 'Invalid email format' };
    }
    return { valid: true };
  }

  /**
   * OTP Validation
   */
  static validateOtp(otp: string): { valid: boolean; error?: string } {
    if (!otp) {
      return { valid: false, error: 'Verification code is required' };
    }
    if (!/^\d{6}$/.test(otp)) {
      return { valid: false, error: 'Code must be exactly 6 digits' };
    }
    return { valid: true };
  }

  /**
   * PIN Confirmation
   */
  static validatePinConfirmation(
    pin: string,
    confirm: string
  ): { valid: boolean; error?: string } {
    if (pin !== confirm) {
      return { valid: false, error: 'PINs do not match' };
    }
    return { valid: true };
  }

  /**
   * Equb Selection Validation
   */
  static validateEqubSelection(equbId: string): { valid: boolean; error?: string } {
    if (!equbId) {
      return { valid: false, error: 'Equb selection is required' };
    }
    return { valid: true };
  }

  /**
   * Multi-field Validation
   */
  static validateRegistration(data: {
    equbId: string;
    phoneNumber: string;
    fullName: string;
    pin: string;
    faydaNumber: string;
  }): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    const equbValidation = this.validateEqubSelection(data.equbId);
    if (!equbValidation.valid) {
      errors.push({ field: 'equbId', message: equbValidation.error! });
    }

    const phoneValidation = this.validatePhone(data.phoneNumber);
    if (!phoneValidation.valid) {
      errors.push({ field: 'phoneNumber', message: phoneValidation.error! });
    }

    const nameValidation = this.validateFullName(data.fullName);
    if (!nameValidation.valid) {
      errors.push({ field: 'fullName', message: nameValidation.error! });
    }

    const pinValidation = this.validatePin(data.pin);
    if (!pinValidation.valid) {
      errors.push({ field: 'pin', message: pinValidation.error! });
    }

    const faydaValidation = this.validateFaydaNumber(data.faydaNumber);
    if (!faydaValidation.valid) {
      errors.push({ field: 'faydaNumber', message: faydaValidation.error! });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Login Validation
   */
  static validateLogin(data: { phoneNumber: string; pin: string }): {
    valid: boolean;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];

    const phoneValidation = this.validatePhone(data.phoneNumber);
    if (!phoneValidation.valid) {
      errors.push({ field: 'phoneNumber', message: phoneValidation.error! });
    }

    const pinValidation = this.validatePin(data.pin);
    if (!pinValidation.valid) {
      errors.push({ field: 'pin', message: pinValidation.error! });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default ValidationSchema;
