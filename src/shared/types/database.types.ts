export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemberRole = "owner" | "treasurer" | "member" | "viewer";
export type MemberStatus = "pending_approval" | "active" | "suspended";
export type DepositStatus = "pending" | "processing" | "verified" | "rejected" | "cancelled";
export type TransactionType = "deposit" | "refund" | "adjustment";
export type LedgerEntryType = "credit" | "debit";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          line_user_id: string;
          display_name: string;
          picture_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          line_user_id: string;
          display_name: string;
          picture_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          line_user_id?: string;
          display_name?: string;
          picture_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          line_group_id: string;
          name: string;
          target_amount: number;
          owner_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          line_group_id: string;
          name: string;
          target_amount?: number;
          owner_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          line_group_id?: string;
          name?: string;
          target_amount?: number;
          owner_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          role: MemberRole;
          status: MemberStatus;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          role: MemberRole;
          status: MemberStatus;
          joined_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          user_id?: string;
          role?: MemberRole;
          status?: MemberStatus;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      deposits: {
        Row: {
          id: string;
          group_id: string;
          member_id: string;
          slip_storage_path: string;
          raw_ocr_text: string | null;
          detected_amount: number | null;
          transfer_date: string | null;
          bank_reference: string | null;
          status: DepositStatus;
          click_count: number;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          member_id: string;
          slip_storage_path: string;
          raw_ocr_text?: string | null;
          detected_amount?: number | null;
          transfer_date?: string | null;
          bank_reference?: string | null;
          status?: DepositStatus;
          click_count?: number;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          member_id?: string;
          slip_storage_path?: string;
          raw_ocr_text?: string | null;
          detected_amount?: number | null;
          transfer_date?: string | null;
          bank_reference?: string | null;
          status?: DepositStatus;
          click_count?: number;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposits_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposits_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "group_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposits_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      transactions: {
        Row: {
          id: string;
          group_id: string;
          deposit_id: string;
          amount: number;
          transaction_type: TransactionType;
          confirmed_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          deposit_id: string;
          amount: number;
          transaction_type?: TransactionType;
          confirmed_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          deposit_id?: string;
          amount?: number;
          transaction_type?: TransactionType;
          confirmed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_deposit_id_fkey";
            columns: ["deposit_id"];
            isOneToOne: true;
            referencedRelation: "deposits";
            referencedColumns: ["id"];
          }
        ];
      };
      ledger_entries: {
        Row: {
          id: string;
          transaction_id: string;
          group_id: string;
          member_id: string;
          entry_type: LedgerEntryType;
          amount: number;
          running_balance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          group_id: string;
          member_id: string;
          entry_type: LedgerEntryType;
          amount: number;
          running_balance: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          group_id?: string;
          member_id?: string;
          entry_type?: LedgerEntryType;
          amount?: number;
          running_balance?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "group_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          group_id: string | null;
          actor_id: string | null;
          action: string;
          entity_name: string | null;
          entity_id: string | null;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id?: string | null;
          actor_id?: string | null;
          action: string;
          entity_name?: string | null;
          entity_id?: string | null;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string | null;
          actor_id?: string | null;
          action?: string;
          entity_name?: string | null;
          entity_id?: string | null;
          payload?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          }
        ];
      };
      webhook_events: {
        Row: {
          event_id: string;
          event_type: string;
          received_at: string;
          payload: Json | null;
        };
        Insert: {
          event_id: string;
          event_type: string;
          received_at?: string;
          payload?: Json | null;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          received_at?: string;
          payload?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
