import axios from "axios";
import type { BankAccount, BankTxn, StatementLine } from "@/components/bank/bank-store";
import type { AuditEntry, Expense } from "@/components/expenses/expenses-store";
import type { LedgerEntry, LedgerKind, Payment } from "@/components/ledger/ledger-store";
import type { Branch, Category, Item, Location, Notification, PurchaseOrder, StockMovement, Supplier } from "@/types/inventory";
import type { SalesOrder, SalesOrderDocument } from "@/types/sales-order";
import type { ItemFilters } from "@/lib/demo-store";
import type { Asset, AssetIncome, MeterReading, ServiceRecord } from "@/components/assets/assets-store";
import type { Employee, EmployeeDraft } from "@/components/employees/employees-store";
import type { Attachment, Channel, ChatUser, Message, Reaction } from "@/components/chat/chat-store";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export const AUTH_TOKEN_KEY = "qterp:auth-token";
export const AUTH_USER_KEY = "qterp:backend-user";
export const AUTH_INVALID_EVENT = "qterp:auth-invalid";
export const ACTIVE_BRANCH_KEY = "qterp:active-branch";

export function getStoredAuthToken() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY) ?? window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredBackendUser() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(AUTH_USER_KEY) ?? window.localStorage.getItem(AUTH_USER_KEY);
}

export function getStoredActiveBranch(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(ACTIVE_BRANCH_KEY) ?? window.localStorage.getItem(ACTIVE_BRANCH_KEY);
}

export function setStoredActiveBranch(branchId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ACTIVE_BRANCH_KEY, branchId);
}

export function setStoredBackendSession(token: string, user: BackendUser) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  window.sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  if (user.branchId) {
    setStoredActiveBranch(user.branchId);
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}

function isPublicEndpoint(url = "") {
  return url === "/login" || url.endsWith("/login");
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
  window.sessionStorage.removeItem(AUTH_USER_KEY);
  window.sessionStorage.removeItem(ACTIVE_BRANCH_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.localStorage.removeItem(ACTIVE_BRANCH_KEY);
}

export const DATA_SYNC_EVENT = "qterp:data-sync";

export function triggerQuickSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DATA_SYNC_EVENT));
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  const activeBranch = getStoredActiveBranch();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (!isPublicEndpoint(config.url)) {
    return Promise.reject(new Error("Sign in to continue."));
  }

  if (activeBranch) {
    config.headers["X-Branch-ID"] = activeBranch;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toUpperCase();
    if (method && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      triggerQuickSync();
    }
    return response;
  },
  (error) => {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 401
    ) {
      clearStoredAuth();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(AUTH_INVALID_EVENT));
      }
    }

    return Promise.reject(error);
  },
);

export interface BackendUser {
  id: string;
  name: string;
  email: string;
  role?: "admin" | "manager" | "staff";
  isActive?: boolean;
  mustChangePassword?: boolean;
  branchId?: string;
  chatUserId?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  message?: string;
  user?: BackendUser;
}

export const loginUser = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  const response = await api.post("/login", {
    email,
    password,
  });

  return response.data;
};

export const getCurrentUser = async (): Promise<LoginResponse> => {
  const response = await api.get("/me");
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post("/logout");
  return response.data;
};

export const getDashboard = async () => {
  const response = await api.get("/dashboard");
  return response.data;
};

export interface BranchDashboardStats {
  items_count: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  sales_count: number;
  daily_transactions_value: number;
}

export const getBranchDashboard = async (branchId: string): Promise<BranchDashboardStats> => {
  const response = await api.get(`/dashboard/branch/${branchId}`);
  return response.data;
};

export const getNextItemSku = async (): Promise<string> => {
    const response = await api.get("/items/next-sku");
    return response.data.sku;
};

export const getNextItemBarcode = async (): Promise<string> => {
    const response = await api.get("/items/next-barcode");
    return response.data.barcode;
};

