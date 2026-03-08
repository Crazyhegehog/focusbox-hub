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
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      bundle_components: {
        Row: {
          bundle_id: string
          id: string
          inventory_item_id: string
          quantity: number
        }
        Insert: {
          bundle_id: string
          id?: string
          inventory_item_id: string
          quantity?: number
        }
        Update: {
          bundle_id?: string
          id?: string
          inventory_item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_components_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_components_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          event_date: string
          id: string
          related_todo_id: string | null
          start_time: string | null
          title: string
          type: Database["public"]["Enums"]["calendar_event_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          event_date: string
          id?: string
          related_todo_id?: string | null
          start_time?: string | null
          title: string
          type?: Database["public"]["Enums"]["calendar_event_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          event_date?: string
          id?: string
          related_todo_id?: string | null
          start_time?: string | null
          title?: string
          type?: Database["public"]["Enums"]["calendar_event_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_history: {
        Row: {
          change_amount: number
          changed_by: string | null
          created_at: string
          id: string
          inventory_item_id: string
          reason: string | null
        }
        Insert: {
          change_amount: number
          changed_by?: string | null
          created_at?: string
          id?: string
          inventory_item_id: string
          reason?: string | null
        }
        Update: {
          change_amount?: number
          changed_by?: string | null
          created_at?: string
          id?: string
          inventory_item_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_history_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          current_stock: number
          description: string | null
          id: string
          name: string
          reorder_threshold: number
          storage_location: string | null
          supplier_contact: string | null
          supplier_name: string | null
          supplier_url: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          name: string
          reorder_threshold?: number
          storage_location?: string | null
          supplier_contact?: string | null
          supplier_name?: string | null
          supplier_url?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          name?: string
          reorder_threshold?: number
          storage_location?: string | null
          supplier_contact?: string | null
          supplier_name?: string | null
          supplier_url?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          color: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          title: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          color?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string | null
          order_id: string
          product_name: string
          quantity: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          order_id: string
          product_name?: string
          quantity?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          order_id?: string
          product_name?: string
          quantity?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_total: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          phone_size: string
          quantity: number | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_state: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_metadata: Json | null
          stripe_payment_intent: string | null
          stripe_product_name: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount_total?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          phone_size?: string
          quantity?: number | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_metadata?: Json | null
          stripe_payment_intent?: string | null
          stripe_product_name?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_total?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          phone_size?: string
          quantity?: number | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_metadata?: Json | null
          stripe_payment_intent?: string | null
          stripe_product_name?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          last_post_date: string | null
          name: string
          signed_date: string | null
          status: Database["public"]["Enums"]["partner_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          last_post_date?: string | null
          name?: string
          signed_date?: string | null
          status?: Database["public"]["Enums"]["partner_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          last_post_date?: string | null
          name?: string
          signed_date?: string | null
          status?: Database["public"]["Enums"]["partner_status"]
        }
        Relationships: []
      }
      product_bundles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          role_title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role_title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role_title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_subtasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          task_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          task_id: string
          title: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_participants: {
        Row: {
          accepted: boolean
          accepted_at: string | null
          id: string
          todo_id: string
          user_id: string
        }
        Insert: {
          accepted?: boolean
          accepted_at?: string | null
          id?: string
          todo_id: string
          user_id: string
        }
        Update: {
          accepted?: boolean
          accepted_at?: string | null
          id?: string
          todo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_participants_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      todo_subtasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          title: string
          todo_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          title: string
          todo_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          title?: string
          todo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_subtasks_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          project_id: string | null
          responsible_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["todo_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string | null
          responsible_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["todo_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string | null
          responsible_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["todo_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "todo_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
    }
    Enums: {
      app_role: "admin" | "manager" | "member"
      calendar_event_type:
        | "meeting"
        | "deadline"
        | "reminder"
        | "personal"
        | "other"
      fulfillment_status: "not_started" | "preparing" | "shipped" | "delivered"
      order_status: "pending" | "packaged" | "sent"
      partner_status: "discussion" | "no_answer" | "sent_contract" | "signed"
      task_priority: "high" | "medium" | "low"
      task_status: "not_started" | "in_progress" | "completed"
      todo_status: "not_started" | "in_progress" | "completed"
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
      app_role: ["admin", "manager", "member"],
      calendar_event_type: [
        "meeting",
        "deadline",
        "reminder",
        "personal",
        "other",
      ],
      fulfillment_status: ["not_started", "preparing", "shipped", "delivered"],
      order_status: ["pending", "packaged", "sent"],
      partner_status: ["discussion", "no_answer", "sent_contract", "signed"],
      task_priority: ["high", "medium", "low"],
      task_status: ["not_started", "in_progress", "completed"],
      todo_status: ["not_started", "in_progress", "completed"],
    },
  },
} as const
