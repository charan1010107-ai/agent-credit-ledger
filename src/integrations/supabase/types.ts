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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          anomaly: boolean
          anomaly_reason: string | null
          avg_completion_minutes: number
          created_at: string
          credit_limit: number
          credit_score: number
          freeze_reason: string | null
          frozen_at: string | null
          id: string
          name: string
          principal_id: string
          recent_task_revenue: Json
          score_factors: Json
          spend_cap: number
          spend_consistency: number
          spend_velocity: Json
          status: string
          task_scope: string
          task_success_rate: number
          vendor_whitelist: Json
          wallet_address: string
          wallet_balance: number
        }
        Insert: {
          anomaly?: boolean
          anomaly_reason?: string | null
          avg_completion_minutes?: number
          created_at?: string
          credit_limit?: number
          credit_score?: number
          freeze_reason?: string | null
          frozen_at?: string | null
          id?: string
          name: string
          principal_id: string
          recent_task_revenue?: Json
          score_factors?: Json
          spend_cap?: number
          spend_consistency?: number
          spend_velocity?: Json
          status?: string
          task_scope?: string
          task_success_rate?: number
          vendor_whitelist?: Json
          wallet_address: string
          wallet_balance?: number
        }
        Update: {
          anomaly?: boolean
          anomaly_reason?: string | null
          avg_completion_minutes?: number
          created_at?: string
          credit_limit?: number
          credit_score?: number
          freeze_reason?: string | null
          frozen_at?: string | null
          id?: string
          name?: string
          principal_id?: string
          recent_task_revenue?: Json
          score_factors?: Json
          spend_cap?: number
          spend_consistency?: number
          spend_velocity?: Json
          status?: string
          task_scope?: string
          task_success_rate?: number
          vendor_whitelist?: Json
          wallet_address?: string
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "agents_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          decision_reasons: Json
          disbursed_at: string | null
          expected_repayment_date: string | null
          expected_revenue: number
          id: string
          interest_rate: number
          repaid_at: string | null
          status: string
          task_description: string
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          decision_reasons?: Json
          disbursed_at?: string | null
          expected_repayment_date?: string | null
          expected_revenue?: number
          id?: string
          interest_rate?: number
          repaid_at?: string | null
          status?: string
          task_description: string
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          decision_reasons?: Json
          disbursed_at?: string | null
          expected_repayment_date?: string | null
          expected_revenue?: number
          id?: string
          interest_rate?: number
          repaid_at?: string | null
          status?: string
          task_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      principals: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          jurisdiction: string
          name: string
          reputation_score: number
          signature_hash: string
          signed_at: string
        }
        Insert: {
          created_at?: string
          entity_type?: string
          id?: string
          jurisdiction?: string
          name: string
          reputation_score?: number
          signature_hash: string
          signed_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          jurisdiction?: string
          name?: string
          reputation_score?: number
          signature_hash?: string
          signed_at?: string
        }
        Relationships: []
      }
      score_history: {
        Row: {
          agent_id: string
          id: string
          recorded_at: string
          score: number
        }
        Insert: {
          agent_id: string
          id?: string
          recorded_at?: string
          score: number
        }
        Update: {
          agent_id?: string
          id?: string
          recorded_at?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_history_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          agent_id: string | null
          amount: number
          created_at: string
          id: string
          loan_id: string | null
          memo: string | null
          status: string
          tx_hash: string
          tx_type: string
        }
        Insert: {
          agent_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string | null
          memo?: string | null
          status?: string
          tx_hash: string
          tx_type: string
        }
        Update: {
          agent_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string | null
          memo?: string | null
          status?: string
          tx_hash?: string
          tx_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
