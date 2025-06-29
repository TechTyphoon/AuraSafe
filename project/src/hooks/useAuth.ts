/**
 * Authentication hook for AuraSAFE
 * Manages user authentication state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
}

interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
}

interface SignInData {
  email: string;
  password: string;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false
  });

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }

        if (mounted) {
          setAuthState({
            user: session?.user ?? null,
            session,
            loading: false,
            initialized: true
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setAuthState(prev => ({
            ...prev,
            loading: false,
            initialized: true
          }));
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (mounted) {
          setAuthState({
            user: session?.user ?? null,
            session,
            loading: false,
            initialized: true
          });

          // Handle auth events
          switch (event) {
            case 'SIGNED_IN':
              toast.success('Successfully signed in!');
              break;
            case 'SIGNED_OUT':
              toast.success('Successfully signed out!');
              break;
            case 'TOKEN_REFRESHED':
              console.log('Token refreshed');
              break;
            case 'USER_UPDATED':
              toast.success('Profile updated!');
              break;
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign up new user
  const signUp = useCallback(async ({ email, password, fullName }: SignUpData) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
          }
        }
      });

      if (error) throw error;

      if (data.user && !data.session) {
        toast.success('Check your email for the confirmation link!');
      }

      return { data, error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast.error(authError.message || 'Failed to sign up');
      return { data: null, error: authError };
    } finally {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Sign in existing user
  const signIn = useCallback(async ({ email, password }: SignInData) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast.error(authError.message || 'Failed to sign in');
      return { data: null, error: authError };
    } finally {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Sign out user
  const signOut = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast.error(authError.message || 'Failed to sign out');
      return { error: authError };
    } finally {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      toast.success('Password reset email sent!');
      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast.error(authError.message || 'Failed to send reset email');
      return { error: authError };
    }
  }, []);

  // Update user profile
  const updateProfile = useCallback(async (updates: {
    full_name?: string;
    avatar_url?: string;
    safety_preferences?: any;
  }) => {
    try {
      if (!authState.user) throw new Error('No user logged in');

      const { error } = await supabase.auth.updateUser({
        data: updates
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast.error(authError.message || 'Failed to update profile');
      return { error: authError };
    }
  }, [authState.user]);

  // Get user profile from database
  const getUserProfile = useCallback(async () => {
    try {
      if (!authState.user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authState.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }, [authState.user]);

  return {
    // State
    user: authState.user,
    session: authState.session,
    loading: authState.loading,
    initialized: authState.initialized,
    isAuthenticated: !!authState.user,

    // Actions
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    getUserProfile
  };
};

export default useAuth;