export const getItems = async (filters?: ItemFilters): Promise<Item[]> => {
    const response = await api.get("/items", { params: filters });
    return response.data;
};

export const getItem = async (id: string): Promise<Item | undefined> => {
  try {
    const response = await api.get(`/items/${id}`);
    return response.data;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return undefined;
    }

    throw error;
  }
};

export const createCatalogItem = async (item: Item): Promise<Item> => {
  const response = await api.post("/items", item);
  return response.data;
};

export const updateCatalogItem = async (id: string, updates: Partial<Item>): Promise<Item> => {
  const response = await api.patch(`/items/${id}`, updates);
  return response.data;
};

export const deleteCatalogItem = async (id: string): Promise<void> => {
  await api.delete(`/items/${id}`);
};

export const getCategories = async (): Promise<Category[]> => {
  const response = await api.get("/categories");
  return response.data;
};

export const createCatalogCategory = async (category: Category): Promise<Category> => {
    const response = await api.post("/categories", category);
    return response.data;
};

export const updateCatalogCategory = async (id: string, updates: Partial<Category>): Promise<Category> => {
    const response = await api.patch(`/categories/${id}`, updates);
    return response.data;
};

export const deleteCatalogCategory = async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
};

export const getSupplier = async (id: string): Promise<Supplier | undefined> => {
    try {
        const response = await api.get(`/suppliers/${id}`);
        return response.data;
    } catch (error) {
        if (
            error &&
            typeof error === "object" &&
            "response" in error &&
            (error as { response?: { status?: number } }).response?.status === 404
        ) {
            return undefined;
        }
        throw error;
    }
};

export const getLocation = async (id: string): Promise<Location | undefined> => {
    try {
        const response = await api.get(`/locations/${id}`);
        return response.data;
    } catch (error) {
        if (
            error &&
            typeof error === "object" &&
            "response" in error &&
            (error as { response?: { status?: number } }).response?.status === 404
        ) {
            return undefined;
        }
        throw error;
    }
};

export const createCatalogLocation = async (location: Location): Promise<Location> => {
    const response = await api.post("/locations", location);
    return response.data;
};

export const updateCatalogLocation = async (id: string, updates: Partial<Location>): Promise<Location> => {
    const response = await api.patch(`/locations/${id}`, updates);
    return response.data;
};

export const deleteCatalogLocation = async (id: string): Promise<void> => {
    await api.delete(`/locations/${id}`);
};

// Branch (same as location, new endpoint)
export const getBranch = async (id: string): Promise<Branch | undefined> => {
    try {
        const response = await api.get(`/branches/${id}`);
        return response.data;
    } catch (error) {
        if (
            error &&
            typeof error === "object" &&
            "response" in error &&
            (error as { response?: { status?: number } }).response?.status === 404
        ) {
            return undefined;
        }
        throw error;
    }
};

export const createCatalogBranch = async (branch: Branch): Promise<Branch> => {
    const response = await api.post("/branches", branch);
    return response.data;
};

export const updateCatalogBranch = async (id: string, updates: Partial<Branch>): Promise<Branch> => {
    const response = await api.patch(`/branches/${id}`, updates);
    return response.data;
};

export const deleteCatalogBranch = async (id: string): Promise<void> => {
    await api.delete(`/branches/${id}`);
};

export const getSuppliers = async (): Promise<Supplier[]> => {
  const response = await api.get("/suppliers");
  return response.data;
};

export const getLocations = async (): Promise<Location[]> => {
  const response = await api.get("/locations");
  return response.data;
};

export const getBranches = async (): Promise<Branch[]> => {
  const response = await api.get("/branches");
  return response.data;
};

export const getMovements = async (limit?: number): Promise<StockMovement[]> => {
  const response = await api.get("/movements", { params: limit ? { limit } : undefined });
  return response.data;
};

export type NotificationPreferences = Record<Notification["type"], boolean>;

export const getNotifications = async (): Promise<Notification[]> => {
  const response = await api.get("/notifications");
  return response.data;
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await api.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.patch("/notifications/read-all");
};

