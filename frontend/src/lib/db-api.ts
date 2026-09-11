import { MovementType } from "@/types/inventory";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Category,
  InventoryRequest,
  Item,
  Location,
  Branch,
  PurchaseOrder,
  StockMovement,
  Supplier,
} from "@/types/inventory";
import type { ItemFilters } from "@/lib/demo-store";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import {
  createCatalogItem,
  createCatalogCategory,
  updateCatalogCategory,
  deleteCatalogCategory,
  deleteCatalogItem,
  createCatalogMovement,
  getCategories as getBackendCategories,
  getItem as getBackendItem,
  getItems as getBackendItems,
  getLocations as getBackendLocations,
  getLocation as getBackendLocation,
  getBranches as getBackendBranches,
  getBranch as getBackendBranch,
  getMovements as getBackendMovements,
  getSuppliers as getBackendSuppliers,
  getSupplier as getBackendSupplier,
  updateCatalogItem,
  getCustomers as getBackendCustomers,
  getCustomer as getBackendCustomer,
  createCustomer as createBackendCustomer,
  updateCustomer as updateBackendCustomer,
  deleteCustomer as deleteBackendCustomer,
  addCustomerInteraction as addBackendCustomerInteraction,
  getPurchaseOrders as getBackendPurchaseOrders,
  getPurchaseOrder as getBackendPurchaseOrder,
  createPurchaseOrder as createBackendPurchaseOrder,
  updatePurchaseOrder as updateBackendPurchaseOrder,
  deletePurchaseOrder as deleteBackendPurchaseOrder,
  createSupplier as createBackendSupplier,
  updateSupplier as updateBackendSupplier,
  deleteSupplier as deleteBackendSupplier,
  createCatalogLocation,
  createCatalogBranch,
  updateCatalogLocation,
  updateCatalogBranch,
  deleteCatalogLocation,
  deleteCatalogBranch,
  type Customer,
} from "@/services/api";
import {
  mapCategory,
  mapInventoryRequest,
  mapItem,
  mapLocation,
  mapMovement,
  mapPurchaseOrder,
  mapSupplier,
  toCategoryInsert,
  toCategoryUpdate,
  toInventoryRequestInsert,
  toInventoryRequestUpdate,
  toItemInsert,
  toItemUpdate,
  toLocationInsert,
  toLocationUpdate,
  toMovementInsert,
  toPurchaseOrderInsert,
  toPurchaseOrderItemInsert,
  toPurchaseOrderUpdate,
  toRequestItemInsert,
  toSupplierInsert,
  toSupplierUpdate,
} from "@/lib/db-mappers";

async function currentUserId(): Promise<string | null> {
  const { data } = await dbClient().auth.getUser();
  return data.user?.id ?? null;
}

function dbClient() {
  return requireSupabase() as SupabaseClient;
}

