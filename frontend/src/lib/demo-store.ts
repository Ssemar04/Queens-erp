import type {
  Category,
  CustomFieldDefinition,
  InventoryRequest,
  Item,
  Location,
  Notification,
  PurchaseOrder,
  StockMovement,
  Supplier,
} from "@/types/inventory";

export interface ItemFilters {
  categoryId?: string;
  supplierId?: string;
  locationId?: string;
  status?: string;
  search?: string;
}

export interface StockSummary {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
  status: "active" | "inactive" | "pending";
  joinedAt: string;
}

const EMPTY_REORDER_DEFAULTS = {
  reorderPoint: 0,
  leadTimeDays: 0,
  safetyMultiplier: 0,
  orderQuantity: 0,
};

const EMPTY_NOTIFICATION_PREFS = {
  low_stock: false,
  zero_stock: false,
  po_reminder: false,
  po_overdue: false,
  request_updates: false,
};

export class DemoStore {
  getVersion() {
    return 0;
  }

  reset() {}

  getUsers(): DemoUser[] {
    return [];
  }

  addUser(_user: DemoUser): void {}

  updateUser(_id: string, _updates: Partial<DemoUser>): void {}

  getAdminCount(): number {
    return 0;
  }

  getCategories(): Category[] {
    return [];
  }

  createCategory(category: Category): Category {
    return category;
  }

  updateCategory(_id: string, _updates: Partial<Category>): Category | undefined {
    return undefined;
  }

  deleteCategory(_id: string): boolean {
    return false;
  }

  getReorderDefaults() {
    return { ...EMPTY_REORDER_DEFAULTS };
  }

  setReorderDefaults(_defaults: typeof EMPTY_REORDER_DEFAULTS): void {}

  getCustomFieldDefs(): CustomFieldDefinition[] {
    return [];
  }

  addCustomFieldDef(_def: CustomFieldDefinition): void {}

  updateCustomFieldDef(_id: string, _updates: Partial<CustomFieldDefinition>): void {}

  deleteCustomFieldDef(_id: string): void {}

  reorderCustomFieldDefs(_ids: string[]): void {}

  getItems(_filters?: ItemFilters): Item[] {
    return [];
  }

  getItemById(_id: string): Item | undefined {
    return undefined;
  }

  createItem(item: Item): Item {
    return item;
  }

  updateItem(_id: string, _updates: Partial<Item>): Item | undefined {
    return undefined;
  }

  deleteItem(_id: string): boolean {
    return false;
  }

  getStockSummary(): StockSummary {
    return { total: 0, inStock: 0, lowStock: 0, outOfStock: 0 };
  }

  getMovements(): StockMovement[] {
    return [];
  }

  getRecentMovements(_limit: number): StockMovement[] {
    return [];
  }

  createMovement(movement: StockMovement): StockMovement {
    return movement;
  }

  getSuppliers(): Supplier[] {
    return [];
  }

  getSupplierById(_id: string): Supplier | undefined {
    return undefined;
  }

  createSupplier(supplier: Supplier): Supplier {
    return supplier;
  }

  updateSupplier(_id: string, _updates: Partial<Supplier>): Supplier | undefined {
    return undefined;
  }

  deleteSupplier(_id: string): boolean {
    return false;
  }

  getLocations(): Location[] {
    return [];
  }

  getLocationById(_id: string): Location | undefined {
    return undefined;
  }

  createLocation(location: Location): Location {
    return location;
  }

  updateLocation(_id: string, _updates: Partial<Location>): Location | undefined {
    return undefined;
  }

  deleteLocation(_id: string): boolean {
    return false;
  }

  getPurchaseOrders(): PurchaseOrder[] {
    return [];
  }

  getPurchaseOrderById(_id: string): PurchaseOrder | undefined {
    return undefined;
  }

  createPurchaseOrder(po: PurchaseOrder): PurchaseOrder {
    return po;
  }

  updatePurchaseOrder(_id: string, _updates: Partial<PurchaseOrder>): PurchaseOrder | undefined {
    return undefined;
  }

  deletePurchaseOrder(_id: string): boolean {
    return false;
  }

  getRequests(): InventoryRequest[] {
    return [];
  }

  getRequestById(_id: string): InventoryRequest | undefined {
    return undefined;
  }

  createRequest(request: InventoryRequest): InventoryRequest {
    return request;
  }

  updateRequest(_id: string, _updates: Partial<InventoryRequest>): InventoryRequest | undefined {
    return undefined;
  }

  getNotifications(): Notification[] {
    return [];
  }

  getUnreadCount(): number {
    return 0;
  }

  markAsRead(_id: string): void {}

  markAllAsRead(): void {}

  dismissNotification(_id: string): void {}

  addNotification(_notification: Notification): void {}

  getNotificationPrefs() {
    return { ...EMPTY_NOTIFICATION_PREFS };
  }

  setNotificationPrefs(_prefs: typeof EMPTY_NOTIFICATION_PREFS): void {}
}
