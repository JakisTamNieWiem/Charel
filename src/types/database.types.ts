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
          phoneNumber: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          description?: string
          groupId?: string | null
          id?: string
          name: string
          ownerId?: string
          phoneNumber?: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          description?: string
          groupId?: string | null
          id?: string
          name?: string
          ownerId?: string
          phoneNumber?: string
          status?: string
          updated_at?: string
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
          characterId: string
          chatId: string
          created_at: string
          lastReadAt: string | null
          userId: string
        }
        Insert: {
          characterId: string
          chatId: string
          created_at?: string
          lastReadAt?: string | null
          userId: string
        }
        Update: {
          characterId?: string
          chatId?: string
          created_at?: string
          lastReadAt?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ChatsMembers_characterId_fkey"
            columns: ["characterId"]
            isOneToOne: false
            referencedRelation: "Characters"
            referencedColumns: ["id"]
          },
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
      Contacts: {
        Row: {
          created_at: string
          fromId: string
          nickname: string | null
          toId: string
        }
        Insert: {
          created_at?: string
          fromId: string
          nickname?: string | null
          toId: string
        }
        Update: {
          created_at?: string
          fromId?: string
          nickname?: string | null
          toId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Contacts_fromId_fkey"
            columns: ["fromId"]
            isOneToOne: false
            referencedRelation: "Characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Contacts_toId_fkey"
            columns: ["toId"]
            isOneToOne: false
            referencedRelation: "Characters"
            referencedColumns: ["id"]
          },
        ]
      }
      Groups: {
        Row: {
          color: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      Messages: {
        Row: {
          characterId: string
          chat: string
          content: string
          created_at: string
          id: string
          userId: string
        }
        Insert: {
          characterId: string
          chat: string
          content: string
          created_at?: string
          id?: string
          userId: string
        }
        Update: {
          characterId?: string
          chat?: string
          content?: string
          created_at?: string
          id?: string
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
          displayName: string | null
          role: string
          status: string
          userId: string
        }
        Insert: {
          displayName?: string | null
          role?: string
          status?: string
          userId?: string
        }
        Update: {
          displayName?: string | null
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
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          description?: string
          fromId: string
          id?: string
          toId: string
          typeId: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          fromId?: string
          id?: string
          toId?: string
          typeId?: string
          updated_at?: string
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
          updated_at: string
          value: number
        }
        Insert: {
          color?: string
          description?: string
          id?: string
          label?: string
          updated_at?: string
          value?: number
        }
        Update: {
          color?: string
          description?: string
          id?: string
          label?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      tabletop_asset_publications: {
        Row: {
          asset_id: string
          campaign_id: string
          created_at: string
          id: string
          published_by: string
          room_id: string | null
        }
        Insert: {
          asset_id: string
          campaign_id: string
          created_at?: string
          id?: string
          published_by: string
          room_id?: string | null
        }
        Update: {
          asset_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          published_by?: string
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tabletop_asset_publications_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "tabletop_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabletop_asset_publications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "tabletop_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabletop_asset_publications_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "tabletop_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      tabletop_assets: {
        Row: {
          created_at: string
          hash: string
          height: number
          id: string
          mime_type: string
          name: string
          owner_user_id: string
          storage_path: string
          updated_at: string
          visibility: string
          width: number
        }
        Insert: {
          created_at?: string
          hash: string
          height: number
          id?: string
          mime_type: string
          name: string
          owner_user_id: string
          storage_path: string
          updated_at?: string
          visibility?: string
          width: number
        }
        Update: {
          created_at?: string
          hash?: string
          height?: number
          id?: string
          mime_type?: string
          name?: string
          owner_user_id?: string
          storage_path?: string
          updated_at?: string
          visibility?: string
          width?: number
        }
        Relationships: []
      }
      tabletop_campaign_members: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabletop_campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "tabletop_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      tabletop_campaigns: {
        Row: {
          active_room_id: string | null
          created_at: string
          default_room_id: string | null
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          active_room_id?: string | null
          created_at?: string
          default_room_id?: string | null
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          active_room_id?: string | null
          created_at?: string
          default_room_id?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tabletop_room_sessions: {
        Row: {
          campaign_id: string
          current_room_id: string | null
          display_name: string | null
          follow_gm: boolean
          id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          current_room_id?: string | null
          display_name?: string | null
          follow_gm?: boolean
          id?: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          current_room_id?: string | null
          display_name?: string | null
          follow_gm?: boolean
          id?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabletop_room_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "tabletop_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabletop_room_sessions_current_room_id_fkey"
            columns: ["current_room_id"]
            isOneToOne: false
            referencedRelation: "tabletop_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      tabletop_rooms: {
        Row: {
          background_color: string
          campaign_id: string
          created_at: string
          grid_mode: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          background_color?: string
          campaign_id: string
          created_at?: string
          grid_mode?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          background_color?: string
          campaign_id?: string
          created_at?: string
          grid_mode?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabletop_rooms_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "tabletop_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      tabletop_scene_entities: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string
          entity_kind: string
          height: number
          hidden: boolean
          id: string
          layer: string
          locked: boolean
          payload: Json
          revision: number
          room_id: string
          rotation: number
          updated_at: string
          updated_by: string
          width: number
          x: number
          y: number
          z_index: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by: string
          entity_kind: string
          height?: number
          hidden?: boolean
          id?: string
          layer?: string
          locked?: boolean
          payload?: Json
          revision?: number
          room_id: string
          rotation?: number
          updated_at?: string
          updated_by: string
          width?: number
          x?: number
          y?: number
          z_index?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string
          entity_kind?: string
          height?: number
          hidden?: boolean
          id?: string
          layer?: string
          locked?: boolean
          payload?: Json
          revision?: number
          room_id?: string
          rotation?: number
          updated_at?: string
          updated_by?: string
          width?: number
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "tabletop_scene_entities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "tabletop_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabletop_scene_entities_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "tabletop_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_character_limit: { Args: never; Returns: boolean }
      generate_unique_phone: { Args: never; Returns: string }
      is_tabletop_campaign_member: {
        Args: { target_campaign_id: string }
        Returns: boolean
      }
      is_tabletop_campaign_owner: {
        Args: { target_campaign_id: string }
        Returns: boolean
      }
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
