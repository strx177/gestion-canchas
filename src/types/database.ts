export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = Database['public']['Enums']['app_role'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: AppRole;
          customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: AppRole;
          customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: AppRole;
          customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
      courts: {
        Row: {
          id: string;
          name: string;
          sport: string;
          status: string;
          hourly_rate: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sport: string;
          status?: string;
          hourly_rate?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sport?: string;
          status?: string;
          hourly_rate?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          customer_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          customer_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          customer_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
      reservations: {
        Row: {
          id: string;
          court_id: string;
          customer_id: string;
          team_id: string | null;
          starts_at: string;
          ends_at: string;
          status: string;
          total_amount: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          court_id: string;
          customer_id: string;
          team_id?: string | null;
          starts_at: string;
          ends_at: string;
          status?: string;
          total_amount?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          court_id?: string;
          customer_id?: string;
          team_id?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: string;
          total_amount?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_court_id_fkey";
            columns: ["court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          }
        ];
      };
      court_schedules: {
        Row: {
          id: string;
          court_id: string;
          weekday: number;
          opens_at: string;
          closes_at: string;
          is_closed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          court_id: string;
          weekday: number;
          opens_at: string;
          closes_at: string;
          is_closed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          court_id?: string;
          weekday?: number;
          opens_at?: string;
          closes_at?: string;
          is_closed?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      maintenance_periods: {
        Row: {
          id: string;
          court_id: string;
          title: string;
          description: string | null;
          starts_at: string;
          ends_at: string;
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          court_id: string;
          title: string;
          description?: string | null;
          starts_at: string;
          ends_at: string;
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          court_id?: string;
          title?: string;
          description?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          reservation_id: string;
          amount: number;
          method: 'cash' | 'card' | 'transfer' | 'other';
          status: 'paid' | 'refunded';
          reference: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          amount: number;
          method: 'cash' | 'card' | 'transfer' | 'other';
          status?: 'paid' | 'refunded';
          reference?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          amount?: number;
          method?: 'cash' | 'card' | 'transfer' | 'other';
          status?: 'paid' | 'refunded';
          reference?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tournaments: {
        Row: {
          id: string;
          name: string;
          sport: string;
          description: string | null;
          starts_on: string;
          ends_on: string;
          status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sport: string;
          description?: string | null;
          starts_on: string;
          ends_on: string;
          status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sport?: string;
          description?: string | null;
          starts_on?: string;
          ends_on?: string;
          status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tournament_teams: {
        Row: {
          tournament_id: string;
          team_id: string;
          registered_at: string;
        };
        Insert: {
          tournament_id: string;
          team_id: string;
          registered_at?: string;
        };
        Update: {
          tournament_id?: string;
          team_id?: string;
          registered_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          tournament_id: string;
          court_id: string | null;
          home_team_id: string;
          away_team_id: string;
          referee_id: string | null;
          starts_at: string;
          ends_at: string;
          home_score: number | null;
          away_score: number | null;
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          court_id?: string | null;
          home_team_id: string;
          away_team_id: string;
          referee_id?: string | null;
          starts_at: string;
          ends_at: string;
          home_score?: number | null;
          away_score?: number | null;
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
          created_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          court_id?: string | null;
          home_team_id?: string;
          away_team_id?: string;
          referee_id?: string | null;
          starts_at?: string;
          ends_at?: string;
          home_score?: number | null;
          away_score?: number | null;
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          title: string;
          body: string;
          reservation_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          title: string;
          body: string;
          reservation_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          title?: string;
          body?: string;
          reservation_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_app_role: {
        Args: Record<PropertyKey, never>;
        Returns: AppRole;
      };
      current_customer_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      set_app_user_role: {
        Args: {
          target_user_id: string;
          new_role: AppRole;
        };
        Returns: undefined;
      };
      create_reservation: {
        Args: {
          target_court_id: string;
          target_starts_at: string;
          duration_minutes: number;
          target_customer_id?: string | null;
          target_team_id?: string | null;
          target_notes?: string | null;
        };
        Returns: Reservation;
      };
      set_reservation_status: {
        Args: {
          target_reservation_id: string;
          new_status: string;
        };
        Returns: Reservation;
      };
      available_reservation_slots: {
        Args: {
          target_court_id: string;
          target_date: string;
          duration_minutes: number;
        };
        Returns: Array<{
          starts_at: string;
          ends_at: string;
        }>;
      };
      list_referees: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          id: string;
          full_name: string;
        }>;
      };
    };
    Enums: {
      app_role: 'owner' | 'receptionist' | 'customer' | 'maintenance' | 'referee';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Court = Database['public']['Tables']['courts']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Team = Database['public']['Tables']['teams']['Row'];
export type Reservation = Database['public']['Tables']['reservations']['Row'];
export type CourtSchedule = Database['public']['Tables']['court_schedules']['Row'];
export type MaintenancePeriod = Database['public']['Tables']['maintenance_periods']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type Tournament = Database['public']['Tables']['tournaments']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];

export interface FacilityData {
  courts: Court[];
  customers: Customer[];
  teams: Team[];
  reservations: Reservation[];
}
