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
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          details: Json
          id: string
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      bounties: {
        Row: {
          amount: number
          awarded_at: string | null
          awarded_to: string | null
          created_at: string
          created_by: string
          currency: string
          description: string
          feedback_item_id: string | null
          id: string
          notes: string
          status: Database["public"]["Enums"]["bounty_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          awarded_at?: string | null
          awarded_to?: string | null
          created_at?: string
          created_by: string
          currency?: string
          description?: string
          feedback_item_id?: string | null
          id?: string
          notes?: string
          status?: Database["public"]["Enums"]["bounty_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          awarded_at?: string | null
          awarded_to?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          feedback_item_id?: string | null
          id?: string
          notes?: string
          status?: Database["public"]["Enums"]["bounty_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounties_feedback_item_id_fkey"
            columns: ["feedback_item_id"]
            isOneToOne: false
            referencedRelation: "feedback_items"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_items: {
        Row: {
          created_at: string
          description: string
          github_issue_number: number | null
          github_issue_url: string | null
          github_state: string | null
          id: string
          status: Database["public"]["Enums"]["feedback_status"]
          title: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at: string
          user_id: string
          votes: number
        }
        Insert: {
          created_at?: string
          description?: string
          github_issue_number?: number | null
          github_issue_url?: string | null
          github_state?: string | null
          id?: string
          status?: Database["public"]["Enums"]["feedback_status"]
          title: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
          user_id: string
          votes?: number
        }
        Update: {
          created_at?: string
          description?: string
          github_issue_number?: number | null
          github_issue_url?: string | null
          github_state?: string | null
          id?: string
          status?: Database["public"]["Enums"]["feedback_status"]
          title?: string
          type?: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
          user_id?: string
          votes?: number
        }
        Relationships: []
      }
      feedback_votes: {
        Row: {
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_votes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "feedback_items"
            referencedColumns: ["id"]
          },
        ]
      }
      hermes_agents: {
        Row: {
          created_at: string
          id: string
          iteration_count: number
          model: string
          name: string
          objective: string | null
          output: Json | null
          role: Database["public"]["Enums"]["hermes_agent_role"]
          status: Database["public"]["Enums"]["hermes_agent_status"]
          system_prompt: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          iteration_count?: number
          model: string
          name: string
          objective?: string | null
          output?: Json | null
          role: Database["public"]["Enums"]["hermes_agent_role"]
          status?: Database["public"]["Enums"]["hermes_agent_status"]
          system_prompt?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          iteration_count?: number
          model?: string
          name?: string
          objective?: string | null
          output?: Json | null
          role?: Database["public"]["Enums"]["hermes_agent_role"]
          status?: Database["public"]["Enums"]["hermes_agent_status"]
          system_prompt?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hermes_agents_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hermes_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      hermes_role_presets: {
        Row: {
          created_at: string
          created_by: string | null
          default_model: string
          enabled: boolean
          id: string
          name: string
          role: Database["public"]["Enums"]["hermes_agent_role"]
          sort_order: number
          system_prompt: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_model: string
          enabled?: boolean
          id?: string
          name: string
          role: Database["public"]["Enums"]["hermes_agent_role"]
          sort_order?: number
          system_prompt: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_model?: string
          enabled?: boolean
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["hermes_agent_role"]
          sort_order?: number
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      hermes_settings: {
        Row: {
          allowed_tools: string[]
          created_at: string
          default_model: string
          max_agents: number
          max_iterations: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_tools?: string[]
          created_at?: string
          default_model?: string
          max_agents?: number
          max_iterations?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_tools?: string[]
          created_at?: string
          default_model?: string
          max_agents?: number
          max_iterations?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hermes_steps: {
        Row: {
          agent_id: string
          content: Json
          created_at: string
          id: string
          step_type: Database["public"]["Enums"]["hermes_step_type"]
          task_id: string
          tokens_used: number
          user_id: string
        }
        Insert: {
          agent_id: string
          content?: Json
          created_at?: string
          id?: string
          step_type: Database["public"]["Enums"]["hermes_step_type"]
          task_id: string
          tokens_used?: number
          user_id: string
        }
        Update: {
          agent_id?: string
          content?: Json
          created_at?: string
          id?: string
          step_type?: Database["public"]["Enums"]["hermes_step_type"]
          task_id?: string
          tokens_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hermes_steps_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "hermes_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hermes_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hermes_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      hermes_tasks: {
        Row: {
          created_at: string
          error: string | null
          final_output: Json | null
          goal: string
          id: string
          max_agents: number
          max_iterations: number
          model: string
          result_summary: string | null
          status: Database["public"]["Enums"]["hermes_task_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          final_output?: Json | null
          goal: string
          id?: string
          max_agents?: number
          max_iterations?: number
          model: string
          result_summary?: string | null
          status?: Database["public"]["Enums"]["hermes_task_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          final_output?: Json | null
          goal?: string
          id?: string
          max_agents?: number
          max_iterations?: number
          model?: string
          result_summary?: string | null
          status?: Database["public"]["Enums"]["hermes_task_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      model_skills: {
        Row: {
          component: Database["public"]["Enums"]["skill_component"]
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          is_default: boolean
          model: string
          name: string
          sort_order: number
          system_preamble: string
          updated_at: string
        }
        Insert: {
          component: Database["public"]["Enums"]["skill_component"]
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          is_default?: boolean
          model: string
          name: string
          sort_order?: number
          system_preamble?: string
          updated_at?: string
        }
        Update: {
          component?: Database["public"]["Enums"]["skill_component"]
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          is_default?: boolean
          model?: string
          name?: string
          sort_order?: number
          system_preamble?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          first_name: string | null
          language: string
          title: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          first_name?: string | null
          language?: string
          title?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          first_name?: string | null
          language?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          data: Json
          id: string
          idea: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          idea: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          idea?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          category: Database["public"]["Enums"]["prompt_category"]
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          requires: string[]
          slug: string
          sort_order: number
          template: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["prompt_category"]
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          requires?: string[]
          slug: string
          sort_order?: number
          template: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["prompt_category"]
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          requires?: string[]
          slug?: string
          sort_order?: number
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      admin_exists: { Args: never; Returns: boolean }
      claim_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      sysadmin_exists: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "sysadmin"
      bounty_status: "open" | "awarded" | "paid" | "cancelled"
      feedback_status: "open" | "planned" | "in_progress" | "done" | "wontfix"
      feedback_type: "wish" | "bug" | "issue"
      hermes_agent_role: "planner" | "worker" | "critic" | "custom"
      hermes_agent_status:
        | "idle"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      hermes_step_type:
        | "thought"
        | "tool_call"
        | "tool_result"
        | "final"
        | "error"
      hermes_task_status:
        | "queued"
        | "planning"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      prompt_category: "strategic" | "compliance" | "market" | "sales"
      skill_component:
        | "vetting_strategic"
        | "vetting_compliance"
        | "vetting_market"
        | "vetting_sales"
        | "chat"
        | "market_research"
        | "intake_refine"
        | "focus_group"
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
      app_role: ["admin", "user", "sysadmin"],
      bounty_status: ["open", "awarded", "paid", "cancelled"],
      feedback_status: ["open", "planned", "in_progress", "done", "wontfix"],
      feedback_type: ["wish", "bug", "issue"],
      hermes_agent_role: ["planner", "worker", "critic", "custom"],
      hermes_agent_status: [
        "idle",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      hermes_step_type: [
        "thought",
        "tool_call",
        "tool_result",
        "final",
        "error",
      ],
      hermes_task_status: [
        "queued",
        "planning",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      prompt_category: ["strategic", "compliance", "market", "sales"],
      skill_component: [
        "vetting_strategic",
        "vetting_compliance",
        "vetting_market",
        "vetting_sales",
        "chat",
        "market_research",
        "intake_refine",
        "focus_group",
      ],
    },
  },
} as const