export const dismissNotification = async (id: string): Promise<void> => {
  await api.delete(`/notifications/${id}`);
};

export const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const response = await api.get("/notifications/preferences");
  return response.data;
};

export const updateNotificationPreferences = async (
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> => {
  const response = await api.patch("/notifications/preferences", prefs);
  return response.data;
};

export const createCatalogMovement = async (movement: StockMovement): Promise<StockMovement> => {
  const response = await api.post("/movements", movement);
  return response.data;
};

export const createCatalogMovements = async (movements: StockMovement[]): Promise<StockMovement[]> => {
  const response = await api.post("/movements/bulk", { movements });
  return response.data;
};

export const updateTransactionStatusByReceipt = async (
  receiptNumber: string,
  status: string,
): Promise<{ success: boolean; movements: StockMovement[] }> => {
  const response = await api.patch(`/movements/receipt/${encodeURIComponent(receiptNumber)}/status`, { status });
  return response.data;
};

export const deleteTransactionByReceipt = async (receiptNumber: string): Promise<void> => {
  await api.delete(`/movements/receipt/${encodeURIComponent(receiptNumber)}`);
};

export const getOrders = async (): Promise<SalesOrder[]> => {
  const response = await api.get("/orders");
  return response.data;
};

export const createOrder = async (order: SalesOrder): Promise<SalesOrder> => {
  const response = await api.post("/orders", order);
  return response.data;
};

export const updateOrder = async (id: string, updates: Partial<SalesOrder>): Promise<SalesOrder> => {
  const response = await api.patch(`/orders/${id}`, updates);
  return response.data;
};

export const deleteOrder = async (id: string): Promise<void> => {
  await api.delete(`/orders/${id}`);
};

export const getAllDocuments = async (): Promise<SalesOrderDocument[]> => {
  const response = await api.get("/documents");
  return response.data;
};

export const getOrderDocuments = async (orderId: string): Promise<SalesOrderDocument[]> => {
  const response = await api.get(`/orders/${orderId}/documents`);
  return response.data;
};

export const uploadOrderDocument = async (
  orderId: string,
  payload: Omit<SalesOrderDocument, "id" | "salesOrderId" | "uploadedAt" | "updatedAt"> & { id?: string }
): Promise<SalesOrderDocument> => {
  const response = await api.post(`/orders/${orderId}/documents`, payload);
  return response.data;
};

export const getOrderDocument = async (docId: string): Promise<SalesOrderDocument> => {
  const response = await api.get(`/documents/${docId}`);
  return response.data;
};

export const deleteOrderDocument = async (docId: string): Promise<void> => {
  await api.delete(`/documents/${docId}`);
};

export interface BankState {
  accounts: BankAccount[];
  txns: BankTxn[];
  statements: StatementLine[];
}

export const getBankState = async (): Promise<BankState> => {
  const response = await api.get("/bank");
  return response.data;
};

export const createBankAccount = async (
  account: Omit<BankAccount, "id" | "createdAt" | "currentBalance" | "color"> & { currentBalance?: number },
): Promise<BankAccount> => {
  const response = await api.post("/bank/accounts", account);
  return response.data;
};

export const updateBankAccount = async (
  id: string,
  updates: Partial<BankAccount>,
): Promise<BankAccount> => {
  const response = await api.patch(`/bank/accounts/${id}`, updates);
  return response.data;
};

export const deleteBankAccount = async (id: string): Promise<void> => {
  await api.delete(`/bank/accounts/${id}`);
};

export const createBankTransaction = async (
  txn: Omit<BankTxn, "id" | "createdAt" | "reconciled"> & { reconciled?: boolean },
): Promise<BankTxn> => {
  const response = await api.post("/bank/transactions", txn);
  return response.data;
};

export const toggleBankTransactionReconciled = async (id: string): Promise<BankTxn> => {
  const response = await api.patch(`/bank/transactions/${id}/reconciled`);
  return response.data;
};

export const importBankStatement = async (
  accountId: string,
  lines: Omit<StatementLine, "id" | "accountId" | "importedAt">[],
): Promise<StatementLine[]> => {
  const response = await api.post(`/bank/accounts/${accountId}/statements`, { lines });
  return response.data;
};

export const getLedgerEntries = async (kind: LedgerKind): Promise<LedgerEntry[]> => {
  const response = await api.get(`/ledger/${kind}`);
  return response.data;
};

export const createLedgerEntry = async (
  kind: LedgerKind,
  entry: LedgerEntry,
): Promise<LedgerEntry> => {
  const response = await api.post(`/ledger/${kind}`, entry);
  return response.data;
};

export const deleteLedgerEntry = async (kind: LedgerKind, id: string): Promise<void> => {
  await api.delete(`/ledger/${kind}/${id}`);
};

export const createLedgerPayment = async (
  kind: LedgerKind,
  id: string,
  payment: Payment,
): Promise<LedgerEntry> => {
  const response = await api.post(`/ledger/${kind}/${id}/payments`, payment);
  return response.data;
};

export interface ExpensesState {
  expenses: Expense[];
  audit: AuditEntry[];
}

export const getExpensesState = async (): Promise<ExpensesState> => {
  const response = await api.get("/expenses");
  return response.data;
};

export const createExpense = async (
  expense: Omit<Expense, "id" | "reference" | "createdAt">,
): Promise<Expense> => {
  const response = await api.post("/expenses", expense);
  return response.data;
};

export const updateExpenseRecord = async (
  id: string,
  updates: Partial<Expense>,
): Promise<Expense> => {
  const response = await api.patch(`/expenses/${id}`, updates);
  return response.data;
};

export const deleteExpenseRecord = async (id: string): Promise<void> => {
  await api.delete(`/expenses/${id}`);
};

export const decideExpenseRecord = async (
  id: string,
  decision: "approved" | "rejected",
  actor: string,
  note: string,
  auditId: string,
): Promise<Expense> => {
  const response = await api.post(`/expenses/${id}/decision`, { decision, actor, note, auditId });
  return response.data;
};

export const reimburseExpenseRecord = async (
  id: string,
  actor: string,
  auditId: string,
): Promise<Expense> => {
  const response = await api.post(`/expenses/${id}/reimburse`, { actor, auditId });
  return response.data;
};

export interface CustomerInteraction {
  id: string;
  type: "call" | "email" | "meeting" | "order" | "note";
  summary: string;
  at: string;
  by?: string;
}

export interface Customer {
  id: string;
  reference: string;
  name: string;
  type: "company" | "individual";
  stage: "lead" | "prospect" | "active" | "vip" | "dormant";
  tier: "bronze" | "silver" | "gold" | "platinum";
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  industry: string;
  taxId?: string;
  website?: string;
  contactPerson?: string;
  salesRep: string;
  paymentTerms: "postpaid" | "prepaid" | "net_7" | "net_15" | "net_30" | "net_60" | string;
  creditLimit: number;
  outstandingBalance: number;
  lifetimeValue: number;
  totalOrders: number;
  avgOrderValue: number;
  loyaltyPoints: number;
  tags: string[];
  notes: string;
  interactions: CustomerInteraction[];
  lastOrderAt?: string;
  createdAt: string;
  updatedAt: string;
  autoReference?: boolean;
}

export const getCustomers = async (): Promise<Customer[]> => {
  const response = await api.get("/customers");
  return response.data;
};

export const getCustomer = async (id: string): Promise<Customer | undefined> => {
  try {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return undefined;
    }
    throw error;
  }
};

