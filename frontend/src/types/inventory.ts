// ─── Enums ───────────────────────────────────────────────

export enum MovementType {
  Received = "received",
  Shipped = "shipped",
  Adjusted = "adjusted",
  Transferred = "transferred",
}

export enum OrderStatus {
  Draft = "draft",
  Submitted = "submitted",
  Partial = "partial",
  Received = "received",
  Cancelled = "cancelled",
}

export enum RequestStatus {
  Pending = "pending",
  Approved = "approved",
  PartiallyFulfilled = "partially_fulfilled",
  Fulfilled = "fulfilled",
  Declined = "declined",
  Cancelled = "cancelled",
}

export enum ItemStatus {
  Active = "active",
  Discontinued = "discontinued",
  Archived = "archived",
}

export enum UserRoleType {
  Admin = "admin",
  Manager = "manager",
  Staff = "staff",
}

// ─── Interfaces ──────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  fieldType: "text" | "number" | "boolean" | "date" | "select";
  options: string[];
  required: boolean;
  createdAt: string;
}

export interface Item {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string;
  categoryId: string | null;
  status: ItemStatus;
  unit: string;
  initialQuantity?: number;
  currentStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  costPrice: number;
  sellingPrice: number;
  branchId?: string | null;
  locationId?: string | null;
  supplierId: string | null;
  imageUrl: string | null;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type LocationType =
  | "warehouse"
  | "zone"
  | "aisle"
  | "shelf"
  | "bin"
  | "DTF & UV"
  | "PVC Ids"
  | "Large Format";

export interface Branch {
  id: string;
  name: string;
  description: string;
  street?: string;
  building?: string;
  floor?: string;
  roomNumber?: string;
  branchManager?: string;
  receiptTitle?: string;
  phone?: string;
  email?: string;
  contactLine?: string;
  receiptSlogan?: string;
  taxId?: string;
  receiptVerificationBaseUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  type: LocationType;
  parentId: string | null;
  address: string;
}

// Keep for compatibility
export type Location = Branch;


export interface Supplier {
  id: string;
  name: string;
  code?: string;
  category?: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  rating: number;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = "cash" | "card" | "mobile" | "bank_transfer" | "credit";
export type TransactionStatus = "paid" | "partial" | "pending" | "void";

export type LargeFormatSaleSpec = { kind: "large_format"; widthM: number; heightM: number }
export type DigitalPrinterSaleSpec = { kind: "digital_printer"; pages: number }
export type FargoSaleSpec = { kind: "fargo"; sideMode: "single" | "double"; laminated: boolean }
export type AssetSaleCategorySpec = LargeFormatSaleSpec | DigitalPrinterSaleSpec | FargoSaleSpec

export function formatAssetSaleSpec(spec?: AssetSaleCategorySpec | null | undefined): string {
  if (spec == null) return "";
  switch (spec.kind) {
    case "large_format":
      return `${spec.widthM} × ${spec.heightM} m = ${(spec.widthM * spec.heightM).toFixed(2)} m²`;
    case "digital_printer":
      return `${spec.pages} pages`;
    case "fargo": {
      const side = spec.sideMode === "double" ? "Double" : "Single";
      return `${side} side, ${spec.laminated ? "Laminated" : "No lamination"}`;
    }
  }
}

export type AssetCategoryKindForIncome =
  | "large_format"
  | "digital_printer"
  | "fargo"
  | "default";

export function mapKindToIncomeSource(kind: AssetCategoryKindForIncome): string {
  switch (kind) {
    case "fargo":
      return "Badge Print (Fargo)";
    case "large_format":
      return "Large Format";
    case "digital_printer":
      return "Digital Print";
    default:
      return "Linked Sale";
  }
}

export function buildSaleIncomeDescription(
  kind: AssetCategoryKindForIncome,
  lines: SaleItem[],
  _customer?: string,
): string {
  const parts: string[] = [];
  for (const li of lines) {
    const name = li.itemName?.trim() || "Sale item";
    const spec = formatAssetSaleSpec(li.assetCategorySpec);
    const qty = Number(li.quantity ?? 0);
    let part = name;
    if (spec) {
      part += ` — ${spec}`;
    }
    if (kind === "fargo" && qty > 0 && !li.assetCategorySpec) {
      part += ` × ${qty}`;
    } else if (kind === "fargo" && qty > 0) {
      part += ` × ${qty}`;
    }
    parts.push(part);
  }
  return parts.join("; ");
}

export interface SaleItem {
  itemId: string | null;
  itemName: string;
  description?: string | null;
  unitPrice: number;
  quantity: number;
  discount: number;
  vat: number;
  vatRate: number;
  assetId?: string | null;
  assetName?: string | null;
  assetCategory?: string | null;
  assetCategorySpec?: AssetSaleCategorySpec | null;
  lineTotal: number;
}

export interface SaleDetails {
  receiptNumber: string;
  itemName?: string | null;
  description?: string | null;
  unitPrice: number;
  totalAmount: number;
  discount: number;
  vat: number;
  vatRate?: number;
  cumulativeAmount: number;
  deposit: number;
  balance: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  changeDue: number;
  staff: string;
  customerId?: string | null;
  customer: string;
  telephone: string;
  email: string;
  status: TransactionStatus;
  assetId?: string | null;
  assetName?: string | null;
  lineItems?: SaleItem[];
}


export interface StockMovement {
  id: string;
  itemId: string;
  type: MovementType;
  quantity: number;
  fromBranchId?: string | null;
  toBranchId?: string | null;
  fromLocationId: string | null;
  toLocationId: string | null;
  reference: string;
  notes: string;
  performedBy: string;
  createdAt: string;
  sale?: SaleDetails | null;
}


export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  itemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  status: OrderStatus;
  items: PurchaseOrderItem[];
  totalCost: number;
  expectedDelivery: string | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestItem {
  id: string;
  requestId: string;
  itemId: string;
  quantity: number;
  notes: string;
}

export interface InventoryRequest {
  id: string;
  requestNumber: string;
  title: string;
  status: RequestStatus;
  priority: "normal" | "urgent";
  items: RequestItem[];
  requestedBy: string;
  approvedBy: string | null;
  reason: string;
  declineReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | "low_stock"
  | "zero_stock"
  | "po_reminder"
  | "po_overdue"
  | "request_update"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface UserRole {
  id: string;
  userId: string;
  role: UserRoleType;
}
