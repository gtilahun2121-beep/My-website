'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { authAPI, APIError } from '@/app/services/api';

export type UserRole = 'guest' | 'member' | 'admin';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  profession: string;
  role: UserRole;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  signin: (phoneNumber: string, pin: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  signout: () => void;
  resetPin: (phoneNumber: string, newPin: string) => Promise<void>;
}

interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber: string;
  profession: string;
  fayda: string;
  guarantor: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('guest');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('qalnet_user');
      const storedToken = localStorage.getItem('authToken');

      if (storedUser && storedToken) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setRole(parsedUser.role || 'member');
        } catch (error) {
          console.error('Failed to parse stored user:', error);
          localStorage.removeItem('qalnet_user');
          localStorage.removeItem('authToken');
        }
      }
      setIsLoading(false);
    }
  }, []);

  const signin = useCallback(async (phoneNumber: string, pin: string) => {
    setIsLoading(true);
    try {
      const response = await authAPI.signin(phoneNumber, pin);

      // Backend returns snake_case: access_token, refresh_token
      // Build a local user object from the JWT payload
      const userData: User = {
        id: `user_${Date.now()}`,
        firstName: 'User',
        lastName: '',
        email: '',
        phoneNumber,
        profession: '',
        role: 'member' as UserRole,
        createdAt: new Date().toISOString(),
      };

      setUser(userData);
      setRole(userData.role);

      localStorage.setItem('qalnet_user', JSON.stringify(userData));
      localStorage.setItem('authToken', response.access_token);

      if (response.refresh_token) {
        localStorage.setItem('refreshToken', response.refresh_token);
      }
    } catch (error) {
      const message = error instanceof APIError
        ? error.data?.message || error.message
        : error instanceof Error ? error.message : 'Sign in failed';
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (data: SignupData) => {
    setIsLoading(true);
    try {
      const response = await authAPI.signup({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phoneNumber: data.phoneNumber,
        profession: data.profession,
        fayda: data.fayda,
        guarantor: data.guarantor,
      });

      // Backend returns snake_case: access_token, refresh_token
      const userData: User = {
        id: `user_${Date.now()}`,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        profession: data.profession || 'Not specified',
        role: 'member' as UserRole,
        createdAt: new Date().toISOString(),
      };

      setUser(userData);
      setRole(userData.role);

      localStorage.setItem('qalnet_user', JSON.stringify(userData));
      localStorage.setItem('authToken', response.access_token);

      if (response.refresh_token) {
        localStorage.setItem('refreshToken', response.refresh_token);
      }
    } catch (error) {
      const message = error instanceof APIError
        ? error.data?.message || error.message
        : error instanceof Error ? error.message : 'Sign up failed';
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signout = useCallback(() => {
    setUser(null);
    setRole('guest');
    localStorage.removeItem('qalnet_user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }, []);

  const resetPin = useCallback(async (phoneNumber: string, newPin: string) => {
    setIsLoading(true);
    try {
      // Call backend API to reset PIN
      await authAPI.resetPin(phoneNumber, '', newPin); // OTP would be sent separately

      // PIN reset successful - user needs to sign in again with new PIN
      signout();
    } catch (error) {
      const message = error instanceof APIError
        ? error.data?.message || error.message
        : error instanceof Error ? error.message : 'PIN reset failed';
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [signout]);

  const value: AuthContextType = {
    user,
    role,
    isAuthenticated: user !== null,
    isLoading,
    signin,
    signup,
    signout,
    resetPin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