export const getNextCustomerReference = async (): Promise<string> => {
  const response = await api.get("/customers/next-reference");
  return response.data.reference;
};

export const createCustomer = async (customer: Customer): Promise<Customer> => {
  const response = await api.post("/customers", customer);
  return response.data;
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer> => {
  const response = await api.patch(`/customers/${id}`, updates);
  return response.data;
};

export const deleteCustomer = async (id: string): Promise<void> => {
  await api.delete(`/customers/${id}`);
};

export const addCustomerInteraction = async (id: string, interaction: Omit<CustomerInteraction, "id" | "createdAt">): Promise<Customer> => {
  const response = await api.post(`/customers/${id}/interactions`, interaction);
  return response.data;
};

export const getAssets = async (): Promise<Asset[]> => {
  const response = await api.get("/assets");
  return response.data;
};

export const getAsset = async (id: string): Promise<Asset | undefined> => {
  try {
    const response = await api.get(`/assets/${id}`);
    return response.data;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return undefined;
    }
    throw error;
  }
};

export const getNextAssetTag = async (): Promise<string> => {
  const response = await api.get("/assets/next-tag");
  return response.data.tag;
};

export const createAsset = async (asset: Omit<Asset, "id" | "tag" | "createdAt" | "updatedAt" | "meterReadings" | "services" | "income">): Promise<Asset> => {
  const response = await api.post("/assets", asset);
  return response.data;
};

