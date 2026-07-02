export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          org_id: string
          project_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          project_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          project_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      artisans: {
        Row: {
          avatar_url: string | null
          color: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_archived: boolean
          notes: string | null
          org_id: string
          phone: string | null
          trade: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          color?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          org_id: string
          phone?: string | null
          trade: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          color?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          org_id?: string
          phone?: string | null
          trade?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          actual_date: string | null
          created_at: string | null
          id: string
          material_id: string | null
          notes: string | null
          org_id: string
          project_id: string
          scheduled_date: string
          status: string | null
          supplier: string
          updated_at: string | null
        }
        Insert: {
          actual_date?: string | null
          created_at?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          org_id: string
          project_id: string
          scheduled_date: string
          status?: string | null
          supplier: string
          updated_at?: string | null
        }
        Update: {
          actual_date?: string | null
          created_at?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          org_id?: string
          project_id?: string
          scheduled_date?: string
          status?: string | null
          supplier?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          name: string
          org_id: string
          project_id: string
          storage_path: string | null
          task_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          org_id: string
          project_id: string
          storage_path?: string | null
          task_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          org_id?: string
          project_id?: string
          storage_path?: string | null
          task_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          description: string | null
          id: string
          org_id: string
          priority: string | null
          project_id: string
          reported_by: string | null
          status: Database["public"]["Enums"]["issue_status"] | null
          task_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          org_id: string
          priority?: string | null
          project_id: string
          reported_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"] | null
          task_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          org_id?: string
          priority?: string | null
          project_id?: string
          reported_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"] | null
          task_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          created_at: string | null
          expected_delivery: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          project_id: string
          quantity: number | null
          status: string | null
          task_id: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expected_delivery?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          project_id: string
          quantity?: number | null
          status?: string | null
          task_id?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expected_delivery?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          project_id?: string
          quantity?: number | null
          status?: string | null
          task_id?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          org_id: string
          project_id: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          org_id: string
          project_id?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          org_id?: string
          project_id?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          org_id: string
          project_id: string | null
          sender_id: string
          thread_id: string | null
          type: Database["public"]["Enums"]["message_type"] | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          project_id?: string | null
          sender_id: string
          thread_id?: string | null
          type?: Database["public"]["Enums"]["message_type"] | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          project_id?: string | null
          sender_id?: string
          thread_id?: string | null
          type?: Database["public"]["Enums"]["message_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          link: string | null
          org_id: string | null
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          link?: string | null
          org_id?: string | null
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          link?: string | null
          org_id?: string | null
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          plan: string | null
          settings: Json | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan?: string | null
          settings?: Json | null
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan?: string | null
          settings?: Json | null
          slug?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          issue_id: string | null
          org_id: string
          project_id: string
          storage_path: string | null
          taken_at: string | null
          taken_by: string | null
          task_id: string | null
          theme: string | null
          thumbnail_url: string | null
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          issue_id?: string | null
          org_id: string
          project_id: string
          storage_path?: string | null
          taken_at?: string | null
          taken_by?: string | null
          task_id?: string | null
          theme?: string | null
          thumbnail_url?: string | null
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          issue_id?: string | null
          org_id?: string
          project_id?: string
          storage_path?: string | null
          taken_at?: string | null
          taken_by?: string | null
          task_id?: string | null
          theme?: string | null
          thumbnail_url?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          org_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          org_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          org_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          id: string
          joined_at: string | null
          project_id: string
          role: Database["public"]["Enums"]["user_role"] | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          budget: number | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          name: string
          org_id: string
          progress: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          budget?: number | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          name: string
          org_id: string
          progress?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          budget?: number | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          name?: string
          org_id?: string
          progress?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          content: Json | null
          created_at: string | null
          generated_by: string | null
          id: string
          org_id: string
          project_id: string | null
          title: string
          type: string | null
          week_number: number | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          org_id: string
          project_id?: string | null
          title: string
          type?: string | null
          week_number?: number | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          org_id?: string
          project_id?: string | null
          title?: string
          type?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          depends_on_task_id: string
          id: string
          task_id: string
          type: string | null
        }
        Insert: {
          depends_on_task_id: string
          id?: string
          task_id: string
          type?: string | null
        }
        Update: {
          depends_on_task_id?: string
          id?: string
          task_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assigned_team: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          estimated_hours: number | null
          id: string
          org_id: string
          parent_task_id: string | null
          position: number | null
          priority: string | null
          project_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_team?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          org_id: string
          parent_task_id?: string | null
          position?: number | null
          priority?: string | null
          project_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_team?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          org_id?: string
          parent_task_id?: string | null
          position?: number | null
          priority?: string | null
          project_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_team_fkey"
            columns: ["assigned_team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          artisan_id: string
          id: string
          joined_at: string | null
          team_id: string
        }
        Insert: {
          artisan_id: string
          id?: string
          joined_at?: string | null
          team_id: string
        }
        Update: {
          artisan_id?: string
          id?: string
          joined_at?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          name: string
          org_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          name: string
          org_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_org_ids: { Args: never; Returns: string[] }
      is_org_admin: { Args: { oid: string }; Returns: boolean }
    }
    Enums: {
      issue_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "fixed"
        | "validated"
        | "rejected"
      message_type:
        | "text"
        | "consigne"
        | "probleme"
        | "question"
        | "photo"
        | "livraison_absente"
        | "tache_terminee"
        | "validation_demandee"
      project_status: "active" | "paused" | "completed" | "archived"
      task_status:
        | "todo"
        | "in_progress"
        | "blocked"
        | "review"
        | "done"
        | "validated"
      user_role:
        | "owner"
        | "admin"
        | "manager"
        | "site_supervisor"
        | "artisan"
        | "viewer"
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
      issue_status: [
        "open",
        "assigned",
        "in_progress",
        "fixed",
        "validated",
        "rejected",
      ],
      message_type: [
        "text",
        "consigne",
        "probleme",
        "question",
        "photo",
        "livraison_absente",
        "tache_terminee",
        "validation_demandee",
      ],
      project_status: ["active", "paused", "completed", "archived"],
      task_status: [
        "todo",
        "in_progress",
        "blocked",
        "review",
        "done",
        "validated",
      ],
      user_role: [
        "owner",
        "admin",
        "manager",
        "site_supervisor",
        "artisan",
        "viewer",
      ],
    },
  },
} as const
