import { ItemStatus, MovementType, OrderStatus, RequestStatus } from "@/types/inventory";
import type {
  Category,
  InventoryRequest,
  Item,
  Location,
  PurchaseOrder,
  PurchaseOrderItem,
  RequestItem,
  StockMovement,
  Supplier,
} from "@/types/inventory";
import type { Database, Json } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];

export type DbCategory = Tables["categories"]["Row"];
export type DbSupplier = Tables["suppliers"]["Row"];
export type DbLocation = Tables["locations"]["Row"];
export type DbItem = Tables["items"]["Row"];
export type DbMovement = Tables["stock_movements"]["Row"];
export type DbPurchaseOrder = Tables["purchase_orders"]["Row"] & {
  purchase_order_items?: Tables["purchase_order_items"]["Row"][];
};
export type DbInventoryRequest = Tables["inventory_requests"]["Row"] & {
  request_items?: Tables["request_items"]["Row"][];
};

function numberFromDb(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

function objectFromJson(value: Json): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      result[key] = val;
    }
  }
  return result;
}

export function mapCategory(row: DbCategory): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export function toCategoryInsert(category: Category): Tables["categories"]["Insert"] {
  return {
    id: category.id,
    name: category.name,
    description: category.description || null,
    parent_id: category.parentId,
    created_at: category.createdAt,
    updated_at: category.updatedAt,
  };
}

export function toCategoryUpdate(updates: Partial<Category>): Tables["categories"]["Update"] {
  return {
    name: updates.name,
    description: updates.description,
    parent_id: updates.parentId,
    updated_at: updates.updatedAt,
  };
}

export function mapSupplier(row: DbSupplier): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_person ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    leadTimeDays: row.lead_time_days ?? 0,
    rating: 4,
    isActive: true,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSupplierInsert(supplier: Supplier): Tables["suppliers"]["Insert"] {
  return {
    id: supplier.id,
    name: supplier.name,
    contact_person: supplier.contactName || null,
    email: supplier.email || null,
    phone: supplier.phone || null,
    address: supplier.address || null,
    notes: supplier.notes || null,
    lead_time_days: supplier.leadTimeDays,
    created_at: supplier.createdAt,
    updated_at: supplier.updatedAt,
  };
}

export function toSupplierUpdate(updates: Partial<Supplier>): Tables["suppliers"]["Update"] {
  return {
    name: updates.name,
    contact_person: updates.contactName,
    email: updates.email,
    phone: updates.phone,
    address: updates.address,
    notes: updates.notes,
    lead_time_days: updates.leadTimeDays,
    updated_at: updates.updatedAt,
  };
}

export function mapLocation(row: DbLocation): Location {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    street: "",
    building: "",
    floor: "",
    roomNumber: "",
    branchManager: "",
    isActive: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    type: "warehouse",
    parentId: row.parent_id,
    address: "",
  };
}

export function toLocationInsert(location: Location): Tables["locations"]["Insert"] {
  return {
    id: location.id,
    name: location.name,
    parent_id: location.parentId,
    description: location.description || null,
    created_at: location.createdAt,
    updated_at: location.updatedAt,
  };
}

export function toLocationUpdate(updates: Partial<Location>): Tables["locations"]["Update"] {
  return {
    name: updates.name,
    parent_id: updates.parentId,
    description: updates.description,
    updated_at: updates.updatedAt,
  };
}

