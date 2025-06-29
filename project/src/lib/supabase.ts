/**
 * Supabase client configuration for AuraSAFE
 * Handles authentication and real-time features
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          safety_preferences: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          safety_preferences?: any | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          safety_preferences?: any | null;
          updated_at?: string;
        };
      };
      incidents: {
        Row: {
          id: string;
          user_id: string | null;
          location: any;
          type: string;
          description: string;
          severity: string;
          verified: boolean;
          verification_score: number;
          anonymous: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          location: any;
          type: string;
          description: string;
          severity?: string;
          verified?: boolean;
          verification_score?: number;
          anonymous?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          location?: any;
          type?: string;
          description?: string;
          severity?: string;
          verified?: boolean;
          verification_score?: number;
          anonymous?: boolean;
          updated_at?: string;
        };
      };
      routes: {
        Row: {
          id: string;
          user_id: string | null;
          start_location: any;
          end_location: any;
          route_data: any;
          safety_score: number;
          distance_km: number;
          estimated_time: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          start_location: any;
          end_location: any;
          route_data: any;
          safety_score: number;
          distance_km: number;
          estimated_time: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          start_location?: any;
          end_location?: any;
          route_data?: any;
          safety_score?: number;
          distance_km?: number;
          estimated_time?: number;
        };
      };
    };
  };
}