async function expectOk<T>(promise: PromiseLike<{ data: T; error: Error | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export async function fetchItems(filters?: ItemFilters): Promise<Item[]> {
  if (!isSupabaseConfigured) {
    return getBackendItems(filters);
  }

  const db = dbClient();
  let query = db.from("items").select("*").order("name", { ascending: true });
  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters?.supplierId) query = query.eq("preferred_supplier_id", filters.supplierId);
  if (filters?.locationId) query = query.eq("location_id", filters.locationId);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.search) {
    const safe = filters.search.replaceAll("%", "\\%");
    query = query.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%`);
  }
  return ((await expectOk(query)) as Parameters<typeof mapItem>[0][]).map(mapItem);
}

export async function fetchItemById(id: string): Promise<Item | undefined> {
    if (!isSupabaseConfigured) {
        return getBackendItem(id);
    }

    const db = dbClient();
    const { data, error } = await db.from("items").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapItem(data) : undefined;
}

export async function fetchCategories(): Promise<Category[]> {
    if (!isSupabaseConfigured) {
        return getBackendCategories();
    }

    return ((await expectOk(dbClient().from("categories").select("*").order("name"))) as Parameters<typeof mapCategory>[0][]).map(mapCategory);
}

export async function fetchSuppliers(): Promise<Supplier[]> {
    if (!isSupabaseConfigured) {
        return getBackendSuppliers();
    }

    return ((await expectOk(dbClient().from("suppliers").select("*").order("name"))) as Parameters<typeof mapSupplier>[0][]).map(mapSupplier);
}

export async function fetchLocations(): Promise<Location[]> {
    if (!isSupabaseConfigured) {
        return getBackendLocations();
    }

    return ((await expectOk(dbClient().from("locations").select("*").order("name"))) as Parameters<typeof mapLocation>[0][]).map(mapLocation);
}

export async function fetchBranches(): Promise<Branch[]> {
    if (!isSupabaseConfigured) {
        return getBackendBranches();
    }

    return ((await expectOk(dbClient().from("locations").select("*").order("name"))) as Parameters<typeof mapLocation>[0][]).map(mapLocation);
}

export async function fetchSupplierById(id: string): Promise<Supplier | undefined> {
    if (!isSupabaseConfigured) {
        return getBackendSupplier(id);
    }

    const db = dbClient();
    const { data, error } = await db.from("suppliers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapSupplier(data) : undefined;
}

export async function fetchLocationById(id: string): Promise<Location | undefined> {
    if (!isSupabaseConfigured) {
        return getBackendLocation(id);
    }

    const db = dbClient();
    const { data, error } = await db.from("locations").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapLocation(data) : undefined;
}

export async function fetchBranchById(id: string): Promise<Branch | undefined> {
    if (!isSupabaseConfigured) {
        return getBackendBranch(id);
    }

    const db = dbClient();
    const { data, error } = await db.from("locations").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapLocation(data) : undefined;
}

export async function fetchMovements(limit?: number): Promise<StockMovement[]> {
  if (!isSupabaseConfigured) {
    return getBackendMovements(limit);
  }

  let query = dbClient().from("stock_movements").select("*").order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  return ((await expectOk(query)) as Parameters<typeof mapMovement>[0][]).map(mapMovement);
}

export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
    if (!isSupabaseConfigured) {
        return getBackendPurchaseOrders();
    }
    const data = await expectOk(
        dbClient()
            .from("purchase_orders")
            .select("*, purchase_order_items(*)")
            .order("created_at", { ascending: false }),
    );
    return (data as Parameters<typeof mapPurchaseOrder>[0][]).map(mapPurchaseOrder);
}

export async function fetchRequests(): Promise<InventoryRequest[]> {
    const data = await expectOk(
        dbClient()
            .from("inventory_requests")
            .select("*, request_items(*)")
            .order("created_at", { ascending: false }),
    );
    return (data as Parameters<typeof mapInventoryRequest>[0][]).map(mapInventoryRequest);
}

export async function createItem(item: Item): Promise<void> {
  if (!isSupabaseConfigured) {
    await createCatalogItem(item);
    return;
  }

  await expectOk(dbClient().from("items").insert(toItemInsert(item)).select("id").single());
}

export async function updateItem(id: string, updates: Partial<Item>): Promise<void> {
  if (!isSupabaseConfigured) {
    await updateCatalogItem(id, updates);
    return;
  }

  await expectOk(dbClient().from("items").update(toItemUpdate(updates)).eq("id", id).select("id").single());
}

export async function deleteItem(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    await deleteCatalogItem(id);
    return;
  }

  await expectOk(dbClient().from("items").delete().eq("id", id).select("id").single());
}

export async function createSupplier(supplier: Supplier): Promise<void> {
    if (!isSupabaseConfigured) {
        await createBackendSupplier(supplier);
        return;
    }
    await expectOk(dbClient().from("suppliers").insert(toSupplierInsert(supplier)).select("id").single());
}

export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<void> {
    if (!isSupabaseConfigured) {
        await updateBackendSupplier(id, updates);
        return;
    }
    await expectOk(dbClient().from("suppliers").update(toSupplierUpdate(updates)).eq("id", id).select("id").single());
}

export async function deleteSupplier(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
        await deleteBackendSupplier(id);
        return;
    }
    await expectOk(dbClient().from("suppliers").delete().eq("id", id).select("id").single());
}

export async function createCategory(category: Category): Promise<void> {
  if (!isSupabaseConfigured) {
    await createCatalogCategory(category);
    return;
  }

  await expectOk(dbClient().from("categories").insert(toCategoryInsert(category)).select("id").single());
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<void> {
    if (!isSupabaseConfigured) {
        await updateCatalogCategory(id, updates);
        return;
    }

    await expectOk(dbClient().from("categories").update(toCategoryUpdate(updates)).eq("id", id).select("id").single());
}

export async function deleteCategory(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
        await deleteCatalogCategory(id);
        return;
    }

    await expectOk(dbClient().from("categories").delete().eq("id", id).select("id").single());
}

export async function createLocation(location: Location): Promise<void> {
    if (!isSupabaseConfigured) {
        await createCatalogLocation(location);
        return;
    }

    await expectOk(dbClient().from("locations").insert(toLocationInsert(location)).select("id").single());
}

export async function updateLocation(id: string, updates: Partial<Location>): Promise<void> {
    if (!isSupabaseConfigured) {
        await updateCatalogLocation(id, updates);
        return;
    }

    await expectOk(dbClient().from("locations").update(toLocationUpdate(updates)).eq("id", id).select("id").single());
}

export async function deleteLocation(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
        await deleteCatalogLocation(id);
        return;
    }

    await expectOk(dbClient().from("locations").delete().eq("id", id).select("id").single());
}

export async function createBranch(branch: Branch): Promise<void> {
    if (!isSupabaseConfigured) {
        await createCatalogBranch(branch);
        return;
    }

    await expectOk(dbClient().from("locations").insert(toLocationInsert(branch)).select("id").single());
}

export async function updateBranch(id: string, updates: Partial<Branch>): Promise<void> {
    if (!isSupabaseConfigured) {
        await updateCatalogBranch(id, updates);
        return;
    }

    await expectOk(dbClient().from("locations").update(toLocationUpdate(updates)).eq("id", id).select("id").single());
}

export async function deleteBranch(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
        await deleteCatalogBranch(id);
        return;
    }

    await expectOk(dbClient().from("locations").delete().eq("id", id).select("id").single());
}

export async function createMovement(movement: StockMovement): Promise<void> {
  if (!isSupabaseConfigured) {
    await createCatalogMovement(movement);
    return;
  }

  const db = dbClient();
  const userId = await currentUserId();
  const { data: item, error } = await db
    .from("items")
    .select("quantity_on_hand, location_id")
    .eq("id", movement.itemId)
    .single();
  if (error) throw error;

  let resultingQuantity = item.quantity_on_hand;
  if (movement.type === MovementType.Received) {
    resultingQuantity += Math.abs(movement.quantity);
  } else if (movement.type === MovementType.Shipped) {
    resultingQuantity = Math.max(0, resultingQuantity - Math.abs(movement.quantity));
  } else if (movement.type === MovementType.Adjusted) {
    resultingQuantity = Math.max(0, resultingQuantity + movement.quantity);
  }

  await expectOk(
    db.from("stock_movements").insert(toMovementInsert(movement, resultingQuantity, userId)).select("id").single(),
  );

  const itemUpdate: { quantity_on_hand?: number; location_id?: string | null } = {};
  if (movement.type !== MovementType.Transferred) itemUpdate.quantity_on_hand = resultingQuantity;
  if (movement.type === MovementType.Transferred && movement.toLocationId) itemUpdate.location_id = movement.toLocationId;

  if (Object.keys(itemUpdate).length > 0) {
    await expectOk(db.from("items").update(itemUpdate).eq("id", movement.itemId).select("id").single());
  }
}

export async function createPurchaseOrder(po: PurchaseOrder): Promise<void> {
  if (!isSupabaseConfigured) {
    await createBackendPurchaseOrder(po);
    return;
  }
  const db = dbClient();
  const userId = await currentUserId();
  await expectOk(db.from("purchase_orders").insert(toPurchaseOrderInsert(po, userId)).select("id").single());
  if (po.items.length > 0) {
    await expectOk(db.from("purchase_order_items").insert(po.items.map((item) => toPurchaseOrderItemInsert(item, po.id))).select("id"));
  }
}

export async function updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>): Promise<void> {
  if (!isSupabaseConfigured) {
    await updateBackendPurchaseOrder(id, updates);
    return;
  }
  await expectOk(dbClient().from("purchase_orders").update(toPurchaseOrderUpdate(updates)).eq("id", id).select("id").single());
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    await deleteBackendPurchaseOrder(id);
    return;
  }
  await expectOk(dbClient().from("purchase_orders").delete().eq("id", id).select("id").single());
}

export async function createRequest(request: InventoryRequest): Promise<void> {
  const db = dbClient();
  const userId = await currentUserId();
  if (!userId) throw new Error("You must be signed in to create a request.");
  await expectOk(db.from("inventory_requests").insert(toInventoryRequestInsert(request, userId)).select("id").single());
  if (request.items.length > 0) {
    await expectOk(db.from("request_items").insert(request.items.map((item) => toRequestItemInsert(item, request.id))).select("id"));
  }
}

export async function updateRequest(id: string, updates: Partial<InventoryRequest>): Promise<void> {
  const userId = await currentUserId();
  await expectOk(
    dbClient()
      .from("inventory_requests")
      .update(toInventoryRequestUpdate(updates, userId))
      .eq("id", id)
      .select("id")
      .single(),
  );
}
