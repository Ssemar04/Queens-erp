export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          parent_id: string | null;
          description: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          parent_id?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          payment_terms: string | null;
          lead_time_days: number | null;
          min_order_qty: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_person?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          payment_terms?: string | null;
          lead_time_days?: number | null;
          min_order_qty?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
      };
      locations: {
        Row: {
          id: string;
          name: string;
          parent_id: string | null;
          description: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          parent_id?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["locations"]["Insert"]>;
      };
      items: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          sku: string;
          barcode: string | null;
          category_id: string | null;
          tags: string[] | null;
          unit_of_measure: string | null;
          quantity_on_hand: number;
          reorder_threshold: number;
          reorder_quantity: number;
          preferred_supplier_id: string | null;
          cost_per_unit: number | string | null;
          sale_price: number | string | null;
          location_id: string | null;
          status: "active" | "discontinued" | "archived";
          custom_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          sku: string;
          barcode?: string | null;
          category_id?: string | null;
          tags?: string[] | null;
          unit_of_measure?: string | null;
          quantity_on_hand?: number;
          reorder_threshold?: number;
          reorder_quantity?: number;
          preferred_supplier_id?: string | null;
          cost_per_unit?: number | null;
          sale_price?: number | null;
          location_id?: string | null;
          status?: "active" | "discontinued" | "archived";
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["items"]["Insert"]>;
      };
      stock_movements: {
        Row: {
          id: string;
          item_id: string;
          quantity: number;
          direction: "in" | "out";
          movement_type: "received" | "shipped" | "adjusted" | "transferred";
          reference_note: string | null;
          performed_by: string | null;
          from_location_id: string | null;
          to_location_id: string | null;
          resulting_quantity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          quantity: number;
          direction: "in" | "out";
          movement_type: "received" | "shipped" | "adjusted" | "transferred";
          reference_note?: string | null;
          performed_by?: string | null;
          from_location_id?: string | null;
          to_location_id?: string | null;
          resulting_quantity: number;
          created_at?: string;
        };
        Update: never;
      };
      purchase_orders: {
        Row: {
          id: string;
          supplier_id: string;
          status: "draft" | "submitted" | "partial" | "received" | "cancelled";
          expected_delivery_date: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          status?: "draft" | "submitted" | "partial" | "received" | "cancelled";
          expected_delivery_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_orders"]["Insert"]>;
      };
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          item_id: string;
          quantity_ordered: number;
          quantity_received: number;
          unit_cost: number | string | null;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          item_id: string;
          quantity_ordered: number;
          quantity_received?: number;
          unit_cost?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_order_items"]["Insert"]>;
      };
      inventory_requests: {
        Row: {
          id: string;
          requested_by: string;
          status: "pending" | "approved" | "partially_fulfilled" | "fulfilled" | "declined" | "cancelled";
          reason: string | null;
          project_reference: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requested_by: string;
          status?: "pending" | "approved" | "partially_fulfilled" | "fulfilled" | "declined" | "cancelled";
          reason?: string | null;
          project_reference?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_requests"]["Insert"]>;
      };
      request_items: {
        Row: {
          id: string;
          request_id: string;
          item_id: string;
          quantity: number;
        };
        Insert: {
          id?: string;
          request_id: string;
          item_id: string;
          quantity: number;
        };
        Update: Partial<Database["public"]["Tables"]["request_items"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: "admin" | "manager" | "staff";
    };
  };
}
