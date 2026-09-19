export type OrderStatus = "draft" | "confirmed" | "in_progress" | "delivered" | "cancelled";

export interface QuotationAttachment {
  name: string;
  type: string;
  dataUrl: string;
  size: number;
}

export interface OrderItem {
  id: string;
  itemId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesOrder {
  id: string;
  lpoNumber: string;
  dateReceived: string;
  customerName: string;
  customerId?: string;
  customerQuotation?: string;
  quotationAttachment?: QuotationAttachment | null;
  dateToBeDelivered: string;
  handledBy: string;
  employeeId?: string;
  status: OrderStatus;
  amount: number;
  items?: OrderItem[];
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
}
