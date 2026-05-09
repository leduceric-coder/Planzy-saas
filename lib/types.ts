// ─── Supabase Database Types ──────────────────────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Omit<Organization, 'id' | 'created_at'>; Update: Partial<Organization> }
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile> }
      projects: { Row: Project; Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Project> }
      tasks: { Row: Task; Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Task> }
      artisans: { Row: Artisan; Insert: Omit<Artisan, 'id' | 'created_at'>; Update: Partial<Artisan> }
      teams: { Row: Team; Insert: Omit<Team, 'id' | 'created_at'>; Update: Partial<Team> }
      messages: { Row: Message; Insert: Omit<Message, 'id' | 'created_at'>; Update: Partial<Message> }
      issues: { Row: Issue; Insert: Omit<Issue, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Issue> }
      documents: { Row: Document; Insert: Omit<Document, 'id' | 'created_at'>; Update: Partial<Document> }
      photos: { Row: Photo; Insert: Omit<Photo, 'id' | 'created_at'>; Update: Partial<Photo> }
      materials: { Row: Material; Insert: Omit<Material, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Material> }
      deliveries: { Row: Delivery; Insert: Omit<Delivery, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Delivery> }
      reports: { Row: Report; Insert: Omit<Report, 'id' | 'created_at'>; Update: Partial<Report> }
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Notification> }
      activity_logs: { Row: ActivityLog; Insert: Omit<ActivityLog, 'id' | 'created_at'>; Update: never }
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
