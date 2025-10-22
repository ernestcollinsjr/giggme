export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bands: {
        Row: {
          band_leader_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          band_leader_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          band_leader_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      gig_members: {
        Row: {
          created_at: string
          gig_id: string
          id: string
          location_sharing_enabled: boolean | null
          member_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gig_id: string
          id?: string
          location_sharing_enabled?: boolean | null
          member_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gig_id?: string
          id?: string
          location_sharing_enabled?: boolean | null
          member_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_members_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_templates: {
        Row: {
          attire: string | null
          created_at: string
          default_end_time: string | null
          default_loading_time: string | null
          default_sound_check_time: string | null
          default_start_time: string | null
          food_provided: string | null
          id: string
          name: string
          notes: string | null
          sound_man_info: string | null
          updated_at: string
          user_id: string
          venue: string
          venue_contact_person: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_name: string | null
        }
        Insert: {
          attire?: string | null
          created_at?: string
          default_end_time?: string | null
          default_loading_time?: string | null
          default_sound_check_time?: string | null
          default_start_time?: string | null
          food_provided?: string | null
          id?: string
          name: string
          notes?: string | null
          sound_man_info?: string | null
          updated_at?: string
          user_id: string
          venue: string
          venue_contact_person?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
        }
        Update: {
          attire?: string | null
          created_at?: string
          default_end_time?: string | null
          default_loading_time?: string | null
          default_sound_check_time?: string | null
          default_start_time?: string | null
          food_provided?: string | null
          id?: string
          name?: string
          notes?: string | null
          sound_man_info?: string | null
          updated_at?: string
          user_id?: string
          venue?: string
          venue_contact_person?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
        }
        Relationships: []
      }
      gigs: {
        Row: {
          attire: string | null
          band_id: string | null
          created_at: string | null
          date: string
          end_time: string | null
          food_provided: string | null
          id: string
          loading_time: string | null
          notes: string | null
          sound_check_time: string | null
          sound_man_info: string | null
          status: Database["public"]["Enums"]["gig_status"] | null
          updated_at: string | null
          user_id: string
          venue: string
          venue_contact_person: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_name: string | null
        }
        Insert: {
          attire?: string | null
          band_id?: string | null
          created_at?: string | null
          date: string
          end_time?: string | null
          food_provided?: string | null
          id?: string
          loading_time?: string | null
          notes?: string | null
          sound_check_time?: string | null
          sound_man_info?: string | null
          status?: Database["public"]["Enums"]["gig_status"] | null
          updated_at?: string | null
          user_id: string
          venue: string
          venue_contact_person?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
        }
        Update: {
          attire?: string | null
          band_id?: string | null
          created_at?: string | null
          date?: string
          end_time?: string | null
          food_provided?: string | null
          id?: string
          loading_time?: string | null
          notes?: string | null
          sound_check_time?: string | null
          sound_man_info?: string | null
          status?: Database["public"]["Enums"]["gig_status"] | null
          updated_at?: string | null
          user_id?: string
          venue?: string
          venue_contact_person?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gigs_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gigs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          email: string
          id: string
          instrument: Database["public"]["Enums"]["instrument_type"] | null
          location_lat: number | null
          location_lng: number | null
          name: string
          photo_urls: string[] | null
          rider_notes: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          email: string
          id: string
          instrument?: Database["public"]["Enums"]["instrument_type"] | null
          location_lat?: number | null
          location_lng?: number | null
          name: string
          photo_urls?: string[] | null
          rider_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          email?: string
          id?: string
          instrument?: Database["public"]["Enums"]["instrument_type"] | null
          location_lat?: number | null
          location_lng?: number | null
          name?: string
          photo_urls?: string[] | null
          rider_notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rehearsals: {
        Row: {
          attire: string | null
          band_id: string | null
          band_leader_id: string
          created_at: string
          date: string
          end_time: string | null
          food_provided: string | null
          id: string
          notes: string | null
          sound_man_info: string | null
          updated_at: string
          venue: string
          venue_contact_person: string | null
          venue_lat: number | null
          venue_lng: number | null
        }
        Insert: {
          attire?: string | null
          band_id?: string | null
          band_leader_id: string
          created_at?: string
          date: string
          end_time?: string | null
          food_provided?: string | null
          id?: string
          notes?: string | null
          sound_man_info?: string | null
          updated_at?: string
          venue: string
          venue_contact_person?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
        }
        Update: {
          attire?: string | null
          band_id?: string | null
          band_leader_id?: string
          created_at?: string
          date?: string
          end_time?: string | null
          food_provided?: string | null
          id?: string
          notes?: string | null
          sound_man_info?: string | null
          updated_at?: string
          venue?: string
          venue_contact_person?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rehearsals_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      setlist_songs: {
        Row: {
          artist: string | null
          audio_url: string | null
          created_at: string
          id: string
          lyrics: string | null
          order_index: number
          set_number: number
          setlist_id: string
          title: string
        }
        Insert: {
          artist?: string | null
          audio_url?: string | null
          created_at?: string
          id?: string
          lyrics?: string | null
          order_index?: number
          set_number?: number
          setlist_id: string
          title: string
        }
        Update: {
          artist?: string | null
          audio_url?: string | null
          created_at?: string
          id?: string
          lyrics?: string | null
          order_index?: number
          set_number?: number
          setlist_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlist_songs_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      setlists: {
        Row: {
          band_id: string | null
          band_leader_id: string
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          band_id?: string | null
          band_leader_id: string
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          band_id?: string | null
          band_leader_id?: string
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlists_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_member_locations: {
        Row: {
          earliest_time: string | null
          gig_date: string | null
          gig_id: string | null
          last_location_update: string | null
          location_lat: number | null
          location_lng: number | null
          member_id: string | null
          name: string | null
          venue: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_members_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_in_sharing_window: {
        Args: { earliest_time: string; gig_date: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "band_leader" | "band_member" | "booking_manager"
      gig_status: "pending" | "confirmed" | "completed" | "cancelled"
      instrument_type:
        | "guitar"
        | "bass"
        | "drums"
        | "vocals"
        | "keyboard"
        | "saxophone"
        | "trumpet"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["band_leader", "band_member", "booking_manager"],
      gig_status: ["pending", "confirmed", "completed", "cancelled"],
      instrument_type: [
        "guitar",
        "bass",
        "drums",
        "vocals",
        "keyboard",
        "saxophone",
        "trumpet",
        "other",
      ],
    },
  },
} as const