export const updateAsset = async (id: string, updates: Partial<Asset>): Promise<Asset> => {
  const response = await api.patch(`/assets/${id}`, updates);
  return response.data;
};

export const deleteAsset = async (id: string): Promise<void> => {
  await api.delete(`/assets/${id}`);
};

export const addMeterReading = async (assetId: string, reading: Omit<MeterReading, "id">): Promise<Asset> => {
  const response = await api.post(`/assets/${assetId}/meter-readings`, reading);
  return response.data;
};

export const addServiceRecord = async (assetId: string, service: Omit<ServiceRecord, "id">): Promise<Asset> => {
  const response = await api.post(`/assets/${assetId}/service-records`, service);
  return response.data;
};

export const listAssetIncome = async (assetId: string, range?: { from?: string; to?: string }): Promise<AssetIncome[]> => {
  const response = await api.get(`/assets/${assetId}/income`, { params: { from: range?.from, to: range?.to } });
  return response.data;
};

export const addAssetIncome = async (
  assetId: string,
  income: Omit<AssetIncome, "id" | "createdAt" | "updatedAt">,
): Promise<AssetIncome> => {
  const response = await api.post(`/assets/${assetId}/income`, income);
  return response.data;
};

export const updateAssetIncome = async (
  assetId: string,
  incomeId: string,
  updates: Partial<AssetIncome>,
): Promise<AssetIncome> => {
  const response = await api.patch(`/assets/${assetId}/income/${incomeId}`, updates);
  return response.data;
};

export const deleteAssetIncome = async (assetId: string, incomeId: string): Promise<void> => {
  await api.delete(`/assets/${assetId}/income/${incomeId}`);
};

export const getEmployees = async (): Promise<Employee[]> => {
  const response = await api.get("/employees");
  return response.data;
};

export const getEmployee = async (empId: string): Promise<Employee | undefined> => {
  try {
    const response = await api.get(`/employees/${empId}`);
    return response.data;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return undefined;
    }
    throw error;
  }
};

export const getNextEmployeeCode = async (): Promise<string> => {
  const response = await api.get("/employees/next-code");
  return response.data.code;
};

export interface EmployeeOneTimeCredentials {
  email: string;
  role: "admin" | "manager" | "staff";
  isActive: boolean;
  oneTimePassword?: string | null;
  mustChangePassword: boolean;
}

export interface CreatedEmployeeResponse extends Employee {
  credentials?: EmployeeOneTimeCredentials;
}

export const getEmployeeCredentials = async (empId: string): Promise<EmployeeOneTimeCredentials> => {
  const response = await api.get(`/employees/${empId}/credentials`);
  return response.data;
};

export const resetEmployeeCredentials = async (empId: string): Promise<EmployeeOneTimeCredentials> => {
  const response = await api.post(`/employees/${empId}/reset-credentials`);
  return response.data;
};

