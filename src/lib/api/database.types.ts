export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          reason: string
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          reason: string
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          target_id?: string | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string
          paid_at: string | null
          provider: string
          provider_checkout_id: string | null
          provider_payment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          paid_at?: string | null
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      design_deliverables: {
        Row: {
          approved: boolean
          approved_at: string | null
          created_at: string
          customer_feedback: string | null
          file_name: string
          id: string
          mime_type: string | null
          order_id: string
          revision_number: number
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          created_at?: string
          customer_feedback?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          order_id: string
          revision_number: number
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          created_at?: string
          customer_feedback?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          order_id?: string
          revision_number?: number
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_deliverables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "design_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_deliverables_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      design_opportunities: {
        Row: {
          answer: string | null
          created_at: string
          designer_id: string
          id: string
          question: string | null
          request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          designer_id: string
          id?: string
          question?: string | null
          request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          designer_id?: string
          id?: string
          question?: string | null
          request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_opportunities_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_admin_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_opportunities_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_opportunities_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_opportunities_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "design_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      design_order_status_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_order_status_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "design_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      design_orders: {
        Row: {
          created_at: string
          customer_id: string
          delivered_at: string | null
          designer_id: string
          id: string
          proposal_id: string
          request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          designer_id: string
          id?: string
          proposal_id: string
          request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          designer_id?: string
          id?: string
          proposal_id?: string
          request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_orders_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_admin_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_orders_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_orders_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "design_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_orders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "design_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      design_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string
          paid_at: string | null
          provider: string
          provider_checkout_id: string | null
          provider_payment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          paid_at?: string | null
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "design_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      design_proposals: {
        Row: {
          created_at: string
          designer_id: string
          down_payment_pct: number | null
          id: string
          note: string | null
          price: number | null
          request_id: string
          revision_rounds_included: number
          status: string
          submitted_at: string | null
          turnaround_days: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          designer_id: string
          down_payment_pct?: number | null
          id?: string
          note?: string | null
          price?: number | null
          request_id: string
          revision_rounds_included?: number
          status?: string
          submitted_at?: string | null
          turnaround_days?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          designer_id?: string
          down_payment_pct?: number | null
          id?: string
          note?: string | null
          price?: number | null
          request_id?: string
          revision_rounds_included?: number
          status?: string
          submitted_at?: string | null
          turnaround_days?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "design_proposals_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_admin_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_proposals_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_proposals_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_proposals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "design_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      design_request_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          request_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          request_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          request_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_request_files_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "design_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_request_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      design_requests: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          notes: string | null
          selected_proposal_id: string | null
          specialty: string
          status: string
          submitted_at: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          notes?: string | null
          selected_proposal_id?: string | null
          specialty: string
          status?: string
          submitted_at?: string | null
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          notes?: string | null
          selected_proposal_id?: string | null
          specialty?: string
          status?: string
          submitted_at?: string | null
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_requests_selected_proposal_fk"
            columns: ["selected_proposal_id"]
            isOneToOne: false
            referencedRelation: "design_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_requests_specialty_fkey"
            columns: ["specialty"]
            isOneToOne: false
            referencedRelation: "design_specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      design_reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          designer_id: string
          hidden: boolean
          hidden_reason: string | null
          id: string
          order_id: string
          rating: number
          request_id: string
          would_work_again: boolean
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          designer_id: string
          hidden?: boolean
          hidden_reason?: string | null
          id?: string
          order_id: string
          rating: number
          request_id: string
          would_work_again: boolean
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          designer_id?: string
          hidden?: boolean
          hidden_reason?: string | null
          id?: string
          order_id?: string
          rating?: number
          request_id?: string
          would_work_again?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "design_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_reviews_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_admin_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_reviews_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_reviews_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "design_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "design_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      design_specialties: {
        Row: {
          id: string
          name: string
          sort_order: number
          tagline: string
        }
        Insert: {
          id: string
          name: string
          sort_order?: number
          tagline: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          tagline?: string
        }
        Relationships: []
      }
      designer_portfolio_items: {
        Row: {
          caption: string | null
          created_at: string
          designer_id: string
          file_name: string
          height_px: number | null
          id: string
          mime_type: string | null
          storage_path: string
          width_px: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          designer_id: string
          file_name: string
          height_px?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          width_px?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          designer_id?: string
          file_name?: string
          height_px?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "designer_portfolio_items_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_admin_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designer_portfolio_items_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designer_portfolio_items_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      designer_profiles: {
        Row: {
          application_note: string | null
          avatar_url: string | null
          bio: string | null
          city: string
          created_at: string
          display_name: string
          id: string
          rate_max: number | null
          rate_min: number | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          typical_turnaround_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_note?: string | null
          avatar_url?: string | null
          bio?: string | null
          city: string
          created_at?: string
          display_name: string
          id?: string
          rate_max?: number | null
          rate_min?: number | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          typical_turnaround_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_note?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string
          created_at?: string
          display_name?: string
          id?: string
          rate_max?: number | null
          rate_min?: number | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          typical_turnaround_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "designer_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      designer_specialties: {
        Row: {
          created_at: string
          designer_id: string
          id: string
          specialty: string
        }
        Insert: {
          created_at?: string
          designer_id: string
          id?: string
          specialty: string
        }
        Update: {
          created_at?: string
          designer_id?: string
          id?: string
          specialty?: string
        }
        Relationships: [
          {
            foreignKeyName: "designer_specialties_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_admin_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designer_specialties_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designer_specialties_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designer_specialties_specialty_fkey"
            columns: ["specialty"]
            isOneToOne: false
            referencedRelation: "design_specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          created_at: string
          id: string
          kind: string
          last_error: string | null
          payload: Json
          read_at: string | null
          recipient_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          kind: string
          last_error?: string | null
          payload?: Json
          read_at?: string | null
          recipient_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          payload?: Json
          read_at?: string | null
          recipient_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          partner_id: string
          project_id: string
          question: string | null
          status: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          partner_id: string
          project_id: string
          question?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          partner_id?: string
          project_id?: string
          question?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          delivered_at: string | null
          id: string
          partner_id: string
          project_id: string
          quote_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          id?: string
          partner_id: string
          project_id: string
          quote_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          id?: string
          partner_id?: string
          project_id?: string
          quote_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_capabilities: {
        Row: {
          category: string
          created_at: string
          id: string
          partner_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          partner_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_capabilities_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "print_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_capabilities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_capabilities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_profiles: {
        Row: {
          business_name: string
          city: string
          contact_name: string
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          portfolio_images: string[]
          service_areas: string[]
          services: string[]
          status: string
          typical_turnaround_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name: string
          city: string
          contact_name: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          portfolio_images?: string[]
          service_areas?: string[]
          services?: string[]
          status?: string
          typical_turnaround_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string
          city?: string
          contact_name?: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          portfolio_images?: string[]
          service_areas?: string[]
          services?: string[]
          status?: string
          typical_turnaround_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      print_categories: {
        Row: {
          id: string
          name: string
          sort_order: number
          tagline: string
        }
        Insert: {
          id: string
          name: string
          sort_order?: number
          tagline: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          tagline?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          mobile: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          mobile?: string | null
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          mobile?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          project_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          project_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category: string
          created_at: string
          customer_id: string
          delivery_city: string | null
          description: string | null
          finishing_pref: string | null
          id: string
          material_pref: string | null
          notes: string | null
          quantity: number | null
          quantity_note: string | null
          selected_quote_id: string | null
          size_spec: string | null
          status: string
          submitted_at: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          customer_id: string
          delivery_city?: string | null
          description?: string | null
          finishing_pref?: string | null
          id?: string
          material_pref?: string | null
          notes?: string | null
          quantity?: number | null
          quantity_note?: string | null
          selected_quote_id?: string | null
          size_spec?: string | null
          status?: string
          submitted_at?: string | null
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          customer_id?: string
          delivery_city?: string | null
          description?: string | null
          finishing_pref?: string | null
          id?: string
          material_pref?: string | null
          notes?: string | null
          quantity?: number | null
          quantity_note?: string | null
          selected_quote_id?: string | null
          size_spec?: string | null
          status?: string
          submitted_at?: string | null
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "print_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_selected_quote_fk"
            columns: ["selected_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          delivery_available: boolean
          down_payment_pct: number | null
          estimated_completion: string | null
          id: string
          note: string | null
          partner_id: string
          project_id: string
          status: string
          submitted_at: string | null
          total_price: number | null
          turnaround_days: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          delivery_available?: boolean
          down_payment_pct?: number | null
          estimated_completion?: string | null
          id?: string
          note?: string | null
          partner_id: string
          project_id: string
          status?: string
          submitted_at?: string | null
          total_price?: number | null
          turnaround_days?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          delivery_available?: boolean
          down_payment_pct?: number | null
          estimated_completion?: string | null
          id?: string
          note?: string | null
          partner_id?: string
          project_id?: string
          status?: string
          submitted_at?: string | null
          total_price?: number | null
          turnaround_days?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          hidden: boolean
          hidden_reason: string | null
          id: string
          order_id: string
          partner_id: string
          project_id: string
          rating: number
          would_work_again: boolean
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          hidden?: boolean
          hidden_reason?: string | null
          id?: string
          order_id: string
          partner_id: string
          project_id: string
          rating: number
          would_work_again: boolean
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          hidden?: boolean
          hidden_reason?: string | null
          id?: string
          order_id?: string
          partner_id?: string
          project_id?: string
          rating?: number
          would_work_again?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      designer_admin_review_queue: {
        Row: {
          application_note: string | null
          applied_at: string | null
          bio: string | null
          city: string | null
          display_name: string | null
          flag_bad_format: boolean | null
          flag_low_resolution: boolean | null
          flag_low_sample_count: boolean | null
          id: string | null
          portfolio_count: number | null
          specialties: string[] | null
        }
        Relationships: []
      }
      designer_directory: {
        Row: {
          avatar_url: string | null
          average_rating: number | null
          bio: string | null
          city: string | null
          completed_orders: number | null
          created_at: string | null
          display_name: string | null
          id: string | null
          portfolio_count: number | null
          rate_max: number | null
          rate_min: number | null
          review_count: number | null
          specialties: string[] | null
          typical_turnaround_days: number | null
        }
        Relationships: []
      }
      partner_directory: {
        Row: {
          average_rating: number | null
          business_name: string | null
          categories: string[] | null
          city: string | null
          completed_projects: number | null
          created_at: string | null
          description: string | null
          id: string | null
          logo_url: string | null
          portfolio_images: string[] | null
          review_count: number | null
          service_areas: string[] | null
          services: string[] | null
          typical_turnaround_days: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_moderate_design_review: {
        Args: { p_hidden: boolean; p_reason: string; p_review_id: string }
        Returns: undefined
      }
      admin_moderate_review: {
        Args: { p_hidden: boolean; p_reason: string; p_review_id: string }
        Returns: undefined
      }
      admin_review_designer: {
        Args: { p_decision: string; p_designer_id: string; p_reason: string }
        Returns: undefined
      }
      admin_set_account_status: {
        Args: { p_reason: string; p_status: string; p_user_id: string }
        Returns: undefined
      }
      assert_active: { Args: never; Returns: undefined }
      booking_fee_pct: { Args: never; Returns: number }
      can_propose_on: { Args: { p_request_id: string }; Returns: boolean }
      can_quote_on: { Args: { p_project_id: string }; Returns: boolean }
      can_read_design_order: { Args: { p_order_id: string }; Returns: boolean }
      can_read_order: { Args: { p_order_id: string }; Returns: boolean }
      cancel_design_request: {
        Args: { p_request_id: string }
        Returns: {
          budget_max: number | null
          budget_min: number | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          notes: string | null
          selected_proposal_id: string | null
          specialty: string
          status: string
          submitted_at: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "design_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_project: {
        Args: { p_project_id: string }
        Returns: {
          category: string
          created_at: string
          customer_id: string
          delivery_city: string | null
          description: string | null
          finishing_pref: string | null
          id: string
          material_pref: string | null
          notes: string | null
          quantity: number | null
          quantity_note: string | null
          selected_quote_id: string | null
          size_spec: string | null
          status: string
          submitted_at: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_design_review: {
        Args: {
          p_comment?: string
          p_order_id: string
          p_rating: number
          p_would_work_again?: boolean
        }
        Returns: {
          comment: string | null
          created_at: string
          customer_id: string
          designer_id: string
          hidden: boolean
          hidden_reason: string | null
          id: string
          order_id: string
          rating: number
          request_id: string
          would_work_again: boolean
        }
        SetofOptions: {
          from: "*"
          to: "design_reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_review: {
        Args: {
          p_comment?: string
          p_order_id: string
          p_rating: number
          p_would_work_again?: boolean
        }
        Returns: {
          comment: string | null
          created_at: string
          customer_id: string
          hidden: boolean
          hidden_reason: string | null
          id: string
          order_id: string
          partner_id: string
          project_id: string
          rating: number
          would_work_again: boolean
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      design_order_stage_rank: { Args: { p_status: string }; Returns: number }
      designer_has_opportunity: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      designer_has_order: { Args: { p_request_id: string }; Returns: boolean }
      dispatch_notifications: { Args: never; Returns: undefined }
      email_exists: { Args: { p_email: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      my_designer_id: { Args: never; Returns: string }
      my_partner_id: { Args: never; Returns: string }
      my_role: { Args: never; Returns: string }
      order_stage_rank: { Args: { p_status: string }; Returns: number }
      owns_design_request: { Args: { p_request_id: string }; Returns: boolean }
      owns_editable_design_request: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      owns_editable_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      owns_project: { Args: { p_project_id: string }; Returns: boolean }
      partner_has_opportunity: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      partner_has_order: { Args: { p_project_id: string }; Returns: boolean }
      review_design_deliverable: {
        Args: {
          p_approved: boolean
          p_deliverable_id: string
          p_feedback?: string
        }
        Returns: {
          approved: boolean
          approved_at: string | null
          created_at: string
          customer_feedback: string | null
          file_name: string
          id: string
          mime_type: string | null
          order_id: string
          revision_number: number
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        SetofOptions: {
          from: "*"
          to: "design_deliverables"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      select_design_proposal: {
        Args: { p_proposal_id: string }
        Returns: {
          created_at: string
          customer_id: string
          delivered_at: string | null
          designer_id: string
          id: string
          proposal_id: string
          request_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "design_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      select_quote: {
        Args: { p_quote_id: string }
        Returns: {
          created_at: string
          customer_id: string
          delivered_at: string | null
          id: string
          partner_id: string
          project_id: string
          quote_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_design_deliverable: {
        Args: {
          p_file_name: string
          p_mime_type?: string
          p_order_id: string
          p_size_bytes?: number
          p_storage_path: string
        }
        Returns: {
          approved: boolean
          approved_at: string | null
          created_at: string
          customer_feedback: string | null
          file_name: string
          id: string
          mime_type: string | null
          order_id: string
          revision_number: number
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        SetofOptions: {
          from: "*"
          to: "design_deliverables"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_design_proposal: {
        Args: { p_proposal_id: string }
        Returns: {
          created_at: string
          designer_id: string
          down_payment_pct: number | null
          id: string
          note: string | null
          price: number | null
          request_id: string
          revision_rounds_included: number
          status: string
          submitted_at: string | null
          turnaround_days: number | null
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "design_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_design_request: {
        Args: { p_request_id: string }
        Returns: {
          budget_max: number | null
          budget_min: number | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          notes: string | null
          selected_proposal_id: string | null
          specialty: string
          status: string
          submitted_at: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "design_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_project: {
        Args: { p_project_id: string }
        Returns: {
          category: string
          created_at: string
          customer_id: string
          delivery_city: string | null
          description: string | null
          finishing_pref: string | null
          id: string
          material_pref: string | null
          notes: string | null
          quantity: number | null
          quantity_note: string | null
          selected_quote_id: string | null
          size_spec: string | null
          status: string
          submitted_at: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_quote: {
        Args: { p_quote_id: string }
        Returns: {
          created_at: string
          delivery_available: boolean
          down_payment_pct: number | null
          estimated_completion: string | null
          id: string
          note: string | null
          partner_id: string
          project_id: string
          status: string
          submitted_at: string | null
          total_price: number | null
          turnaround_days: number | null
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_design_order_status: {
        Args: { p_note?: string; p_order_id: string; p_status: string }
        Returns: {
          created_at: string
          customer_id: string
          delivered_at: string | null
          designer_id: string
          id: string
          proposal_id: string
          request_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "design_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_order_status: {
        Args: { p_note?: string; p_order_id: string; p_status: string }
        Returns: {
          created_at: string
          customer_id: string
          delivered_at: string | null
          id: string
          partner_id: string
          project_id: string
          quote_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_design_proposal: {
        Args: { p_proposal_id: string }
        Returns: {
          created_at: string
          designer_id: string
          down_payment_pct: number | null
          id: string
          note: string | null
          price: number | null
          request_id: string
          revision_rounds_included: number
          status: string
          submitted_at: string | null
          turnaround_days: number | null
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "design_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_quote: {
        Args: { p_quote_id: string }
        Returns: {
          created_at: string
          delivery_available: boolean
          down_payment_pct: number | null
          estimated_completion: string | null
          id: string
          note: string | null
          partner_id: string
          project_id: string
          status: string
          submitted_at: string | null
          total_price: number | null
          turnaround_days: number | null
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