export function mapItem(row: DbItem): Item {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    description: row.description ?? "",
    categoryId: row.category_id,
    status: row.status as ItemStatus,
    unit: row.unit_of_measure ?? "each",
    currentStock: row.quantity_on_hand,
    reorderPoint: row.reorder_threshold,
    reorderQuantity: row.reorder_quantity,
    costPrice: numberFromDb(row.cost_per_unit),
    sellingPrice: numberFromDb(row.sale_price),
    locationId: row.location_id,
    supplierId: row.preferred_supplier_id,
    imageUrl: row.image_url,
    customFields: objectFromJson(row.custom_fields),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toItemInsert(item: Item): Tables["items"]["Insert"] {
  return {
    id: item.id,
    name: item.name,
    description: item.description || null,
    image_url: item.imageUrl,
    sku: item.sku,
    barcode: item.barcode,
    category_id: item.categoryId,
    unit_of_measure: item.unit,
    quantity_on_hand: item.currentStock,
    reorder_threshold: item.reorderPoint,
    reorder_quantity: item.reorderQuantity,
    preferred_supplier_id: item.supplierId,
    cost_per_unit: item.costPrice,
    sale_price: item.sellingPrice,
    location_id: item.locationId,
    status: item.status,
    custom_fields: item.customFields as Json | undefined,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function toItemUpdate(updates: Partial<Item>): Tables["items"]["Update"] {
  return {
    name: updates.name,
    description: updates.description,
    image_url: updates.imageUrl,
    sku: updates.sku,
    barcode: updates.barcode,
    category_id: updates.categoryId,
    unit_of_measure: updates.unit,
    quantity_on_hand: updates.currentStock,
    reorder_threshold: updates.reorderPoint,
    reorder_quantity: updates.reorderQuantity,
    preferred_supplier_id: updates.supplierId,
    cost_per_unit: updates.costPrice,
    sale_price: updates.sellingPrice,
    location_id: updates.locationId,
    status: updates.status,
    custom_fields: updates.customFields as Json | undefined,
    updated_at: updates.updatedAt,
  };
}

export function mapMovement(row: DbMovement): StockMovement {
  return {
    id: row.id,
    itemId: row.item_id,
    type: row.movement_type as MovementType,
    quantity: row.quantity,
    fromLocationId: row.from_location_id,
    toLocationId: row.to_location_id,
    reference: row.reference_note ?? "",
    notes: row.reference_note ?? "",
    performedBy: row.performed_by ?? "system",
    createdAt: row.created_at,
  };
}

export function movementDirection(type: MovementType, quantity: number): "in" | "out" {
  if (type === MovementType.Received) return "in";
  if (type === MovementType.Adjusted && quantity >= 0) return "in";
  return "out";
}

export function toMovementInsert(
  movement: StockMovement,
  resultingQuantity: number,
  performedBy: string | null,
): Tables["stock_movements"]["Insert"] {
  return {
    id: movement.id,
    item_id: movement.itemId,
    quantity: movement.quantity,
    direction: movementDirection(movement.type, movement.quantity),
    movement_type: movement.type,
    reference_note: movement.notes || movement.reference || null,
    performed_by: performedBy,
    from_location_id: movement.fromLocationId,
    to_location_id: movement.toLocationId,
    resulting_quantity: resultingQuantity,
    created_at: movement.createdAt,
  };
}

function orderNumber(id: string, createdAt: string): string {
  const y = new Date(createdAt).getFullYear();
  return `PO-${y}-${id.slice(0, 8).toUpperCase()}`;
}

export function mapPurchaseOrder(row: DbPurchaseOrder): PurchaseOrder {
  const items = (row.purchase_order_items ?? []).map(mapPurchaseOrderItem);
  return {
    id: row.id,
    orderNumber: orderNumber(row.id, row.created_at),
    supplierId: row.supplier_id,
    status: row.status as OrderStatus,
    items,
    totalCost: items.reduce((sum, item) => sum + item.quantityOrdered * item.unitCost, 0),
    expectedDelivery: row.expected_delivery_date,
    notes: row.notes ?? "",
    createdBy: row.created_by ?? "system",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPurchaseOrderItem(row: Tables["purchase_order_items"]["Row"]): PurchaseOrderItem {
  return {
    id: row.id,
    purchaseOrderId: row.purchase_order_id,
    itemId: row.item_id,
    quantityOrdered: row.quantity_ordered,
    quantityReceived: row.quantity_received,
    unitCost: numberFromDb(row.unit_cost),
  };
}

export function toPurchaseOrderInsert(
  po: PurchaseOrder,
  createdBy: string | null,
): Tables["purchase_orders"]["Insert"] {
  return {
    id: po.id,
    supplier_id: po.supplierId,
    status: po.status,
    expected_delivery_date: po.expectedDelivery,
    notes: po.notes || null,
    created_by: createdBy,
    created_at: po.createdAt,
    updated_at: po.updatedAt,
  };
}

export function toPurchaseOrderUpdate(updates: Partial<PurchaseOrder>): Tables["purchase_orders"]["Update"] {
  return {
    supplier_id: updates.supplierId,
    status: updates.status,
    expected_delivery_date: updates.expectedDelivery,
    notes: updates.notes,
    updated_at: updates.updatedAt,
  };
}

export function toPurchaseOrderItemInsert(
  item: PurchaseOrderItem,
  purchaseOrderId: string,
): Tables["purchase_order_items"]["Insert"] {
  return {
    id: item.id,
    purchase_order_id: purchaseOrderId,
    item_id: item.itemId,
    quantity_ordered: item.quantityOrdered,
    quantity_received: item.quantityReceived,
    unit_cost: item.unitCost,
  };
}

function requestNumber(id: string, createdAt: string): string {
  const y = new Date(createdAt).getFullYear();
  return `REQ-${y}-${id.slice(0, 8).toUpperCase()}`;
}

export function mapInventoryRequest(row: DbInventoryRequest): InventoryRequest {
  const items = (row.request_items ?? []).map(mapRequestItem);
  return {
    id: row.id,
    requestNumber: requestNumber(row.id, row.created_at),
    title: row.project_reference ?? "Inventory request",
    status: row.status as RequestStatus,
    priority: "normal",
    items,
    requestedBy: row.requested_by,
    approvedBy: row.reviewed_by,
    reason: row.reason ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRequestItem(row: Tables["request_items"]["Row"]): RequestItem {
  return {
    id: row.id,
    requestId: row.request_id,
    itemId: row.item_id,
    quantity: row.quantity,
    notes: "",
  };
}

export function toInventoryRequestInsert(
  request: InventoryRequest,
  requestedBy: string,
): Tables["inventory_requests"]["Insert"] {
  return {
    id: request.id,
    requested_by: requestedBy,
    status: request.status,
    reason: request.reason || null,
    project_reference: request.title || request.requestNumber,
    reviewed_by: request.approvedBy,
    created_at: request.createdAt,
    updated_at: request.updatedAt,
  };
}

export function toInventoryRequestUpdate(
  updates: Partial<InventoryRequest>,
  reviewedBy?: string | null,
): Tables["inventory_requests"]["Update"] {
  return {
    status: updates.status,
    reason: updates.reason,
    project_reference: updates.title,
    reviewed_by: updates.approvedBy ?? reviewedBy,
    reviewed_at: updates.approvedBy || reviewedBy ? new Date().toISOString() : undefined,
    updated_at: updates.updatedAt,
  };
}

export function toRequestItemInsert(item: RequestItem, requestId: string): Tables["request_items"]["Insert"] {
  return {
    id: item.id,
    request_id: requestId,
    item_id: item.itemId,
    quantity: item.quantity,
  };
}
