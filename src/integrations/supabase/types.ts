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
      artist_profiles: {
        Row: {
          achievements: string[] | null
          availability: string | null
          created_at: string | null
          genre: string | null
          id: string
          rate_range: string | null
          social_links: Json | null
          stage_name: string | null
          updated_at: string | null
          user_id: string
          years_experience: number | null
          youtube_videos: Json | null
        }
        Insert: {
          achievements?: string[] | null
          availability?: string | null
          created_at?: string | null
          genre?: string | null
          id?: string
          rate_range?: string | null
          social_links?: Json | null
          stage_name?: string | null
          updated_at?: string | null
          user_id: string
          years_experience?: number | null
          youtube_videos?: Json | null
        }
        Update: {
          achievements?: string[] | null
          availability?: string | null
          created_at?: string | null
          genre?: string | null
          id?: string
          rate_range?: string | null
          social_links?: Json | null
          stage_name?: string | null
          updated_at?: string | null
          user_id?: string
          years_experience?: number | null
          youtube_videos?: Json | null
        }
        Relationships: []
      }
      artist_tips: {
        Row: {
          amount: number
          artist_id: string
          created_at: string
          id: string
          note: string | null
          payment_method: string
          tipper_name: string | null
        }
        Insert: {
          amount: number
          artist_id: string
          created_at?: string
          id?: string
          note?: string | null
          payment_method: string
          tipper_name?: string | null
        }
        Update: {
          amount?: number
          artist_id?: string
          created_at?: string
          id?: string
          note?: string | null
          payment_method?: string
          tipper_name?: string | null
        }
        Relationships: []
      }
      availability_requests: {
        Row: {
          band_id: string | null
          booking_manager_id: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          start_date: string
          status: string
          target_artist_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          band_id?: string | null
          booking_manager_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          start_date: string
          status?: string
          target_artist_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          band_id?: string | null
          booking_manager_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          target_artist_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_requests_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_responses: {
        Row: {
          available_dates: string[]
          id: string
          member_id: string
          notes: string | null
          request_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          available_dates?: string[]
          id?: string
          member_id: string
          notes?: string | null
          request_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          available_dates?: string[]
          id?: string
          member_id?: string
          notes?: string | null
          request_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "availability_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      band_invitations: {
        Row: {
          accepted_at: string | null
          band_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          recipient_name: string | null
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          band_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          recipient_name?: string | null
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          band_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          recipient_name?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_invitations_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_members: {
        Row: {
          band_id: string
          id: string
          joined_at: string
          member_id: string
        }
        Insert: {
          band_id: string
          id?: string
          joined_at?: string
          member_id: string
        }
        Update: {
          band_id?: string
          id?: string
          joined_at?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_members_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      bands: {
        Row: {
          band_leader_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          social_links: Json | null
          updated_at: string
          youtube_links: string[] | null
        }
        Insert: {
          band_leader_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          social_links?: Json | null
          updated_at?: string
          youtube_links?: string[] | null
        }
        Update: {
          band_leader_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          social_links?: Json | null
          updated_at?: string
          youtube_links?: string[] | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_at: string
          blocked_id: string
          blocker_id: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_id: string
          blocker_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_id?: string
          blocker_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      booking_manager_admins: {
        Row: {
          admin_user_id: string
          booking_manager_id: string
          created_at: string
        }
        Insert: {
          admin_user_id: string
          booking_manager_id: string
          created_at?: string
        }
        Update: {
          admin_user_id?: string
          booking_manager_id?: string
          created_at?: string
        }
        Relationships: []
      }
      booking_manager_artists: {
        Row: {
          artist_id: string
          booking_manager_id: string
          created_at: string
          group_name: string | null
          group_type: string | null
          id: string
          notes: string | null
        }
        Insert: {
          artist_id: string
          booking_manager_id: string
          created_at?: string
          group_name?: string | null
          group_type?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          artist_id?: string
          booking_manager_id?: string
          created_at?: string
          group_name?: string | null
          group_type?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      booking_manager_bands: {
        Row: {
          band_id: string
          booking_manager_id: string
          created_at: string
          id: string
        }
        Insert: {
          band_id: string
          booking_manager_id: string
          created_at?: string
          id?: string
        }
        Update: {
          band_id?: string
          booking_manager_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_manager_bands_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_manager_payments: {
        Row: {
          amount: number | null
          artist_id: string
          booking_manager_id: string
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          manager_notified_at: string | null
          notes: string | null
          paid_at: string | null
          recipient_email_at_send: string | null
          source: string
          source_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          artist_id: string
          booking_manager_id: string
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          manager_notified_at?: string | null
          notes?: string | null
          paid_at?: string | null
          recipient_email_at_send?: string | null
          source: string
          source_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          artist_id?: string
          booking_manager_id?: string
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          manager_notified_at?: string | null
          notes?: string | null
          paid_at?: string | null
          recipient_email_at_send?: string | null
          source?: string
          source_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_requests: {
        Row: {
          auto_reminders_disabled: boolean
          booker_email: string | null
          booker_id: string
          booker_name: string | null
          budget: string | null
          contact_person: string | null
          created_at: string
          dates_text: string
          dress_code: string | null
          event_date: string | null
          expired_notified_at: string | null
          expires_at: string
          id: string
          note: string | null
          performer_email: string | null
          performer_id: string
          performer_name: string | null
          reminder_1d_sent_at: string | null
          reminder_24h_sent_at: string | null
          reminder_2h_sent_at: string | null
          reminder_30m_sent_at: string | null
          reminder_3h_sent_at: string | null
          responded_at: string | null
          response_token: string
          status: Database["public"]["Enums"]["booking_request_status"]
          time_text: string | null
          updated_at: string
          venue: string
          venue_phone: string | null
        }
        Insert: {
          auto_reminders_disabled?: boolean
          booker_email?: string | null
          booker_id: string
          booker_name?: string | null
          budget?: string | null
          contact_person?: string | null
          created_at?: string
          dates_text: string
          dress_code?: string | null
          event_date?: string | null
          expired_notified_at?: string | null
          expires_at?: string
          id?: string
          note?: string | null
          performer_email?: string | null
          performer_id: string
          performer_name?: string | null
          reminder_1d_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          reminder_30m_sent_at?: string | null
          reminder_3h_sent_at?: string | null
          responded_at?: string | null
          response_token?: string
          status?: Database["public"]["Enums"]["booking_request_status"]
          time_text?: string | null
          updated_at?: string
          venue: string
          venue_phone?: string | null
        }
        Update: {
          auto_reminders_disabled?: boolean
          booker_email?: string | null
          booker_id?: string
          booker_name?: string | null
          budget?: string | null
          contact_person?: string | null
          created_at?: string
          dates_text?: string
          dress_code?: string | null
          event_date?: string | null
          expired_notified_at?: string | null
          expires_at?: string
          id?: string
          note?: string | null
          performer_email?: string | null
          performer_id?: string
          performer_name?: string | null
          reminder_1d_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          reminder_30m_sent_at?: string | null
          reminder_3h_sent_at?: string | null
          responded_at?: string | null
          response_token?: string
          status?: Database["public"]["Enums"]["booking_request_status"]
          time_text?: string | null
          updated_at?: string
          venue?: string
          venue_phone?: string | null
        }
        Relationships: []
      }
      email_tracking: {
        Row: {
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          email: string
          gig_id: string | null
          id: string
          member_id: string
          opened_at: string | null
          resend_email_id: string | null
          sent_at: string
          status: string
          updated_at: string
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email: string
          gig_id?: string | null
          id?: string
          member_id: string
          opened_at?: string | null
          resend_email_id?: string | null
          sent_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string
          gig_id?: string | null
          id?: string
          member_id?: string
          opened_at?: string | null
          resend_email_id?: string | null
          sent_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      entertainer_subscribers: {
        Row: {
          created_at: string
          current_period_end: string | null
          status: string
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entertainment_bookings: {
        Row: {
          callout_reason: string | null
          confirmation_sent_at: string | null
          created_at: string
          date: string
          end_time: string | null
          entertainer_id: string
          entertainer_notes: string | null
          id: string
          is_recurring: boolean | null
          notes: string | null
          original_entertainer_id: string | null
          payment_amount: number | null
          payment_status: string | null
          recurring_schedule_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          venue_id: string
          venue_notes: string | null
        }
        Insert: {
          callout_reason?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          date: string
          end_time?: string | null
          entertainer_id: string
          entertainer_notes?: string | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          original_entertainer_id?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          recurring_schedule_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_id: string
          venue_notes?: string | null
        }
        Update: {
          callout_reason?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          date?: string
          end_time?: string | null
          entertainer_id?: string
          entertainer_notes?: string | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          original_entertainer_id?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          recurring_schedule_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_id?: string
          venue_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entertainment_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_members: {
        Row: {
          created_at: string
          gig_id: string
          id: string
          location_sharing_enabled: boolean | null
          member_id: string
          reminder_1d_sent_at: string | null
          reminder_2h_sent_at: string | null
          replaced_by: string | null
          replacement_reason: string | null
          replacement_triggered: boolean | null
          response_deadline: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gig_id: string
          id?: string
          location_sharing_enabled?: boolean | null
          member_id: string
          reminder_1d_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          replaced_by?: string | null
          replacement_reason?: string | null
          replacement_triggered?: boolean | null
          response_deadline?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gig_id?: string
          id?: string
          location_sharing_enabled?: boolean | null
          member_id?: string
          reminder_1d_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          replaced_by?: string | null
          replacement_reason?: string | null
          replacement_triggered?: boolean | null
          response_deadline?: string | null
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
          {
            foreignKeyName: "gig_members_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      gig_travel_status: {
        Row: {
          arrived_at: string | null
          created_at: string
          gig_id: string
          id: string
          source: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arrived_at?: string | null
          created_at?: string
          gig_id: string
          id?: string
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arrived_at?: string | null
          created_at?: string
          gig_id?: string
          id?: string
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gigs: {
        Row: {
          attire: string | null
          auto_reminders_disabled: boolean
          band_id: string | null
          created_at: string | null
          date: string
          end_time: string | null
          food_provided: string | null
          id: string
          loading_time: string | null
          notes: string | null
          payment_amount: number | null
          payment_status: string | null
          reminder_24h_sent_at: string | null
          reminder_30m_sent_at: string | null
          reminder_3h_sent_at: string | null
          response_deadline_hours: number | null
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
          auto_reminders_disabled?: boolean
          band_id?: string | null
          created_at?: string | null
          date: string
          end_time?: string | null
          food_provided?: string | null
          id?: string
          loading_time?: string | null
          notes?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          reminder_24h_sent_at?: string | null
          reminder_30m_sent_at?: string | null
          reminder_3h_sent_at?: string | null
          response_deadline_hours?: number | null
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
          auto_reminders_disabled?: boolean
          band_id?: string | null
          created_at?: string | null
          date?: string
          end_time?: string | null
          food_provided?: string | null
          id?: string
          loading_time?: string | null
          notes?: string | null
          payment_amount?: number | null
          payment_status?: string | null
          reminder_24h_sent_at?: string | null
          reminder_30m_sent_at?: string | null
          reminder_3h_sent_at?: string | null
          response_deadline_hours?: number | null
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
      member_availability: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_groups: {
        Row: {
          band_id: string
          created_at: string
          created_by: string
          id: string
          member_ids: string[]
          name: string
          updated_at: string
        }
        Insert: {
          band_id: string
          created_at?: string
          created_by: string
          id?: string
          member_ids?: string[]
          name: string
          updated_at?: string
        }
        Update: {
          band_id?: string
          created_at?: string
          created_by?: string
          id?: string
          member_ids?: string[]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_groups_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          delivered_to: string[] | null
          id: string
          is_group_message: boolean | null
          read_by: string[] | null
          recipient_id: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          delivered_to?: string[] | null
          id?: string
          is_group_message?: boolean | null
          read_by?: string[] | null
          recipient_id?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          delivered_to?: string[] | null
          id?: string
          is_group_message?: boolean | null
          read_by?: string[] | null
          recipient_id?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          delivered_sound_type: string | null
          email_enabled: boolean | null
          id: string
          push_enabled: boolean | null
          reminder_1_day: boolean | null
          reminder_1_week: boolean | null
          reminder_day_of: boolean | null
          sent_sound_type: string | null
          sms_enabled: boolean | null
          sound_muted: boolean | null
          sound_type: string | null
          sound_volume: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_sound_type?: string | null
          email_enabled?: boolean | null
          id?: string
          push_enabled?: boolean | null
          reminder_1_day?: boolean | null
          reminder_1_week?: boolean | null
          reminder_day_of?: boolean | null
          sent_sound_type?: string | null
          sms_enabled?: boolean | null
          sound_muted?: boolean | null
          sound_type?: string | null
          sound_volume?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_sound_type?: string | null
          email_enabled?: boolean | null
          id?: string
          push_enabled?: boolean | null
          reminder_1_day?: boolean | null
          reminder_1_week?: boolean | null
          reminder_day_of?: boolean | null
          sent_sound_type?: string | null
          sms_enabled?: boolean | null
          sound_muted?: boolean | null
          sound_type?: string | null
          sound_volume?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      performer_ratings: {
        Row: {
          artist_id: string
          booking_id: string | null
          comment: string | null
          created_at: string
          customer_name: string | null
          id: string
          rating: number
          venue_id: string | null
          venue_name: string | null
        }
        Insert: {
          artist_id: string
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          rating: number
          venue_id?: string | null
          venue_name?: string | null
        }
        Update: {
          artist_id?: string
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          rating?: number
          venue_id?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performer_ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "entertainment_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performer_ratings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_messages: {
        Row: {
          conversation_user_id: string
          id: string
          message_id: string
          pinned_at: string
          pinned_by: string
        }
        Insert: {
          conversation_user_id: string
          id?: string
          message_id: string
          pinned_at?: string
          pinned_by: string
        }
        Update: {
          conversation_user_id?: string
          id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability_status: string | null
          band_name: string | null
          bio: string | null
          created_at: string | null
          email: string
          entertainer_categories: string[]
          equipment: string[] | null
          genres: string[] | null
          id: string
          instrument: Database["public"]["Enums"]["instrument_type"] | null
          location_lat: number | null
          location_lng: number | null
          name: string
          performer_category: string | null
          phone_number: string | null
          photo_urls: string[] | null
          preferred_pay: number | null
          preferred_pay_hours: number | null
          rider_notes: string | null
          skills: string[] | null
          social_links: Json | null
          timezone: string | null
          travel_distance: number | null
          union_memberships: string[] | null
          updated_at: string | null
          years_experience: number | null
          youtube_links: string[] | null
        }
        Insert: {
          availability_status?: string | null
          band_name?: string | null
          bio?: string | null
          created_at?: string | null
          email: string
          entertainer_categories?: string[]
          equipment?: string[] | null
          genres?: string[] | null
          id: string
          instrument?: Database["public"]["Enums"]["instrument_type"] | null
          location_lat?: number | null
          location_lng?: number | null
          name: string
          performer_category?: string | null
          phone_number?: string | null
          photo_urls?: string[] | null
          preferred_pay?: number | null
          preferred_pay_hours?: number | null
          rider_notes?: string | null
          skills?: string[] | null
          social_links?: Json | null
          timezone?: string | null
          travel_distance?: number | null
          union_memberships?: string[] | null
          updated_at?: string | null
          years_experience?: number | null
          youtube_links?: string[] | null
        }
        Update: {
          availability_status?: string | null
          band_name?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string
          entertainer_categories?: string[]
          equipment?: string[] | null
          genres?: string[] | null
          id?: string
          instrument?: Database["public"]["Enums"]["instrument_type"] | null
          location_lat?: number | null
          location_lng?: number | null
          name?: string
          performer_category?: string | null
          phone_number?: string | null
          photo_urls?: string[] | null
          preferred_pay?: number | null
          preferred_pay_hours?: number | null
          rider_notes?: string | null
          skills?: string[] | null
          social_links?: Json | null
          timezone?: string | null
          travel_distance?: number | null
          union_memberships?: string[] | null
          updated_at?: string | null
          years_experience?: number | null
          youtube_links?: string[] | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          device_info: Json | null
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string | null
          entertainer_id: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_amount: number | null
          start_time: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string | null
          entertainer_id: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_amount?: number | null
          start_time: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          entertainer_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_amount?: number | null
          start_time?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
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
          gig_id: string | null
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
          gig_id?: string | null
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
          gig_id?: string | null
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
          {
            foreignKeyName: "rehearsals_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_request_recipients: {
        Row: {
          created_at: string
          id: string
          notified_at: string | null
          performer_email: string | null
          performer_id: string
          performer_name: string | null
          request_id: string
          responded_at: string | null
          response_token: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified_at?: string | null
          performer_email?: string | null
          performer_id: string
          performer_name?: string | null
          request_id: string
          responded_at?: string | null
          response_token: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          notified_at?: string | null
          performer_email?: string | null
          performer_id?: string
          performer_name?: string | null
          request_id?: string
          responded_at?: string | null
          response_token?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_request_recipients_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "replacement_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_requests: {
        Row: {
          created_at: string
          deadline_at: string
          event_date: string | null
          event_time: string | null
          filled_by: string | null
          id: string
          message: string
          requester_email: string | null
          requester_id: string
          requester_name: string | null
          status: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          deadline_at: string
          event_date?: string | null
          event_time?: string | null
          filled_by?: string | null
          id?: string
          message: string
          requester_email?: string | null
          requester_id: string
          requester_name?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          deadline_at?: string
          event_date?: string | null
          event_time?: string | null
          filled_by?: string | null
          id?: string
          message?: string
          requester_email?: string | null
          requester_id?: string
          requester_name?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      scheduled_reminders: {
        Row: {
          created_at: string
          custom_datetime: string | null
          event_date: string
          event_id: string | null
          event_name: string
          event_type: string
          id: string
          is_relative: boolean
          message: string | null
          reminder_times: string[]
          status: string
          target_groups: string[]
          target_member_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_datetime?: string | null
          event_date: string
          event_id?: string | null
          event_name: string
          event_type: string
          id?: string
          is_relative?: boolean
          message?: string | null
          reminder_times?: string[]
          status?: string
          target_groups?: string[]
          target_member_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_datetime?: string | null
          event_date?: string
          event_id?: string | null
          event_name?: string
          event_type?: string
          id?: string
          is_relative?: boolean
          message?: string | null
          reminder_times?: string[]
          status?: string
          target_groups?: string[]
          target_member_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          address: string | null
          band_id: string | null
          band_leader_id: string
          call_time: string | null
          created_at: string
          description: string | null
          event_date: string | null
          event_time: string | null
          id: string
          music_leader_id: string | null
          notes: string | null
          rehearsal_call_time: string | null
          rehearsal_date: string | null
          rehearsal_time: string | null
          title: string
          updated_at: string
          venue_lat: number | null
          venue_lng: number | null
        }
        Insert: {
          address?: string | null
          band_id?: string | null
          band_leader_id: string
          call_time?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_time?: string | null
          id?: string
          music_leader_id?: string | null
          notes?: string | null
          rehearsal_call_time?: string | null
          rehearsal_date?: string | null
          rehearsal_time?: string | null
          title: string
          updated_at?: string
          venue_lat?: number | null
          venue_lng?: number | null
        }
        Update: {
          address?: string | null
          band_id?: string | null
          band_leader_id?: string
          call_time?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_time?: string | null
          id?: string
          music_leader_id?: string | null
          notes?: string | null
          rehearsal_call_time?: string | null
          rehearsal_date?: string | null
          rehearsal_time?: string | null
          title?: string
          updated_at?: string
          venue_lat?: number | null
          venue_lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "setlists_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setlists_music_leader_id_fkey"
            columns: ["music_leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_setlists: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          setlist_id: string
          share_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          setlist_id: string
          share_token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          setlist_id?: string
          share_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_setlists_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_crew_members: {
        Row: {
          created_at: string
          crew_member_id: string
          crew_type: Database["public"]["Enums"]["crew_type"]
          flight_confirmation: string | null
          hotel_address: string | null
          hotel_check_in_time: string | null
          hotel_name: string | null
          hotel_room_number: string | null
          id: string
          nearby_services: string | null
          per_diem_info: string | null
          role_title: string | null
          status: string
          ticket_purchase_responsibility: string | null
          tour_id: string
          updated_at: string
          venue_amenities: string | null
        }
        Insert: {
          created_at?: string
          crew_member_id: string
          crew_type?: Database["public"]["Enums"]["crew_type"]
          flight_confirmation?: string | null
          hotel_address?: string | null
          hotel_check_in_time?: string | null
          hotel_name?: string | null
          hotel_room_number?: string | null
          id?: string
          nearby_services?: string | null
          per_diem_info?: string | null
          role_title?: string | null
          status?: string
          ticket_purchase_responsibility?: string | null
          tour_id: string
          updated_at?: string
          venue_amenities?: string | null
        }
        Update: {
          created_at?: string
          crew_member_id?: string
          crew_type?: Database["public"]["Enums"]["crew_type"]
          flight_confirmation?: string | null
          hotel_address?: string | null
          hotel_check_in_time?: string | null
          hotel_name?: string | null
          hotel_room_number?: string | null
          id?: string
          nearby_services?: string | null
          per_diem_info?: string | null
          role_title?: string | null
          status?: string
          ticket_purchase_responsibility?: string | null
          tour_id?: string
          updated_at?: string
          venue_amenities?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_crew_members_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_crew_members_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_dates: {
        Row: {
          attire: string | null
          bus_call_time: string | null
          created_at: string
          date: string
          end_time: string | null
          food_provided: string | null
          general_notes: string | null
          ground_transportation: string | null
          hotel_address: string | null
          hotel_check_in_time: string | null
          hotel_check_out_date: string | null
          hotel_check_out_time: string | null
          hotel_name: string | null
          hotel_notes: string | null
          id: string
          loading_time: string | null
          lobby_time: string | null
          notes: string | null
          payment_amount: number | null
          per_diem: number | null
          show_time: string | null
          sound_check_time: string | null
          sound_man_info: string | null
          tour_id: string
          transportation_not_provided: boolean | null
          updated_at: string
          venue: string
          venue_contact_person: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_name: string | null
        }
        Insert: {
          attire?: string | null
          bus_call_time?: string | null
          created_at?: string
          date: string
          end_time?: string | null
          food_provided?: string | null
          general_notes?: string | null
          ground_transportation?: string | null
          hotel_address?: string | null
          hotel_check_in_time?: string | null
          hotel_check_out_date?: string | null
          hotel_check_out_time?: string | null
          hotel_name?: string | null
          hotel_notes?: string | null
          id?: string
          loading_time?: string | null
          lobby_time?: string | null
          notes?: string | null
          payment_amount?: number | null
          per_diem?: number | null
          show_time?: string | null
          sound_check_time?: string | null
          sound_man_info?: string | null
          tour_id: string
          transportation_not_provided?: boolean | null
          updated_at?: string
          venue: string
          venue_contact_person?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
        }
        Update: {
          attire?: string | null
          bus_call_time?: string | null
          created_at?: string
          date?: string
          end_time?: string | null
          food_provided?: string | null
          general_notes?: string | null
          ground_transportation?: string | null
          hotel_address?: string | null
          hotel_check_in_time?: string | null
          hotel_check_out_date?: string | null
          hotel_check_out_time?: string | null
          hotel_name?: string | null
          hotel_notes?: string | null
          id?: string
          loading_time?: string | null
          lobby_time?: string | null
          notes?: string | null
          payment_amount?: number | null
          per_diem?: number | null
          show_time?: string | null
          sound_check_time?: string | null
          sound_man_info?: string | null
          tour_id?: string
          transportation_not_provided?: boolean | null
          updated_at?: string
          venue?: string
          venue_contact_person?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_dates_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_invitations: {
        Row: {
          created_at: string
          crew_type: Database["public"]["Enums"]["crew_type"]
          email: string
          expires_at: string
          id: string
          invite_token: string
          status: string
          tour_id: string
          tour_manager_id: string
        }
        Insert: {
          created_at?: string
          crew_type?: Database["public"]["Enums"]["crew_type"]
          email: string
          expires_at?: string
          id?: string
          invite_token: string
          status?: string
          tour_id: string
          tour_manager_id: string
        }
        Update: {
          created_at?: string
          crew_type?: Database["public"]["Enums"]["crew_type"]
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          status?: string
          tour_id?: string
          tour_manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_invitations_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          tour_manager_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          tour_manager_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          tour_manager_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
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
      venue_preferred_entertainers: {
        Row: {
          added_at: string
          entertainer_id: string
          id: string
          notes: string | null
          priority: number | null
          venue_id: string
        }
        Insert: {
          added_at?: string
          entertainer_id: string
          id?: string
          notes?: string | null
          priority?: number | null
          venue_id: string
        }
        Update: {
          added_at?: string
          entertainer_id?: string
          id?: string
          notes?: string | null
          priority?: number | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_preferred_entertainers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          capacity: number | null
          city: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          state: string | null
          updated_at: string
          venue_type: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          venue_type?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          venue_type?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_featured_entertainers: {
        Args: never
        Returns: {
          bio: string
          entertainer_categories: string[]
          genre: string
          instrument: string
          name: string
          performer_category: string
          photo_urls: string[]
          stage_name: string
          user_id: string
        }[]
      }
      get_performer_venues: {
        Args: never
        Returns: {
          user_id: string
          venues: string[]
        }[]
      }
      get_public_performers: {
        Args: never
        Returns: {
          availability: string
          bio: string
          genre: string
          genres: string[]
          instrument: string
          name: string
          performer_category: string
          photo_urls: string[]
          preferred_pay: number
          preferred_pay_hours: number
          rate_range: string
          stage_name: string
          user_id: string
          years_experience: number
          youtube_videos: Json
        }[]
      }
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
      is_admin_for: {
        Args: { _admin_id: string; _booking_manager_id: string }
        Returns: boolean
      }
      is_assigned_to_tour: {
        Args: { _tour_id: string; _user_id: string }
        Returns: boolean
      }
      is_band_leader: {
        Args: { _band_id: string; _user_id: string }
        Returns: boolean
      }
      is_band_member: {
        Args: { _band_id: string; _user_id: string }
        Returns: boolean
      }
      is_entertainer_subscribed: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_gig_member: {
        Args: { _gig_id: string; _user_id: string }
        Returns: boolean
      }
      is_gig_owner: {
        Args: { _gig_id: string; _user_id: string }
        Returns: boolean
      }
      is_in_sharing_window: {
        Args: { earliest_time: string; gig_date: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tour_manager: {
        Args: { _tour_id: string; _user_id: string }
        Returns: boolean
      }
      mark_calendar_unavailable: {
        Args: { _date: string; _note: string; _user_id: string }
        Returns: undefined
      }
      mark_message_as_delivered: {
        Args: { message_id: string; user_id: string }
        Returns: undefined
      }
      mark_message_as_read: {
        Args: { message_id: string; user_id: string }
        Returns: undefined
      }
      send_gig_reminders: { Args: never; Returns: undefined }
      send_rehearsal_reminders: { Args: never; Returns: undefined }
      users_share_band: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "band_leader"
        | "band_member"
        | "booking_manager"
        | "artist"
        | "tour_manager"
        | "venue_owner"
        | "super_admin"
        | "admin"
        | "entertainer"
        | "member"
      booking_request_status: "pending" | "accepted" | "declined" | "expired"
      booking_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "cancelled"
        | "callout"
        | "completed"
      crew_type: "band_members" | "singer" | "sound_crew" | "lighting_crew"
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
      app_role: [
        "band_leader",
        "band_member",
        "booking_manager",
        "artist",
        "tour_manager",
        "venue_owner",
        "super_admin",
        "admin",
        "entertainer",
        "member",
      ],
      booking_request_status: ["pending", "accepted", "declined", "expired"],
      booking_status: [
        "pending",
        "confirmed",
        "declined",
        "cancelled",
        "callout",
        "completed",
      ],
      crew_type: ["band_members", "singer", "sound_crew", "lighting_crew"],
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
