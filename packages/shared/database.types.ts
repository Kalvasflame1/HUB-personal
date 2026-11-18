
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "entity_id": string | null,"entity_type": string | null,"id": number,"is_demo": boolean,"kind": string,"metadata": NonNullable<Json>,"occurred_at": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "entity_id"?: string | null,"entity_type"?: string | null,"id"?: never,"is_demo"?: boolean,"kind": string,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"title": string,"user_id"?: string
                  }
                  Update: {
                    "entity_id"?: string | null,"entity_type"?: string | null,"id"?: never,"is_demo"?: boolean,"kind"?: string,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_jobs": {
                  Row: {
                    "created_at": string,"error": string | null,"finished_at": string | null,"id": string,"input": NonNullable<Json>,"kind": string,"output": Json | null,"provider": string | null,"started_at": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"input": NonNullable<Json>,"kind": string,"output"?: Json | null,"provider"?: string | null,"started_at"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"input"?: NonNullable<Json>,"kind"?: string,"output"?: Json | null,"provider"?: string | null,"started_at"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"assistant_conversations": {
                  Row: {
                    "created_at": string,"id": string,"title": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"assistant_messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"role": string,"sources": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"role": string,"sources"?: NonNullable<Json>,"user_id"?: string
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"role"?: string,"sources"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assistant_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "assistant_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"job_runs": {
                  Row: {
                    "details": NonNullable<Json>,"error": string | null,"finished_at": string | null,"id": number,"items": number | null,"job_name": string,"started_at": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "details"?: NonNullable<Json>,"error"?: string | null,"finished_at"?: string | null,"id"?: never,"items"?: number | null,"job_name": string,"started_at"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "details"?: NonNullable<Json>,"error"?: string | null,"finished_at"?: string | null,"id"?: never,"items"?: number | null,"job_name"?: string,"started_at"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"kb_documents": {
                  Row: {
                    "content_hash": string | null,"deleted_at": string | null,"doc_kind": string | null,"excerpt": string | null,"external_id": string,"folder_path": string | null,"fts": unknown,"id": string,"indexed_at": string,"search_text": string | null,"source": string,"source_updated_at": string | null,"source_url": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_hash"?: string | null,"deleted_at"?: string | null,"doc_kind"?: string | null,"excerpt"?: string | null,"external_id": string,"folder_path"?: string | null,"fts"?: never,"id"?: string,"indexed_at"?: string,"search_text"?: string | null,"source"?: string,"source_updated_at"?: string | null,"source_url"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "content_hash"?: string | null,"deleted_at"?: string | null,"doc_kind"?: string | null,"excerpt"?: string | null,"external_id"?: string,"folder_path"?: string | null,"fts"?: never,"id"?: string,"indexed_at"?: string,"search_text"?: string | null,"source"?: string,"source_updated_at"?: string | null,"source_url"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"kb_links": {
                  Row: {
                    "created_at": string,"created_by": string,"document_id": string,"entity_id": string,"entity_type": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"document_id": string,"entity_id": string,"entity_type": string,"id"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"document_id"?: string,"entity_id"?: string,"entity_type"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kb_links_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "kb_documents"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"level": string,"link": string | null,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"level"?: string,"link"?: string | null,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"level"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"personal_records": {
                  Row: {
                    "achieved_at": string,"activity_id": number | null,"distance_key": string,"id": string,"is_current": boolean,"is_demo": boolean,"time_s": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achieved_at": string,"activity_id"?: number | null,"distance_key": string,"id"?: string,"is_current"?: boolean,"is_demo"?: boolean,"time_s": number,"user_id": string
                  }
                  Update: {
                    "achieved_at"?: string,"activity_id"?: number | null,"distance_key"?: string,"id"?: string,"is_current"?: boolean,"is_demo"?: boolean,"time_s"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "personal_records_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "strava_activities"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"settings": NonNullable<Json>,"timezone": string,"units": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"settings"?: NonNullable<Json>,"timezone"?: string,"units"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"settings"?: NonNullable<Json>,"timezone"?: string,"units"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "color": string | null,"created_at": string,"description": string | null,"id": string,"is_demo": boolean,"name": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "body_md": string | null,"craft_url": string | null,"created_at": string,"generated_by": string,"id": string,"is_demo": boolean,"kind": string,"metrics": NonNullable<Json>,"period_end": string,"period_start": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md"?: string | null,"craft_url"?: string | null,"created_at"?: string,"generated_by"?: string,"id"?: string,"is_demo"?: boolean,"kind": string,"metrics"?: NonNullable<Json>,"period_end": string,"period_start": string,"title": string,"user_id": string
                  }
                  Update: {
                    "body_md"?: string | null,"craft_url"?: string | null,"created_at"?: string,"generated_by"?: string,"id"?: string,"is_demo"?: boolean,"kind"?: string,"metrics"?: NonNullable<Json>,"period_end"?: string,"period_start"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"strava_activities": {
                  Row: {
                    "average_cadence": number | null,"average_heartrate": number | null,"average_speed_ms": number | null,"calories": number | null,"distance_m": number,"elapsed_time_s": number,"elevation_gain_m": number | null,"gear_id": string | null,"has_detail": boolean,"id": number,"is_demo": boolean,"max_heartrate": number | null,"max_speed_ms": number | null,"moving_time_s": number,"name": string | null,"raw": Json | null,"sport_type": string,"start_date": string,"start_date_local": string,"suffer_score": number | null,"summary_polyline": string | null,"synced_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "average_cadence"?: number | null,"average_heartrate"?: number | null,"average_speed_ms"?: number | null,"calories"?: number | null,"distance_m"?: number,"elapsed_time_s"?: number,"elevation_gain_m"?: number | null,"gear_id"?: string | null,"has_detail"?: boolean,"id": number,"is_demo"?: boolean,"max_heartrate"?: number | null,"max_speed_ms"?: number | null,"moving_time_s"?: number,"name"?: string | null,"raw"?: Json | null,"sport_type": string,"start_date": string,"start_date_local": string,"suffer_score"?: number | null,"summary_polyline"?: string | null,"synced_at"?: string,"user_id": string
                  }
                  Update: {
                    "average_cadence"?: number | null,"average_heartrate"?: number | null,"average_speed_ms"?: number | null,"calories"?: number | null,"distance_m"?: number,"elapsed_time_s"?: number,"elevation_gain_m"?: number | null,"gear_id"?: string | null,"has_detail"?: boolean,"id"?: number,"is_demo"?: boolean,"max_heartrate"?: number | null,"max_speed_ms"?: number | null,"moving_time_s"?: number,"name"?: string | null,"raw"?: Json | null,"sport_type"?: string,"start_date"?: string,"start_date_local"?: string,"suffer_score"?: number | null,"summary_polyline"?: string | null,"synced_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"strava_best_efforts": {
                  Row: {
                    "activity_id": number,"distance_m": number,"elapsed_time_s": number,"id": number,"moving_time_s": number | null,"name": string,"pr_rank": number | null,"start_date": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": number,"distance_m": number,"elapsed_time_s": number,"id": number,"moving_time_s"?: number | null,"name": string,"pr_rank"?: number | null,"start_date": string,"user_id": string
                  }
                  Update: {
                    "activity_id"?: number,"distance_m"?: number,"elapsed_time_s"?: number,"id"?: number,"moving_time_s"?: number | null,"name"?: string,"pr_rank"?: number | null,"start_date"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "strava_best_efforts_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "strava_activities"
      referencedColumns: ["id"]
    }
                  ]
                },"strava_laps": {
                  Row: {
                    "activity_id": number,"average_heartrate": number | null,"average_speed_ms": number | null,"distance_m": number | null,"id": number,"lap_index": number,"moving_time_s": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": number,"average_heartrate"?: number | null,"average_speed_ms"?: number | null,"distance_m"?: number | null,"id": number,"lap_index": number,"moving_time_s"?: number | null,"user_id": string
                  }
                  Update: {
                    "activity_id"?: number,"average_heartrate"?: number | null,"average_speed_ms"?: number | null,"distance_m"?: number | null,"id"?: number,"lap_index"?: number,"moving_time_s"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "strava_laps_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "strava_activities"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"due_date": string | null,"id": string,"is_demo": boolean,"notes": string | null,"position": number,"priority": number,"project_id": string | null,"status": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"position"?: number,"priority"?: number,"project_id"?: string | null,"status"?: string,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"position"?: number,"priority"?: number,"project_id"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"web_items": {
                  Row: {
                    "excerpt": string | null,"fetched_at": string,"id": string,"is_demo": boolean,"is_read": boolean,"is_saved": boolean,"published_at": string | null,"source_id": string,"summary": string | null,"title": string,"url": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "excerpt"?: string | null,"fetched_at"?: string,"id"?: string,"is_demo"?: boolean,"is_read"?: boolean,"is_saved"?: boolean,"published_at"?: string | null,"source_id": string,"summary"?: string | null,"title": string,"url": string,"user_id": string
                  }
                  Update: {
                    "excerpt"?: string | null,"fetched_at"?: string,"id"?: string,"is_demo"?: boolean,"is_read"?: boolean,"is_saved"?: boolean,"published_at"?: string | null,"source_id"?: string,"summary"?: string | null,"title"?: string,"url"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "web_items_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "web_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"web_sources": {
                  Row: {
                    "category": string | null,"created_at": string,"feed_url": string | null,"fetch_enabled": boolean,"id": string,"is_demo": boolean,"is_favorite": boolean,"kind": string,"last_fetched_at": string | null,"name": string,"url": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"created_at"?: string,"feed_url"?: string | null,"fetch_enabled"?: boolean,"id"?: string,"is_demo"?: boolean,"is_favorite"?: boolean,"kind"?: string,"last_fetched_at"?: string | null,"name": string,"url": string,"user_id"?: string
                  }
                  Update: {
                    "category"?: string | null,"created_at"?: string,"feed_url"?: string | null,"fetch_enabled"?: boolean,"id"?: string,"is_demo"?: boolean,"is_favorite"?: boolean,"kind"?: string,"last_fetched_at"?: string | null,"name"?: string,"url"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "v_running_monthly": {
                  Row: {
                    "avg_hr": number | null,"km": number | null,"load": number | null,"month_start": string | null,"moving_time_s": number | null,"pace_s_per_km": number | null,"runs": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_running_weekly": {
                  Row: {
                    "avg_hr": number | null,"elevation_m": number | null,"km": number | null,"load": number | null,"moving_time_s": number | null,"pace_s_per_km": number | null,"runs": number | null,"user_id": string,"week_start": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_tasks_pending": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"due_date": string | null,"id": string,"is_demo": boolean,"notes": string | null,"overdue": boolean | null,"position": number,"priority": number,"project_id": string | null,"project_name": string | null,"status": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                }
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
