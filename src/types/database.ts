export type TripStatus = 'draft' | 'active' | 'completed';

export type Database = {
  public: {
    Tables: {
      trips: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          start_date: string;
          end_date: string;
          reflection: string | null;
          status: TripStatus;
          created_at: string;
          updated_at: string;
          trip_group_id: string | null;
          is_trip_content_locked: boolean;
          is_reflection_locked: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          start_date: string;
          end_date: string;
          reflection?: string | null;
          status?: TripStatus;
          created_at?: string;
          updated_at?: string;
          trip_group_id?: string | null;
          is_trip_content_locked?: boolean;
          is_reflection_locked?: boolean;
        };
        Update: Partial<Database['public']['Tables']['trips']['Insert']>;
      };
      trip_links: {
        Row: {
          id: string;
          trip_id: string;
          label: string;
          url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          label: string;
          url: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['trip_links']['Insert']>;
      };
      trip_days: {
        Row: {
          id: string;
          trip_id: string;
          day_index: number;
          date: string;
          highlight: string | null;
          journal_entry: string | null;
          created_at: string;
          updated_at: string;
          is_locked: boolean;
        };
        Insert: {
          id?: string;
          trip_id: string;
          day_index: number;
          date: string;
          highlight?: string | null;
          journal_entry?: string | null;
          created_at?: string;
          updated_at?: string;
          is_locked?: boolean;
        };
        Update: Partial<Database['public']['Tables']['trip_days']['Insert']>;
      };
      trip_locations: {
        Row: {
          id: string;
          trip_day_id: string;
          display_name: string;
          city: string | null;
          region: string | null;
          country: string | null;
          lat: number;
          lng: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_day_id: string;
          display_name: string;
          city?: string | null;
          region?: string | null;
          country?: string | null;
          lat: number;
          lng: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['trip_locations']['Insert']>;
      };
      photos: {
        Row: {
          id: string;
          trip_id: string;
          trip_day_id: string;
          trip_location_id: string | null;
          thumbnail_url: string;
          full_url: string;
          width: number | null;
          height: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          trip_day_id: string;
          trip_location_id?: string | null;
          thumbnail_url: string;
          full_url: string;
          width?: number | null;
          height?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['photos']['Insert']>;
      };
      trip_day_hashtags: {
        Row: {
          id: string;
          trip_day_id: string;
          hashtag: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_day_id: string;
          hashtag: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['trip_day_hashtags']['Insert']>;
      };
      trip_types: {
        Row: {
          id: string;
          trip_id: string;
          type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          type: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['trip_types']['Insert']>;
      };
      trip_groups: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['trip_groups']['Insert']>;
      };
      trip_group_members: {
        Row: {
          id: string;
          trip_group_id: string;
          first_name: string | null;
          last_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_group_id: string;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['trip_group_members']['Insert']>;
      };
      user_settings: {
        Row: {
          user_id: string;
          guest_mode_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          guest_mode_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_settings']['Insert']>;
      };
    };
    Functions: {
      is_owner_of_trip: {
        Args: { trip_id: string };
        Returns: boolean;
      };
      is_owner_of_trip_day: {
        Args: { trip_day_id: string };
        Returns: boolean;
      };
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

