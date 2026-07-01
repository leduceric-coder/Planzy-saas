// ─── Supabase Database Types ──────────────────────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Force TypeScript à résoudre le type immédiatement (au lieu d'une référence
// d'interface nommée paresseuse) — sans ça, postgrest-js échoue à inférer les
// requêtes (`.select().eq()...`) et tout retombe silencieusement sur `never`.
type Flatten<T> = { [K in keyof T]: T[K] }

// Chaque table doit exposer `Relationships` pour satisfaire le type `GenericTable`
// attendu par postgrest-js — sans lui, la même perte d'inférence se produit, et
// les jointures imbriquées (`assignee:artisans(...)`, `sender:profiles!sender_id(...)`)
// ne peuvent pas être résolues. Les clés listées ici reflètent les FK réelles de
// supabase/schema.sql ; `sender_id`/`taken_by`/`uploaded_by`/`generated_by`/`user_id`
// pointent vers `auth.users` en base mais sont utilisées avec un hint `!colonne`
// pour joindre `profiles` (même identifiant) — la relation est donc déclarée ici
// pour permettre l'inférence de type de cette jointure applicative.
export interface Database {
  public: {
    Tables: {
      organizations: { Row: Flatten<Organization>; Insert: Omit<Organization, 'id' | 'created_at'>; Update: Partial<Organization>; Relationships: [] }
      profiles: {
        Row: Flatten<Profile>; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile>
        Relationships: [
          { foreignKeyName: 'profiles_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] }
        ]
      }
      projects: {
        Row: Flatten<Project>; Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Project>
        Relationships: [
          { foreignKeyName: 'projects_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] }
        ]
      }
      tasks: {
        Row: Flatten<Task>; Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Task>
        Relationships: [
          { foreignKeyName: 'tasks_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'tasks_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'tasks_assigned_to_fkey'; columns: ['assigned_to']; isOneToOne: false; referencedRelation: 'artisans'; referencedColumns: ['id'] },
          { foreignKeyName: 'tasks_assigned_team_fkey'; columns: ['assigned_team']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
          { foreignKeyName: 'tasks_parent_task_id_fkey'; columns: ['parent_task_id']; isOneToOne: false; referencedRelation: 'tasks'; referencedColumns: ['id'] }
        ]
      }
      artisans: {
        Row: Flatten<Artisan>; Insert: Omit<Artisan, 'id' | 'created_at'>; Update: Partial<Artisan>
        Relationships: [
          { foreignKeyName: 'artisans_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] }
        ]
      }
      teams: {
        Row: Flatten<Team>; Insert: Omit<Team, 'id' | 'created_at'>; Update: Partial<Team>
        Relationships: [
          { foreignKeyName: 'teams_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'teams_lead_id_fkey'; columns: ['lead_id']; isOneToOne: false; referencedRelation: 'artisans'; referencedColumns: ['id'] }
        ]
      }
      team_members: {
        Row: Flatten<TeamMember>; Insert: Omit<TeamMember, 'id' | 'joined_at'>; Update: Partial<TeamMember>
        Relationships: [
          { foreignKeyName: 'team_members_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
          { foreignKeyName: 'team_members_artisan_id_fkey'; columns: ['artisan_id']; isOneToOne: false; referencedRelation: 'artisans'; referencedColumns: ['id'] }
        ]
      }
      message_threads: {
        Row: Flatten<MessageThread>; Insert: Omit<MessageThread, 'id' | 'created_at'>; Update: Partial<MessageThread>
        Relationships: [
          { foreignKeyName: 'message_threads_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'message_threads_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] }
        ]
      }
      messages: {
        Row: Flatten<Message>; Insert: Omit<Message, 'id' | 'created_at'>; Update: Partial<Message>
        Relationships: [
          { foreignKeyName: 'messages_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'messages_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'messages_thread_id_fkey'; columns: ['thread_id']; isOneToOne: false; referencedRelation: 'message_threads'; referencedColumns: ['id'] },
          { foreignKeyName: 'messages_sender_id_fkey'; columns: ['sender_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }
      issues: {
        Row: Flatten<Issue>; Insert: Omit<Issue, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Issue>
        Relationships: [
          { foreignKeyName: 'issues_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'issues_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'issues_assigned_to_fkey'; columns: ['assigned_to']; isOneToOne: false; referencedRelation: 'artisans'; referencedColumns: ['id'] },
          { foreignKeyName: 'issues_task_id_fkey'; columns: ['task_id']; isOneToOne: false; referencedRelation: 'tasks'; referencedColumns: ['id'] }
        ]
      }
      documents: {
        Row: Flatten<Document>; Insert: Omit<Document, 'id' | 'created_at'>; Update: Partial<Document>
        Relationships: [
          { foreignKeyName: 'documents_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'documents_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'documents_task_id_fkey'; columns: ['task_id']; isOneToOne: false; referencedRelation: 'tasks'; referencedColumns: ['id'] },
          { foreignKeyName: 'documents_uploaded_by_fkey'; columns: ['uploaded_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }
      photos: {
        Row: Flatten<Photo>; Insert: Omit<Photo, 'id' | 'created_at'>; Update: Partial<Photo>
        Relationships: [
          { foreignKeyName: 'photos_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'photos_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'photos_task_id_fkey'; columns: ['task_id']; isOneToOne: false; referencedRelation: 'tasks'; referencedColumns: ['id'] },
          { foreignKeyName: 'photos_issue_id_fkey'; columns: ['issue_id']; isOneToOne: false; referencedRelation: 'issues'; referencedColumns: ['id'] },
          { foreignKeyName: 'photos_taken_by_fkey'; columns: ['taken_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }
      materials: {
        Row: Flatten<Material>; Insert: Omit<Material, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Material>
        Relationships: [
          { foreignKeyName: 'materials_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'materials_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'materials_task_id_fkey'; columns: ['task_id']; isOneToOne: false; referencedRelation: 'tasks'; referencedColumns: ['id'] }
        ]
      }
      deliveries: {
        Row: Flatten<Delivery>; Insert: Omit<Delivery, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Delivery>
        Relationships: [
          { foreignKeyName: 'deliveries_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'deliveries_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'deliveries_material_id_fkey'; columns: ['material_id']; isOneToOne: false; referencedRelation: 'materials'; referencedColumns: ['id'] }
        ]
      }
      reports: {
        Row: Flatten<Report>; Insert: Omit<Report, 'id' | 'created_at'>; Update: Partial<Report>
        Relationships: [
          { foreignKeyName: 'reports_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'reports_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'reports_generated_by_fkey'; columns: ['generated_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }
      notifications: {
        Row: Flatten<Notification>; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Notification>
        Relationships: [
          { foreignKeyName: 'notifications_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] }
        ]
      }
      activity_logs: {
        Row: Flatten<ActivityLog>; Insert: Omit<ActivityLog, 'id' | 'created_at'>; Update: never
        Relationships: [
          { foreignKeyName: 'activity_logs_org_id_fkey'; columns: ['org_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'activity_logs_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
          { foreignKeyName: 'activity_logs_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      task_status: TaskStatus
      project_status: ProjectStatus
      issue_status: IssueStatus
      user_role: UserRole
      message_type: MessageType
    }
  }
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'review' | 'done' | 'validated'
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'
export type IssueStatus = 'open' | 'assigned' | 'in_progress' | 'fixed' | 'validated' | 'rejected'
export type UserRole = 'owner' | 'admin' | 'manager' | 'site_supervisor' | 'artisan' | 'viewer'
export type MessageType = 'text' | 'consigne' | 'probleme' | 'question' | 'photo' | 'livraison_absente' | 'tache_terminee' | 'validation_demandee'

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  created_at: string
  settings: Json
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  phone: string | null
  org_id: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  org_id: string
  name: string
  description: string | null
  address: string | null
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  budget: number | null
  progress: number
  color: string
  image_url: string | null
  created_by: string
  created_at: string
  updated_at: string
  // computed joins
  tasks?: Task[]
  members?: ProjectMember[]
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: UserRole
  joined_at: string
  profile?: Profile
}

export interface Task {
  id: string
  project_id: string
  org_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  start_date: string | null
  end_date: string | null
  assigned_to: string | null
  assigned_team: string | null
  estimated_hours: number | null
  actual_hours: number | null
  parent_task_id: string | null
  position: number
  created_by: string
  created_at: string
  updated_at: string
  // joins
  assignee?: Profile
  team?: Team
  dependencies?: TaskDependency[]
}

export interface TaskDependency {
  id: string
  task_id: string
  depends_on_task_id: string
  type: 'finish_to_start' | 'start_to_start'
}

export interface Artisan {
  id: string
  org_id: string
  full_name: string
  trade: string
  phone: string | null
  email: string | null
  user_id: string | null
  avatar_url: string | null
  color: string
  created_at: string
}

export interface Team {
  id: string
  org_id: string
  name: string
  color: string
  lead_id: string | null
  created_at: string
  members?: TeamMember[]
}

export interface TeamMember {
  id: string
  team_id: string
  artisan_id: string
  joined_at: string
  artisan?: Artisan
}

export interface MessageThread {
  id: string
  org_id: string
  project_id: string | null
  title: string | null
  type: 'project' | 'team' | 'direct' | 'broadcast'
  created_by: string
  created_at: string
}

export interface Message {
  id: string
  org_id: string
  project_id: string | null
  thread_id: string | null
  sender_id: string
  content: string
  type: MessageType
  metadata: Json
  created_at: string
  sender?: Profile
}

export interface Issue {
  id: string
  project_id: string
  org_id: string
  title: string
  description: string | null
  status: IssueStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  reported_by: string
  assigned_to: string | null
  task_id: string | null
  created_at: string
  updated_at: string
  photos?: Photo[]
}

export interface Document {
  id: string
  project_id: string
  org_id: string
  name: string
  file_url: string
  file_type: string
  file_size: number
  category: string | null
  task_id: string | null
  uploaded_by: string
  created_at: string
}

export interface Photo {
  id: string
  project_id: string
  org_id: string
  url: string
  thumbnail_url: string | null
  caption: string | null
  theme: string | null
  task_id: string | null
  issue_id: string | null
  taken_by: string
  taken_at: string
  created_at: string
}

export interface Material {
  id: string
  project_id: string
  org_id: string
  name: string
  quantity: number
  unit: string
  status: 'pending' | 'ordered' | 'delivered' | 'delayed' | 'cancelled'
  task_id: string | null
  expected_delivery: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Delivery {
  id: string
  project_id: string
  org_id: string
  material_id: string | null
  supplier: string
  scheduled_date: string
  actual_date: string | null
  status: 'scheduled' | 'delivered' | 'delayed' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  project_id: string | null
  org_id: string
  title: string
  type: 'weekly' | 'monthly' | 'incident' | 'handover'
  content: Json
  generated_by: string
  week_number: number | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  org_id: string
  title: string
  body: string
  type: string
  read: boolean
  link: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  org_id: string
  project_id: string | null
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Json
  created_at: string
}

// ─── UI / App types ────────────────────────────────────────────────────────────

export interface KpiStat {
  label: string
  value: number | string
  delta?: string
  deltaType?: 'positive' | 'negative' | 'neutral'
  icon: string
  color: 'blue' | 'orange' | 'green' | 'red'
}

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: number
}

export type Theme = 'dark' | 'light'
