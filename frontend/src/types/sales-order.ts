export type OrderStatus =
  | "draft"
  | "advertised"
  | "submitted"
  | "submitted_egp"
  | "bid_opened"
  | "tech_eval"
  | "fin_eval"
  | "evaluated"
  | "contracts_cmte"
  | "awarded"
  | "successful"
  | "contract_signed"
  | "complete"
  | "declined";

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
  assetId?: string;
  assetCategory?: string;
  assetCategorySpec?: AssetCategorySpec | null;
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

export type LargeFormatSpec = { kind: "large_format"; widthM: number; heightM: number }
export type DigitalPrinterSpec = { kind: "digital_printer"; pages: number }
export type FargoSpec = { kind: "fargo"; sideMode: "single" | "double"; laminated: boolean }
export type AssetCategorySpec = LargeFormatSpec | DigitalPrinterSpec | FargoSpec

export type ProcurementMethod =
  | "open_domestic"
  | "open_international"
  | "restricted_bidding"
  | "request_for_quotation"
  | "micro_procurement";

export type ComplianceStatus = "valid" | "pending" | "expired" | "not_required";

export interface PpdaComplianceDetails {
  procurementMethod?: ProcurementMethod;
  bidSecurityRequired?: boolean;
  bidSecurityAmount?: number;
  bidSecurityValidityDays?: number;
  bidSecurityIssuer?: string;
  isUgandanLocalContent?: boolean;
  isMsmeReservationScheme?: boolean;
  bebNoticeDate?: string;
  administrativeReviewStandstillDays?: number;
  uraTaxClearanceStatus?: "valid" | "pending" | "expired";
  nssfClearanceStatus?: ComplianceStatus;
  ppdaRopRegistered?: boolean;

  uraTccStatus?: ComplianceStatus;
  ppdaCertStatus?: ComplianceStatus;
  ursbStatus?: ComplianceStatus;
  auditedAccountsStatus?: ComplianceStatus;
  bidSecurityStatus?: ComplianceStatus;
  prnProofStatus?: ComplianceStatus;
  declarationsStatus?: ComplianceStatus;

  bidOpenedAt?: string;
  techEvaluatedAt?: string;
  finEvaluatedAt?: string;
  awardedAt?: string;
  contractSignedAt?: string;
  standstillEndDate?: string;

  evaluationCommittee?: string[];
  contractsCommittee?: string[];

  domesticContentPct?: number;
  preferenceMarginPct?: number;
  evaluatedPriceAdjusted?: number;
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
  ppdaCompliance?: PpdaComplianceDetails;
  createdAt: string;
  updatedAt?: string;
}

export function formatAssetSpec(spec?: AssetCategorySpec | null | undefined): string {
  if (spec == null) return "";
  switch (spec.kind) {
    case "large_format":
      return `${spec.widthM} × ${spec.heightM} m = ${(spec.widthM * spec.heightM).toFixed(2)} m²`;
    case "digital_printer":
      return `${spec.pages} pages`;
    case "fargo":
      const side = spec.sideMode === "double" ? "Double" : "Single";
      return `${side} side${spec.laminated ? ", Laminated" : ""}`;
  }
}
