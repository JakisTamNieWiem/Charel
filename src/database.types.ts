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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      Characters: {
        Row: {
          avatar: string | null
          created_at: string
          description: string
          groupId: string | null
          id: string
          name: string
          ownerId: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          description?: string
          groupId?: string | null
          id?: string
          name: string
          ownerId?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          description?: string
          groupId?: string | null
          id?: string
          name?: string
          ownerId?: string
        }
        Relationships: []
      }
      Chats: {
        Row: {
          cover: string | null
          created_at: string
          id: string
          isGroup: boolean | null
          lastMessageAt: string | null
          name: string
          ownerId: string
        }
        Insert: {
          cover?: string | null
          created_at?: string
          id?: string
          isGroup?: boolean | null
          lastMessageAt?: string | null
          name?: string
          ownerId?: string
        }
        Update: {
          cover?: string | null
          created_at?: string
          id?: string
          isGroup?: boolean | null
          lastMessageAt?: string | null
          name?: string
          ownerId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Chats_ownerId_fkey"
            columns: ["ownerId"]
            isOneToOne: false
            referencedRelation: "Profiles"
            referencedColumns: ["userId"]
          },
        ]
      }
      ChatsMembers: {
        Row: {
          chatId: string
          created_at: string
          lastReadAt: string | null
          userId: string
        }
        Insert: {
          chatId: string
          created_at?: string
          lastReadAt?: string | null
          userId: string
        }
        Update: {
          chatId?: string
          created_at?: string
          lastReadAt?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ChatsMembers_chatId_fkey"
            columns: ["chatId"]
            isOneToOne: false
            referencedRelation: "Chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ChatsMembers_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profiles"
            referencedColumns: ["userId"]
          },
        ]
      }
      Groups: {
        Row: {
          color: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      Messages: {
        Row: {
          characterId: string
          chat: string
          content: string
          created_at: string
          id: number
          userId: string
        }
        Insert: {
          characterId: string
          chat: string
          content: string
          created_at?: string
          id?: number
          userId: string
        }
        Update: {
          characterId?: string
          chat?: string
          content?: string
          created_at?: string
          id?: number
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Messages_characterId_fkey"
            columns: ["characterId"]
            isOneToOne: false
            referencedRelation: "Characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Messages_chat_fkey"
            columns: ["chat"]
            isOneToOne: false
            referencedRelation: "Chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Messages_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profiles"
            referencedColumns: ["userId"]
          },
        ]
      }
      Profiles: {
        Row: {
          role: string
          status: string
          userId: string
        }
        Insert: {
          role?: string
          status?: string
          userId?: string
        }
        Update: {
          role?: string
          status?: string
          userId?: string
        }
        Relationships: []
      }
      Relationships: {
        Row: {
          created_at: string
          description: string
          fromId: string
          id: string
          toId: string
          typeId: string
          value: number | null
        }
        Insert: {
          created_at?: string
          description?: string
          fromId: string
          id?: string
          toId: string
          typeId: string
          value?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          fromId?: string
          id?: string
          toId?: string
          typeId?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "Relationships_fromId_fkey"
            columns: ["fromId"]
            isOneToOne: false
            referencedRelation: "Characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Relationships_toId_fkey"
            columns: ["toId"]
            isOneToOne: false
            referencedRelation: "Characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Relationships_typeId_fkey"
            columns: ["typeId"]
            isOneToOne: false
            referencedRelation: "RelationshipTypes"
            referencedColumns: ["id"]
          },
        ]
      }
      RelationshipTypes: {
        Row: {
          color: string
          description: string
          id: string
          label: string
          value: number
        }
        Insert: {
          color?: string
          description?: string
          id?: string
          label?: string
          value?: number
        }
        Update: {
          color?: string
          description?: string
          id?: string
          label?: string
          value?: number
        }
        Relationships: []
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
