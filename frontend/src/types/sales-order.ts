export type OrderStatus = "submitted" | "declined" | "successful";

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

export type SalesDocumentType =
  | "lpo_signed"
  | "tax_invoice_efris"
  | "delivery_grn"
  | "waybill_transport"
  | "tcc_ura"
  | "business_registration"
  | "supplier_quotation"
  | "payment_receipt"
  | "inspection_quality"
  | "insurance_transit";

export interface SalesOrderDocument {
  id: string;
  salesOrderId: string;
  documentType: SalesDocumentType | string;
  title: string;
  description: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  updatedAt?: string;
}

export interface OrderComplaint {
  id: string;
  summary: string;
  raisedBy?: string;
  raisedAt: string;
  resolved: boolean;
  resolutionNotes?: string;
}

export interface LpoAccountDetails {
  companyAddress?: string;
  companyTin?: string;
  companyLocation?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  submissionDeadline?: string;
  feeAmount?: number;
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
  declineReason?: string | null;
  complaints?: OrderComplaint[];
  requiredDocumentTypes?: string[];
  accountDetails?: LpoAccountDetails;
  isLpoAccount?: boolean;
  createdAt: string;
  updatedAt?: string;
}
