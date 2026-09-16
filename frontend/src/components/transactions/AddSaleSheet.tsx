import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Check, Receipt, User, CreditCard, Package, Boxes, Search, Sparkles, X, Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import { MovementType, type SaleItem } from "@/types/inventory";
import type {
  Item,
  StockMovement,
  PaymentMethod,
  TransactionStatus,
} from "@/types/inventory";
import { useEmployees } from "@/components/employees/employees-store";
import { useAssetsStore } from "@/components/assets/assets-store";
import { useCustomers, type Customer } from "@/components/customers/customers-store";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
  movements: StockMovement[];
  onCreateMovement: (movements: StockMovement[]) => void;
  isSaving: boolean;
}

const VAT_RATE = 0.18;
const WALK_IN = "Walk-in";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "mobile", label: "Mobile money" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "credit", label: "Credit / on account" },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(n || 0);

const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function getRawDigits(str: string): string {
  return (str || "").replace(/\D/g, "");
}

export function getLastName(name: string): string {
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function customerSearchText(customer: Customer) {
  const phoneDigits = getRawDigits(customer.phone);
  return compact([
    customer.reference,
    customer.name,
    customer.email,
    customer.phone,
    phoneDigits,
    customer.contactPerson,
    customer.taxId,
  ].filter(Boolean).join(" "));
}

interface CartLineItem extends SaleItem {
  tempId: string;
}

export function AddSaleSheet({ open, onOpenChange, items, movements, onCreateMovement, isSaving }: Props) {
  const { employees } = useEmployees();
  const assetsStore = useAssetsStore();
  const { customers, loading: customersLoading } = useCustomers();

  const [itemId, setItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemFocused, setItemFocused] = useState(false);
  const [assetId, setAssetId] = useState<string>("__none__");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountTendered, setAmountTendered] = useState("0");
  const [isCustomTendered, setIsCustomTendered] = useState(false);
  const [staff, setStaff] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerFocused, setCustomerFocused] = useState(false);
  const [customer, setCustomer] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lineItems, setLineItems] = useState<CartLineItem[]>([]);

  const selected = items.find((i) => i.id === itemId);
  const activeStaff = employees.filter((e) => e.status === "active");
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null;

  useEffect(() => {
    if (open) {
      setItemId("");
      setItemSearch("");
      setItemFocused(false);
      setAssetId("__none__");
      setQuantity("1");
      setUnitPrice("0");
      setDiscount("0");
      setVatEnabled(false);
      setPaymentMethod("cash");
      setAmountTendered("0");
      setIsCustomTendered(false);
      setStaff(activeStaff[0]?.name ?? "");
      setSelectedCustomerId(null);
      setCustomerFocused(false);
      setCustomer("");
      setTelephone("");
      setEmail("");
      setErrors({});
      setLineItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (selected) setUnitPrice(String(selected.sellingPrice));
  }, [selected]);

  const matchingItems = useMemo(() => {
    const query = compact(itemSearch);
    if (!query) return items.slice(0, 8);

    const terms = query.split(" ").filter(Boolean);
    return items
      .map((item) => ({
        item,
        text: compact([item.name, item.sku, item.barcode ?? ""].join(" ")),
      }))
      .filter(({ text }) => terms.every((term) => text.includes(term)))
      .sort((a, b) => {
        const aName = compact(a.item.name);
        const bName = compact(b.item.name);
        const aStarts = aName.startsWith(query) ? 0 : 1;
        const bStarts = bName.startsWith(query) ? 0 : 1;
        return aStarts - bStarts || a.item.name.localeCompare(b.item.name);
      })
      .slice(0, 8)
      .map(({ item }) => item);
  }, [itemSearch, items]);

  const showItemMatches = itemFocused && (itemSearch.trim().length > 0 || matchingItems.length > 0);

  function selectCatalogItem(item: Item) {
    setItemId(item.id);
    setItemSearch(item.name);
    setUnitPrice(String(item.sellingPrice));
    setItemFocused(false);
  }

  function updateItemSearch(value: string) {
    setItemSearch(value);
    if (selected && value !== selected.name) {
      setItemId("");
    }
  }

  const matchingCustomers = useMemo(() => {
    const query = compact(customer);
    const queryDigits = getRawDigits(customer);
    if (!query && !queryDigits) return customers.slice(0, 6);

    const terms = query.split(" ").filter(Boolean);
    return customers
      .map((c) => {
        const phoneDigits = getRawDigits(c.phone);
        const matchesDigits = queryDigits.length >= 3 && phoneDigits.includes(queryDigits);
        const text = customerSearchText(c);
        return { customer: c, text, matchesDigits };
      })
      .filter(({ text, matchesDigits }) => matchesDigits || terms.every((term) => text.includes(term)))
      .sort((a, b) => {
        if (a.matchesDigits && !b.matchesDigits) return -1;
        if (!a.matchesDigits && b.matchesDigits) return 1;
        const aName = compact(a.customer.name);
        const bName = compact(b.customer.name);
        const aStarts = aName.startsWith(query) ? 0 : 1;
        const bStarts = bName.startsWith(query) ? 0 : 1;
        return aStarts - bStarts || a.customer.name.localeCompare(b.customer.name);
      })
      .slice(0, 8)
      .map(({ customer }) => customer);
  }, [customer, customers]);

  const showCustomerMatches = customerFocused && !selectedCustomer && (customer.trim().length > 0 || matchingCustomers.length > 0);

  function selectCustomerProfile(profile: Customer) {
    setSelectedCustomerId(profile.id);
    setCustomer(profile.name);
    setTelephone(profile.phone);
    setEmail(profile.email);
    setCustomerFocused(false);
  }

  function clearCustomerProfile() {
    setSelectedCustomerId(null);
    setCustomer("");
    setTelephone("");
    setEmail("");
    setCustomerFocused(true);
  }

  function updateCustomerName(value: string) {
    setCustomer(value);
    if (selectedCustomer && value !== selectedCustomer.name) {
      setSelectedCustomerId(null);
    }
  }

  const qty = Math.max(0, parseInt(quantity, 10) || 0);
  const price = Math.max(0, parseFloat(unitPrice) || 0);
  const disc = Math.max(0, parseFloat(discount) || 0);
  const lineVat = vatEnabled ? Math.max(0, qty * price - disc) * VAT_RATE : 0;

  // Calculate totals from line items
  const { subtotal: lineItemsSubtotal, totalDiscount: lineItemsDiscount, totalVat: lineItemsVat } = useMemo(() => {
    let s = 0;
    let d = 0;
    let v = 0;
    for (const li of lineItems) {
      s += li.quantity * li.unitPrice;
      d += li.discount;
      v += li.vat;
    }
    return { subtotal: s, totalDiscount: d, totalVat: v };
  }, [lineItems]);

  // If line items are present, use their totals; otherwise use single-item values
  const useCart = lineItems.length > 0;
  const currentSubTotal = useCart ? lineItemsSubtotal : qty * price;
  const currentAfterDiscount = Math.max(0, currentSubTotal - (useCart ? lineItemsDiscount : disc));
  const currentVat = useCart ? lineItemsVat : lineVat;
  const totalAmount = currentAfterDiscount + currentVat;

  const effectiveTendered = isCustomTendered
    ? Math.max(0, parseFloat(amountTendered) || 0)
    : paymentMethod === "credit"
    ? 0
    : totalAmount;

  const tendered = effectiveTendered;
  const difference = tendered - totalAmount;

  const cumulativeAmount = useMemo(() => {
    const today = new Date().toDateString();
    const todaySales = movements
      .filter((m) => m.sale && new Date(m.createdAt).toDateString() === today)
      .reduce((s, m) => s + (m.sale?.totalAmount ?? 0), 0);
    return todaySales + totalAmount;
  }, [movements, totalAmount]);

  // Balance (if negative difference) and Change Due (if positive difference)
  const changeDue = difference > 0 ? difference : 0;
  const balance = difference < 0 ? Math.abs(difference) : 0;
  const dep = Math.min(tendered, totalAmount);

  // Saved as completed sale ("paid") in the database automatically if balance = 0
  const status: TransactionStatus =
    balance === 0 ? "paid" : dep > 0 ? "partial" : "pending";

  const receiptNumber = useMemo(
    () => `RCP-${Date.now().toString().slice(-7)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  function addLineItem() {
    const lineErrors: Record<string, string> = {};
    if (!itemSearch.trim()) lineErrors.itemId = "Item is required";
    if (qty <= 0) lineErrors.quantity = "Quantity must be greater than 0";
    if (selected && qty > selected.currentStock)
      lineErrors.quantity = `Only ${selected.currentStock} in stock`;
    if (price <= 0) lineErrors.unitPrice = "Unit price required";

    if (Object.keys(lineErrors).length > 0) {
      setErrors(lineErrors);
      return;
    }

    const lineTotal = Math.max(0, qty * price - disc) + lineVat;
    const saleItemName = selected?.name ?? itemSearch.trim();
    const linkedAsset = assetId !== "__none__" ? assetsStore.assets.find((a) => a.id === assetId) : null;

    const newItem: CartLineItem = {
      tempId: crypto.randomUUID(),
      itemId: itemId || null,
      itemName: saleItemName,
      unitPrice: price,
      quantity: qty,
      discount: disc,
      vat: lineVat,
      vatRate: vatEnabled ? VAT_RATE : 0,
      assetId: linkedAsset?.id ?? null,
      assetName: linkedAsset?.name ?? null,
      lineTotal,
    };

    setLineItems([...lineItems, newItem]);
    setErrors({});
    // Reset item inputs
    setItemId("");
    setItemSearch("");
    setQuantity("1");
    setUnitPrice("0");
    setDiscount("0");
    setAssetId("__none__");
    setVatEnabled(false);
  }

  function removeLineItem(tempId: string) {
    setLineItems(lineItems.filter((li) => li.tempId !== tempId));
  }

  function updateLineItemQuantity(tempId: string, delta: number) {
    setLineItems(lineItems.map((li) => {
      if (li.tempId !== tempId) return li;
      const newQty = Math.max(0, li.quantity + delta);
      if (newQty === 0) return li;
      const afterDiscount = Math.max(0, newQty * li.unitPrice - li.discount);
      const newVat = afterDiscount * li.vatRate;
      return {
        ...li,
        quantity: newQty,
        vat: newVat,
        lineTotal: afterDiscount + newVat,
      };
    }));
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!staff.trim()) e.staff = "Staff is required";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "Invalid email";

    if (lineItems.length === 0) {
      if (!itemSearch.trim()) e.itemId = "Add at least one item";
      if (qty <= 0) e.quantity = "Quantity must be greater than 0";
      if (selected && qty > selected.currentStock)
        e.quantity = `Only ${selected.currentStock} in stock`;
      if (price <= 0) e.unitPrice = "Unit price required";
    } else {
      // Check stock for each line item that has a matched item
      for (const li of lineItems) {
        if (li.itemId) {
          const dbItem = items.find((it) => it.id === li.itemId);
          if (dbItem && li.quantity > dbItem.currentStock) {
            e.itemId = `${li.itemName}: only ${dbItem.currentStock} in stock`;
            break;
          }
        }
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const customerName = customer.trim() || WALK_IN;
    const createdAt = new Date().toISOString();
    const linkedAsset = assetId !== "__none__" ? assetsStore.assets.find((a) => a.id === assetId) : null;

    // Determine final line items to save: either cart or single current item
    let finalLineItems: SaleItem[];
    if (lineItems.length > 0) {
      finalLineItems = lineItems.map(({ tempId, ...rest }) => rest);
    } else {
      const lineTotal = Math.max(0, qty * price - disc) + lineVat;
      finalLineItems = [{
        itemId: itemId || null,
        itemName: selected?.name ?? itemSearch.trim(),
        unitPrice: price,
        quantity: qty,
        discount: disc,
        vat: lineVat,
        vatRate: vatEnabled ? VAT_RATE : 0,
        assetId: linkedAsset?.id ?? null,
        assetName: linkedAsset?.name ?? null,
        lineTotal,
      }];
    }

    // Build the shared sale details (use first line item for legacy single-item fields)
    const firstLine = finalLineItems[0];
    const commonSale = {
      receiptNumber,
      itemName: firstLine.itemName,
      unitPrice: firstLine.unitPrice,
      totalAmount,
      discount: finalLineItems.reduce((s, li) => s + li.discount, 0),
      vat: finalLineItems.reduce((s, li) => s + li.vat, 0),
      vatRate: VAT_RATE,
      cumulativeAmount,
      deposit: dep,
      balance,
      paymentMethod,
      amountTendered: tendered,
      changeDue,
      staff,
      customerId: selectedCustomer?.id ?? null,
      customer: customerName,
      telephone,
      email,
      status,
      assetId: firstLine.assetId,
      assetName: firstLine.assetName,
      lineItems: finalLineItems,
    };

    // Create one StockMovement per line item
    const stockMovements: StockMovement[] = finalLineItems.map((li, idx) => ({
      id: crypto.randomUUID(),
      itemId: li.itemId || "",
      type: MovementType.Shipped,
      quantity: -li.quantity,
      fromLocationId: null,
      toLocationId: null,
      reference: receiptNumber,
      notes: idx === 0 ? `Sale to ${customerName}` : "",
      performedBy: staff,
      createdAt,
      sale: {
        ...commonSale,
        itemName: li.itemName,
        unitPrice: li.unitPrice,
        discount: li.discount,
        vat: li.vat,
        assetId: li.assetId,
        assetName: li.assetName,
      },
    }));

    onCreateMovement(stockMovements);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> New sale
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            Receipt {receiptNumber}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Item section */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Add item
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Item</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={itemSearch}
                  onChange={(e) => updateItemSearch(e.target.value)}
                  onFocus={() => setItemFocused(true)}
                  onBlur={() => window.setTimeout(() => setItemFocused(false), 120)}
                  placeholder="Search item, or type a manual item"
                  className="pl-9"
                  autoComplete="off"
                />
                {showItemMatches && (
                  <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-white p-1 shadow-md">
                    {matchingItems.length > 0 ? (
                      matchingItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectCatalogItem(item);
                          }}
                          className="flex w-full items-start justify-between gap-3 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{item.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{item.sku}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{item.currentStock} in stock</span>
                        </button>
                      ))
                    ) : (
                      <div className="flex gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        No database match. Keep typing to save this item manually.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Select value={itemId || "__none__"} onValueChange={(v) => setItemId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="hidden">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>Select item</SelectItem>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} · {i.currentStock} in stock
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.itemId && <p className="mt-1 text-xs text-destructive">{errors.itemId}</p>}
            </div>

            <div>
              <Label className="mb-1.5 flex items-center gap-1.5 text-sm">
                <Boxes className="h-3.5 w-3.5 text-muted-foreground" /> Asset (optional)
              </Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Link to asset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {assetsStore.assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.tag} · {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-sm">Unit price</Label>
                <Input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
                {errors.unitPrice && <p className="mt-1 text-xs text-destructive">{errors.unitPrice}</p>}
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Quantity</Label>
                <Input type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                {errors.quantity && <p className="mt-1 text-xs text-destructive">{errors.quantity}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-sm">Discount</Label>
                <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-2 text-sm">
                  <Checkbox checked={vatEnabled} onCheckedChange={(c) => setVatEnabled(Boolean(c))} id="vat-toggle" />
                  <label htmlFor="vat-toggle" className="cursor-pointer">VAT 18% (optional)</label>
                </Label>
                <Input value={fmt(lineVat)} disabled className="font-mono" />
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="w-full gap-1.5">
              <Plus className="h-4 w-4" /> Add to cart
            </Button>
          </section>

          {/* Cart items */}
          {lineItems.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ShoppingCart className="h-3.5 w-3.5" /> Cart ({lineItems.length} items)
                </div>
              </div>
              <div className="divide-y divide-border rounded-md border border-border">
                {lineItems.map((li) => (
                  <div key={li.tempId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{li.itemName}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {fmt(li.unitPrice)} × {li.quantity} · {fmt(li.lineTotal)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateLineItemQuantity(li.tempId, -1)}
                        disabled={li.quantity <= 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="min-w-[28px] text-center font-mono text-sm">{li.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateLineItemQuantity(li.tempId, 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeLineItem(li.tempId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Totals card */}
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{fmt(currentSubTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-mono">-{fmt(useCart ? lineItemsDiscount : disc)}</span>
            </div>
            {currentVat > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT (18%)</span>
                <span className="font-mono">{fmt(currentVat)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between text-base">
              <span className="font-semibold">Total amount</span>
              <span className="font-mono font-bold text-primary">{fmt(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1">
              <span className="text-muted-foreground">Cumulative (today)</span>
              <span className="font-mono">{fmt(cumulativeAmount)}</span>
            </div>
          </div>

          {/* Payment */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5" /> Payment
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Method of payment</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => {
                  const pm = v as PaymentMethod;
                  setPaymentMethod(pm);
                  setIsCustomTendered(false);
                  if (pm === "credit") {
                    setAmountTendered("0");
                  } else {
                    setAmountTendered(String(totalAmount));
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Amount tendered</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={isCustomTendered ? amountTendered : String(effectiveTendered)}
                onChange={(e) => {
                  setAmountTendered(e.target.value);
                  setIsCustomTendered(true);
                }}
                placeholder="Enter amount tendered"
                className="font-mono text-base font-medium"
              />
            </div>

            {/* Dynamic Calculation Cards: Balance & Change Due */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className={`rounded-lg border p-3 transition-colors ${difference < 0 ? "border-amber-300 bg-amber-50/70" : "border-border bg-muted/30"}`}>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className={`mt-0.5 font-mono text-base font-semibold ${difference < 0 ? "text-amber-700" : "text-muted-foreground"}`}>
                  {fmt(balance)}
                </p>
              </div>
              <div className={`rounded-lg border p-3 transition-colors ${difference > 0 ? "border-emerald-300 bg-emerald-50/70" : "border-border bg-muted/30"}`}>
                <p className="text-xs text-muted-foreground">Change due</p>
                <p className={`mt-0.5 font-mono text-base font-semibold ${difference > 0 ? "text-emerald-700 font-bold" : "text-muted-foreground"}`}>
                  {fmt(changeDue)}
                </p>
              </div>
            </div>

            {/* Settlement Status Indicator */}
            <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs">
              <span className="text-muted-foreground">Settlement status:</span>
              <Badge
                variant="outline"
                className={`capitalize font-medium ${
                  status === "paid"
                    ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                    : status === "partial"
                    ? "border-amber-500/30 bg-amber-50 text-amber-700"
                    : "border-sky-500/30 bg-sky-50 text-sky-700"
                }`}
              >
                {status === "paid" ? "✓ Completed sale" : status === "partial" ? "Partial payment" : "Pending credit"}
              </Badge>
            </div>
          </section>

          {/* People */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <User className="h-3.5 w-3.5" /> Customer & staff
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-sm">Staff *</Label>
                <Select value={staff} onValueChange={setStaff}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select staff">
                      {staff ? getLastName(staff) : "Select staff"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {activeStaff.map((e) => (
                      <SelectItem key={e.id} value={e.name}>{getLastName(e.name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.staff && <p className="mt-1 text-xs text-destructive">{errors.staff}</p>}
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Customer</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={customer}
                    onChange={(e) => updateCustomerName(e.target.value)}
                    onFocus={() => setCustomerFocused(true)}
                    onBlur={() => window.setTimeout(() => setCustomerFocused(false), 140)}
                    placeholder={`${WALK_IN} or search by name / telephone`}
                    className="pl-8 pr-8"
                  />
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={clearCustomerProfile}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Clear selected customer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {selectedCustomer ? (
                  <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/70 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium text-emerald-900">
                        <Check className="h-3.5 w-3.5" /> Linked to {selectedCustomer.reference}
                      </span>
                      <Badge variant="outline" className="capitalize">{selectedCustomer.tier}</Badge>
                    </div>
                    <p className="mt-1 text-emerald-800">
                      {selectedCustomer.paymentTerms.replace("_", " ").toUpperCase()}
                      {selectedCustomer.creditLimit > 0 ? ` · Credit ${fmt(selectedCustomer.creditLimit)}` : ""}
                    </p>
                  </div>
                ) : showCustomerMatches ? (
                  <div className="mt-2 overflow-hidden rounded-md border bg-white shadow-sm">
                    {customersLoading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Searching customers...</div>
                    ) : matchingCustomers.length > 0 ? (
                      matchingCustomers.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectCustomerProfile(profile);
                          }}
                          className="flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60"
                        >
                          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                            {profile.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{profile.name}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">{profile.reference}</span>
                            </div>
                            <div className="truncate text-xs text-muted-foreground flex items-center gap-1.5">
                              <span className="font-mono text-primary font-medium">{profile.phone || "No telephone"}</span>
                              {[profile.email, profile.contactPerson].filter(Boolean).length > 0 && (
                                <span>· {[profile.email, profile.contactPerson].filter(Boolean).join(" · ")}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="flex gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        No database match. Keep typing and fill phone/email manually.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-muted-foreground">Leave blank for walk-in, or type to search existing customers.</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-sm">Telephone</Label>
                <Input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+254 700 000 000" />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>
            </div>
          </section>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? "Saving..." : `Complete sale · ${fmt(totalAmount)}`}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

