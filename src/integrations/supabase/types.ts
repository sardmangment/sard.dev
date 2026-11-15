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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contact_info: {
        Row: {
          address_ar: string | null
          address_en: string | null
          created_at: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      dashboard_comments: {
        Row: {
          comment_ar: string | null
          comment_en: string | null
          created_at: string | null
          created_by: string | null
          goal_id: string | null
          id: string
          update_id: string | null
        }
        Insert: {
          comment_ar?: string | null
          comment_en?: string | null
          created_at?: string | null
          created_by?: string | null
          goal_id?: string | null
          id?: string
          update_id?: string | null
        }
        Update: {
          comment_ar?: string | null
          comment_en?: string | null
          created_at?: string | null
          created_by?: string | null
          goal_id?: string | null
          id?: string
          update_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_comments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "dashboard_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_comments_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "dashboard_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_financials: {
        Row: {
          amount: number
          category_ar: string | null
          category_en: string | null
          created_at: string
          created_by: string | null
          date: string
          description_ar: string | null
          description_en: string | null
          goal_id: string | null
          id: string
          type: string
        }
        Insert: {
          amount: number
          category_ar?: string | null
          category_en?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description_ar?: string | null
          description_en?: string | null
          goal_id?: string | null
          id?: string
          type: string
        }
        Update: {
          amount?: number
          category_ar?: string | null
          category_en?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description_ar?: string | null
          description_en?: string | null
          goal_id?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_financials_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "dashboard_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_goals: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          current_value: number | null
          description_ar: string | null
          description_en: string | null
          end_date: string | null
          id: string
          priority: string | null
          start_date: string | null
          status: string | null
          target_value: number | null
          title_ar: string
          title_en: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          description_ar?: string | null
          description_en?: string | null
          end_date?: string | null
          id?: string
          priority?: string | null
          start_date?: string | null
          status?: string | null
          target_value?: number | null
          title_ar: string
          title_en: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          description_ar?: string | null
          description_en?: string | null
          end_date?: string | null
          id?: string
          priority?: string | null
          start_date?: string | null
          status?: string | null
          target_value?: number | null
          title_ar?: string
          title_en?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dashboard_updates: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_role: string | null
          description_ar: string | null
          description_en: string | null
          goal_id: string | null
          id: string
          progress_value: number | null
          title_ar: string
          title_en: string
          update_type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_by_role?: string | null
          description_ar?: string | null
          description_en?: string | null
          goal_id?: string | null
          id?: string
          progress_value?: number | null
          title_ar: string
          title_en: string
          update_type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_by_role?: string | null
          description_ar?: string | null
          description_en?: string | null
          goal_id?: string | null
          id?: string
          progress_value?: number | null
          title_ar?: string
          title_en?: string
          update_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_updates_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "dashboard_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_assets: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          password: string | null
          phone_number: string | null
          software: string
          sort_order: number | null
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          password?: string | null
          phone_number?: string | null
          software: string
          sort_order?: number | null
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          password?: string | null
          phone_number?: string | null
          software?: string
          sort_order?: number | null
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Relationships: []
      }
      feasibility_studies: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          expected_funding: number | null
          expected_revenue: number | null
          id: string
          project_manager: string | null
          project_name: string
          sort_order: number | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          expected_funding?: number | null
          expected_revenue?: number | null
          id?: string
          project_manager?: string | null
          project_name: string
          sort_order?: number | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          expected_funding?: number | null
          expected_revenue?: number | null
          id?: string
          project_manager?: string | null
          project_name?: string
          sort_order?: number | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      footer_links: {
        Row: {
          category: string | null
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          title_ar: string
          title_en: string
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          title_ar: string
          title_en: string
          url: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          title_ar?: string
          title_en?: string
          url?: string
        }
        Relationships: []
      }
      idea_comments: {
        Row: {
          action: string | null
          author_id: string | null
          author_role: string
          created_at: string
          id: string
          idea_id: string
          text: string
        }
        Insert: {
          action?: string | null
          author_id?: string | null
          author_role: string
          created_at?: string
          id?: string
          idea_id: string
          text: string
        }
        Update: {
          action?: string | null
          author_id?: string | null
          author_role?: string
          created_at?: string
          id?: string
          idea_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_comments_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_project_finances: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          idea_id: string
          transaction_date: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          idea_id: string
          transaction_date?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          idea_id?: string
          transaction_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_project_finances_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_projects: {
        Row: {
          created_at: string
          current_status: string | null
          duration_months: number | null
          end_date: string | null
          feasibility_study: string | null
          id: string
          idea_id: string
          phases: Json
          progress: number
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_status?: string | null
          duration_months?: number | null
          end_date?: string | null
          feasibility_study?: string | null
          id?: string
          idea_id: string
          phases?: Json
          progress?: number
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_status?: string | null
          duration_months?: number | null
          end_date?: string | null
          feasibility_study?: string | null
          id?: string
          idea_id?: string
          phases?: Json
          progress?: number
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_projects_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: true
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expected_return: number | null
          id: string
          owner: string
          rejection_reason: string | null
          sector: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_return?: number | null
          id?: string
          owner: string
          rejection_reason?: string | null
          sector?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_return?: number | null
          id?: string
          owner?: string
          rejection_reason?: string | null
          sector?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      partnerships: {
        Row: {
          contract_date: string | null
          contract_details_ar: string | null
          contract_details_en: string | null
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          partner_logo_url: string | null
          partner_name_ar: string
          partner_name_en: string
          updated_at: string | null
        }
        Insert: {
          contract_date?: string | null
          contract_details_ar?: string | null
          contract_details_en?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          partner_logo_url?: string | null
          partner_name_ar: string
          partner_name_en: string
          updated_at?: string | null
        }
        Update: {
          contract_date?: string | null
          contract_details_ar?: string | null
          contract_details_en?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          partner_logo_url?: string | null
          partner_name_ar?: string
          partner_name_en?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      physical_assets: {
        Row: {
          asset_type: string
          company: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          manufacture_date: string | null
          sort_order: number | null
          supply_date: string | null
          updated_at: string
        }
        Insert: {
          asset_type: string
          company?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          manufacture_date?: string | null
          sort_order?: number | null
          supply_date?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: string
          company?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          manufacture_date?: string | null
          sort_order?: number | null
          supply_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_images: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          project_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          project_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_images_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          partnership_id: string | null
          project_link: string | null
          title_ar: string
          title_en: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          partnership_id?: string | null
          project_link?: string | null
          title_ar: string
          title_en: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          partnership_id?: string | null
          project_link?: string | null
          title_ar?: string
          title_en?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      projects_registry: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expected_return: number | null
          id: string
          owner: string
          rejection_reason: string | null
          sector: string | null
          sort_order: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_return?: number | null
          id?: string
          owner: string
          rejection_reason?: string | null
          sector?: string | null
          sort_order?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_return?: number | null
          id?: string
          owner?: string
          rejection_reason?: string | null
          sector?: string | null
          sort_order?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          about_ar: string | null
          about_en: string | null
          company_name_ar: string | null
          company_name_en: string | null
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          logo_url: string | null
          mission_ar: string | null
          mission_en: string | null
          updated_at: string | null
          value_message_ar: string | null
          value_message_en: string | null
          values_ar: string | null
          values_en: string | null
          vision_ar: string | null
          vision_en: string | null
        }
        Insert: {
          about_ar?: string | null
          about_en?: string | null
          company_name_ar?: string | null
          company_name_en?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          logo_url?: string | null
          mission_ar?: string | null
          mission_en?: string | null
          updated_at?: string | null
          value_message_ar?: string | null
          value_message_en?: string | null
          values_ar?: string | null
          values_en?: string | null
          vision_ar?: string | null
          vision_en?: string | null
        }
        Update: {
          about_ar?: string | null
          about_en?: string | null
          company_name_ar?: string | null
          company_name_en?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          logo_url?: string | null
          mission_ar?: string | null
          mission_en?: string | null
          updated_at?: string | null
          value_message_ar?: string | null
          value_message_en?: string | null
          values_ar?: string | null
          values_en?: string | null
          vision_ar?: string | null
          vision_en?: string | null
        }
        Relationships: []
      }
      team_member_projects: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          role_ar: string | null
          role_en: string | null
          tasks_ar: string | null
          tasks_en: string | null
          team_member_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          role_ar?: string | null
          role_en?: string | null
          tasks_ar?: string | null
          tasks_en?: string | null
          team_member_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          role_ar?: string | null
          role_en?: string | null
          tasks_ar?: string | null
          tasks_en?: string | null
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_projects_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          bio_ar: string | null
          bio_en: string | null
          created_at: string | null
          display_order: number | null
          email: string | null
          id: string
          is_active: boolean | null
          is_admin: boolean | null
          is_consultant: boolean | null
          join_date: string | null
          linkedin: string | null
          name_ar: string
          name_en: string
          phone: string | null
          photo_url: string | null
          role_ar: string
          role_en: string
          updated_at: string | null
        }
        Insert: {
          bio_ar?: string | null
          bio_en?: string | null
          created_at?: string | null
          display_order?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_admin?: boolean | null
          is_consultant?: boolean | null
          join_date?: string | null
          linkedin?: string | null
          name_ar: string
          name_en: string
          phone?: string | null
          photo_url?: string | null
          role_ar: string
          role_en: string
          updated_at?: string | null
        }
        Update: {
          bio_ar?: string | null
          bio_en?: string | null
          created_at?: string | null
          display_order?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_admin?: boolean | null
          is_consultant?: boolean | null
          join_date?: string | null
          linkedin?: string | null
          name_ar?: string
          name_en?: string
          phone?: string | null
          photo_url?: string | null
          role_ar?: string
          role_en?: string
          updated_at?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dashboard_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "ceo" | "cto" | "gm"
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
      app_role: ["admin", "user", "ceo", "cto", "gm"],
    },
  },
} as const
