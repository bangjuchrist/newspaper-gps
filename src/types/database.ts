export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type RouteStatus = "pending" | "active" | "paused" | "done";
export type EventType = "delivered" | "remaining_initial" | "undo";

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          name: string;
          region: string;
          manager_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          region: string;
          manager_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          region?: string;
          manager_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          lat: number;
          lng: number;
          address: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          lat: number;
          lng: number;
          address?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          lat?: number;
          lng?: number;
          address?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      distributors: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          phone: string;
          auth_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          phone: string;
          auth_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          phone?: string;
          auth_user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      routes: {
        Row: {
          id: string;
          team_id: string;
          distributor_id: string;
          date: string;
          planned_waypoints: Json | null;
          last_lat: number | null;
          last_lng: number | null;
          status: RouteStatus;
          started_at: string | null;
          paused_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          distributor_id: string;
          date?: string;
          planned_waypoints?: Json | null;
          last_lat?: number | null;
          last_lng?: number | null;
          status?: RouteStatus;
          started_at?: string | null;
          paused_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          distributor_id?: string;
          date?: string;
          planned_waypoints?: Json | null;
          last_lat?: number | null;
          last_lng?: number | null;
          status?: RouteStatus;
          started_at?: string | null;
          paused_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      route_gps_points: {
        Row: {
          id: number;
          route_id: string;
          lat: number;
          lng: number;
          recorded_at: string;
        };
        Insert: {
          id?: number;
          route_id: string;
          lat: number;
          lng: number;
          recorded_at?: string;
        };
        Update: {
          id?: number;
          route_id?: string;
          lat?: number;
          lng?: number;
          recorded_at?: string;
        };
        Relationships: [];
      };
      distribution_events: {
        Row: {
          id: string;
          route_id: string;
          distributor_id: string;
          type: EventType;
          count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          distributor_id: string;
          type: EventType;
          count: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          route_id?: string;
          distributor_id?: string;
          type?: EventType;
          count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          route_id: string;
          distributor_id: string;
          date: string;
          summary_text: string | null;
          issues: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          distributor_id: string;
          date?: string;
          summary_text?: string | null;
          issues?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          route_id?: string;
          distributor_id?: string;
          date?: string;
          summary_text?: string | null;
          issues?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      report_photos: {
        Row: {
          id: string;
          report_id: string;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          storage_path: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          storage_path?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      my_team_id: { Args: Record<never, never>; Returns: string };
      is_admin: { Args: Record<never, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