export interface EmployeeAccountUpdate {
  email?: string;
  role?: "admin" | "manager" | "staff";
  isActive?: boolean;
  branchId?: string;
}

export interface EmployeeAccountUpdateResponse {
  employee: Employee;
  credentials: EmployeeOneTimeCredentials;
}

export const updateEmployeeAccount = async (
  empId: string,
  updates: EmployeeAccountUpdate,
): Promise<EmployeeAccountUpdateResponse> => {
  const response = await api.patch(`/employees/${empId}/account`, updates);
  return response.data;
};

export const createEmployee = async (emp: EmployeeDraft): Promise<CreatedEmployeeResponse> => {
  const response = await api.post("/employees", emp);
  return response.data;
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post("/change-password", {
    currentPassword,
    newPassword,
  });
  return response.data;
};

export const updateEmployee = async (empId: string, updates: Partial<Employee>): Promise<Employee> => {
  const response = await api.patch(`/employees/${empId}`, updates);
  return response.data;
};

export const deleteEmployee = async (empId: string): Promise<void> => {
  await api.delete(`/employees/${empId}`);
};

// Purchase Orders
export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
  const response = await api.get("/purchase-orders");
  return response.data;
};

export const getPurchaseOrder = async (poId: string): Promise<PurchaseOrder> => {
  const response = await api.get(`/purchase-orders/${poId}`);
  return response.data;
};

export const createPurchaseOrder = async (po: PurchaseOrder): Promise<PurchaseOrder> => {
  const response = await api.post("/purchase-orders", po);
  return response.data;
};

export const updatePurchaseOrder = async (poId: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
  const response = await api.patch(`/purchase-orders/${poId}`, updates);
  return response.data;
};

export const deletePurchaseOrder = async (poId: string): Promise<void> => {
    await api.delete(`/purchase-orders/${poId}`);
};

export const createSupplier = async (supplier: Supplier): Promise<Supplier> => {
    const response = await api.post('/suppliers', supplier);
    return response.data;
};

export const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<Supplier> => {
    const response = await api.patch(`/suppliers/${id}`, updates);
    return response.data;
};

export const deleteSupplier = async (id: string): Promise<void> => {
    await api.delete(`/suppliers/${id}`);
};

// --- Chat ---
export const getChatUsers = async (): Promise<ChatUser[]> => {
    const res = await api.get('/chat/users');
    return res.data;
};

export const getChatChannels = async (): Promise<Channel[]> => {
    const res = await api.get('/chat/channels');
    return res.data;
};

export const createChatChannel = async (data: Omit<Channel, "id" | "createdAt" | "pinnedMessageIds">): Promise<Channel> => {
    const res = await api.post('/chat/channels', data);
    return res.data;
};

export const updateChatChannel = async (channelId: string, data: Partial<Pick<Channel, "name" | "emoji" | "description">>): Promise<Channel> => {
    const res = await api.patch(`/chat/channels/${channelId}`, data);
    return res.data;
};

export const deleteChatChannel = async (channelId: string): Promise<void> => {
    await api.delete(`/chat/channels/${channelId}`);
};

export const addChannelMember = async (channelId: string, userId: string): Promise<Channel> => {
    const res = await api.post(`/chat/channels/${channelId}/members`, { userId });
    return res.data;
};

export const removeChannelMember = async (channelId: string, userId: string): Promise<Channel> => {
    const res = await api.delete(`/chat/channels/${channelId}/members/${userId}`);
    return res.data;
};

export interface ChatEmployeeProfile {
  id: string;
  code: string;
  name: string;
  department: string;
  position: string;
}

export interface EnrichedChatMember {
  userId: string;
  name: string;
  role: string;
  color: string;
  online: boolean;
  lastSeen?: string;
  employee?: ChatEmployeeProfile;
}

export const getChannelMembers = async (channelId: string): Promise<EnrichedChatMember[]> => {
  const res = await api.get(`/chat/channels/${channelId}/members`);
  return res.data;
};

