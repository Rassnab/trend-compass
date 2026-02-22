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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          batch_id: string | null
          created_at: string
          details: Json | null
          id: string
          model_name: string | null
          model_provider: string | null
          prompt_hash: string | null
        }
        Insert: {
          action: string
          batch_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          model_name?: string | null
          model_provider?: string | null
          prompt_hash?: string | null
        }
        Update: {
          action?: string
          batch_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          model_name?: string | null
          model_provider?: string | null
          prompt_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ingestion_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          page_end: number | null
          page_start: number | null
          report_id: string
          section_heading: string | null
          text: string
          token_count: number | null
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
          report_id: string
          section_heading?: string | null
          text: string
          token_count?: number | null
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
          report_id?: string
          section_heading?: string | null
          text?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chunks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_theme_map: {
        Row: {
          claim_id: string
          confidence: number | null
          created_at: string
          id: string
          is_primary: boolean | null
          rationale: string | null
          stance: string
          theme_id: string
        }
        Insert: {
          claim_id: string
          confidence?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          rationale?: string | null
          stance?: string
          theme_id: string
        }
        Update: {
          claim_id?: string
          confidence?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          rationale?: string | null
          stance?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_theme_map_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          batch_id: string | null
          claim_text: string
          confidence: number | null
          created_at: string
          evidence_snippet: string | null
          id: string
          page_number: number | null
          page_range_end: number | null
          page_range_start: number | null
          report_id: string
          scope_geo: string | null
          scope_segment: string | null
          scope_time_horizon: string | null
        }
        Insert: {
          batch_id?: string | null
          claim_text: string
          confidence?: number | null
          created_at?: string
          evidence_snippet?: string | null
          id?: string
          page_number?: number | null
          page_range_end?: number | null
          page_range_start?: number | null
          report_id: string
          scope_geo?: string | null
          scope_segment?: string | null
          scope_time_horizon?: string | null
        }
        Update: {
          batch_id?: string | null
          claim_text?: string
          confidence?: number | null
          created_at?: string
          evidence_snippet?: string | null
          id?: string
          page_number?: number | null
          page_range_end?: number | null
          page_range_start?: number | null
          report_id?: string
          scope_geo?: string | null
          scope_segment?: string | null
          scope_time_horizon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ingestion_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_batches: {
        Row: {
          claims_extracted: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          model_version: string | null
          reports_processed: number | null
          reports_total: number | null
          started_at: string
          status: string
          unmapped_claim_pct: number | null
        }
        Insert: {
          claims_extracted?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          model_version?: string | null
          reports_processed?: number | null
          reports_total?: number | null
          started_at?: string
          status?: string
          unmapped_claim_pct?: number | null
        }
        Update: {
          claims_extracted?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          model_version?: string | null
          reports_processed?: number | null
          reports_total?: number | null
          started_at?: string
          status?: string
          unmapped_claim_pct?: number | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          batch_id: string | null
          created_at: string
          error_message: string | null
          file_hash: string | null
          file_path: string | null
          geography: string[] | null
          id: string
          page_count: number | null
          publish_date: string | null
          publisher: string | null
          segment: string[] | null
          status: string
          title: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          error_message?: string | null
          file_hash?: string | null
          file_path?: string | null
          geography?: string[] | null
          id?: string
          page_count?: number | null
          publish_date?: string | null
          publisher?: string | null
          segment?: string[] | null
          status?: string
          title: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          error_message?: string | null
          file_hash?: string | null
          file_path?: string | null
          geography?: string[] | null
          id?: string
          page_count?: number | null
          publish_date?: string | null
          publisher?: string | null
          segment?: string[] | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ingestion_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      taxonomy_tensions: {
        Row: {
          created_at: string
          false_tension_rules: Json | null
          id: string
          implications: Json | null
          label: string
          linked_themes: string[] | null
          pole_a_cues: Json | null
          pole_a_label: string | null
          pole_b_cues: Json | null
          pole_b_label: string | null
          raw_yaml: Json | null
          tension_id: string
          tension_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          false_tension_rules?: Json | null
          id?: string
          implications?: Json | null
          label: string
          linked_themes?: string[] | null
          pole_a_cues?: Json | null
          pole_a_label?: string | null
          pole_b_cues?: Json | null
          pole_b_label?: string | null
          raw_yaml?: Json | null
          tension_id: string
          tension_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          false_tension_rules?: Json | null
          id?: string
          implications?: Json | null
          label?: string
          linked_themes?: string[] | null
          pole_a_cues?: Json | null
          pole_a_label?: string | null
          pole_b_cues?: Json | null
          pole_b_label?: string | null
          raw_yaml?: Json | null
          tension_id?: string
          tension_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      taxonomy_themes: {
        Row: {
          boundaries: Json | null
          created_at: string
          cues: Json | null
          definition: string | null
          dimensions: Json | null
          governance: Json | null
          id: string
          label: string
          raw_yaml: Json | null
          relationships: Json | null
          theme_id: string
          ui_group: string | null
          ui_order: number | null
          updated_at: string
        }
        Insert: {
          boundaries?: Json | null
          created_at?: string
          cues?: Json | null
          definition?: string | null
          dimensions?: Json | null
          governance?: Json | null
          id?: string
          label: string
          raw_yaml?: Json | null
          relationships?: Json | null
          theme_id: string
          ui_group?: string | null
          ui_order?: number | null
          updated_at?: string
        }
        Update: {
          boundaries?: Json | null
          created_at?: string
          cues?: Json | null
          definition?: string | null
          dimensions?: Json | null
          governance?: Json | null
          id?: string
          label?: string
          raw_yaml?: Json | null
          relationships?: Json | null
          theme_id?: string
          ui_group?: string | null
          ui_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      tension_evidence: {
        Row: {
          claim_id: string
          confidence: number | null
          created_at: string
          id: string
          pole: string
          tension_id: string
        }
        Insert: {
          claim_id: string
          confidence?: number | null
          created_at?: string
          id?: string
          pole: string
          tension_id: string
        }
        Update: {
          claim_id?: string
          confidence?: number | null
          created_at?: string
          id?: string
          pole?: string
          tension_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tension_evidence_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      tension_scores: {
        Row: {
          batch_id: string | null
          computed_at: string
          evidence_balance: number | null
          id: string
          polarization: number | null
          pole_a_count: number | null
          pole_b_count: number | null
          scope_mismatch_penalty: number | null
          strength_score: number | null
          tension_id: string
        }
        Insert: {
          batch_id?: string | null
          computed_at?: string
          evidence_balance?: number | null
          id?: string
          polarization?: number | null
          pole_a_count?: number | null
          pole_b_count?: number | null
          scope_mismatch_penalty?: number | null
          strength_score?: number | null
          tension_id: string
        }
        Update: {
          batch_id?: string | null
          computed_at?: string
          evidence_balance?: number | null
          id?: string
          polarization?: number | null
          pole_a_count?: number | null
          pole_b_count?: number | null
          scope_mismatch_penalty?: number | null
          strength_score?: number | null
          tension_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tension_scores_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ingestion_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_scores: {
        Row: {
          batch_id: string | null
          computed_at: string
          coverage_count: number | null
          diversity_score: number | null
          evidence_strength: number | null
          id: string
          summary: string | null
          support_score: number | null
          theme_id: string
        }
        Insert: {
          batch_id?: string | null
          computed_at?: string
          coverage_count?: number | null
          diversity_score?: number | null
          evidence_strength?: number | null
          id?: string
          summary?: string | null
          support_score?: number | null
          theme_id: string
        }
        Update: {
          batch_id?: string | null
          computed_at?: string
          coverage_count?: number | null
          diversity_score?: number | null
          evidence_strength?: number | null
          id?: string
          summary?: string | null
          support_score?: number | null
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_scores_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ingestion_batches"
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