export const getChatEmployees = async (): Promise<EnrichedChatMember[]> => {
  const res = await api.get("/chat/employees");
  return res.data;
};

export const startDirectMessage = async (targetUserId: string): Promise<Channel> => {
  const res = await api.post("/chat/dm", { targetUserId });
  return res.data;
};

export const getChannelMessages = async (channelId: string): Promise<Message[]> => {
    const res = await api.get(`/chat/channels/${channelId}/messages`);
    return res.data;
};

export const createChatMessage = async (data: {
  channelId: string;
  authorId: string;
  body: string;
  mentions: string[];
  attachments: Attachment[];
  replyTo?: string;
}): Promise<Message> => {
    const res = await api.post('/chat/messages', data);
    return res.data;
};

export const updateChatMessage = async (msgId: string, data: Partial<Pick<Message, "body" | "pinned">> & { reactions?: Reaction[] }): Promise<Message> => {
    const res = await api.patch(`/chat/messages/${msgId}`, data);
    return res.data;
};

export const deleteChatMessage = async (msgId: string): Promise<void> => {
    await api.delete(`/chat/messages/${msgId}`);
};

export interface ChatAccessResponse {
  allowed: boolean;
  employee?: {
    id: string;
    code: string;
    name: string;
    department: string;
    position: string;
  };
  chatUser?: ChatUser;
}

export const checkChatAccess = async (): Promise<ChatAccessResponse> => {
  const res = await api.get("/chat/access");
  return res.data;
};

export const heartbeatPresence = async (userId: string): Promise<ChatUser> => {
  const res = await api.post("/chat/presence/heartbeat", { userId });
  return res.data;
};

export const setPresenceOffline = async (userId: string): Promise<void> => {
  await api.post("/chat/presence/offline", { userId });
};

export interface TypingState {
  userId: string;
  updatedAt: string;
}

export const setTyping = async (channelId: string, userId: string, typing: boolean): Promise<void> => {
  await api.post(`/chat/channels/${channelId}/typing`, { userId, typing });
};

export const getTypingInChannel = async (channelId: string): Promise<TypingState[]> => {
  const res = await api.get(`/chat/channels/${channelId}/typing`);
  return res.data;
};

export interface ReadReceipt {
  userId: string;
  lastReadAt: string;
  lastMessageId: string | null;
  updatedAt: string;
}

export const markChannelRead = async (channelId: string, userId: string): Promise<ReadReceipt> => {
  const res = await api.post(`/chat/channels/${channelId}/read`, { userId });
  return res.data;
};

export const getChannelReadState = async (channelId: string): Promise<ReadReceipt[]> => {
  const res = await api.get(`/chat/channels/${channelId}/read`);
  return res.data;
};

export const getUnreadCounts = async (): Promise<Record<string, number>> => {
  const res = await api.get("/chat/unread");
  return res.data;
};

// Loyalty Tiers
export interface LoyaltyTier {
  id: string;
  name: string;
  minPoints: number;
  maxPoints?: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export const getLoyaltyTiers = async (): Promise<LoyaltyTier[]> => {
  const response = await api.get('/loyalty-tiers');
  return response.data;
};

export const getLoyaltyTier = async (id: string): Promise<LoyaltyTier | undefined> => {
  try {
    const response = await api.get(`/loyalty-tiers/${id}`);
    return response.data;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return undefined;
    }
    throw error;
  }
};

export const createLoyaltyTier = async (tier: Omit<LoyaltyTier, "id" | "createdAt" | "updatedAt">): Promise<LoyaltyTier> => {
  const response = await api.post('/loyalty-tiers', tier);
  return response.data;
};

export const updateLoyaltyTier = async (id: string, updates: Partial<LoyaltyTier>): Promise<LoyaltyTier> => {
  const response = await api.patch(`/loyalty-tiers/${id}`, updates);
  return response.data;
};

export const deleteLoyaltyTier = async (id: string): Promise<void> => {
  await api.delete(`/loyalty-tiers/${id}`);
};

export default api;
