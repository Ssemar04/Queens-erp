import { useMemo } from "react";
import { Building2, DollarSign, Edit2, ExternalLink, MapPin, Package, ShoppingCart, UserRound, AlertTriangle, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getBranchDashboard, type BranchDashboardStats } from "@/services/api";
import type { Item, Location } from "@/types/inventory";

interface LocationSummaryProps {
  branch: Location;
  items: Item[];
  onEdit: () => void;
  canEdit?: boolean;
}

function formatAddress(branch: Location) {
  const address = [branch.street, branch.building, branch.floor, branch.roomNumber]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(", ");
  return address || (typeof branch.address === "string" ? branch.address.trim() : "");
}

export function LocationSummary({ branch, items, onEdit, canEdit = true }: LocationSummaryProps) {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<BranchDashboardStats>({
    queryKey: ["branch-dashboard", branch.id],
    queryFn: () => getBranchDashboard(branch.id),
  });

  const locationItems = useMemo(() => {
    return items.filter((item) => item.branchId === branch.id || item.locationId === branch.id);
  }, [branch.id, items]);

  const totalValue = useMemo(
    () => locationItems.reduce((sum, i) => sum + i.currentStock * i.costPrice, 0),
    [locationItems],
  );

  const top10 = useMemo(() => locationItems.slice(0, 10), [locationItems]);
  const formattedAddress = useMemo(() => formatAddress(branch), [branch]);

  const displayStats = stats || {
    items_count: locationItems.length,
    total_value: totalValue,
    low_stock_count: 0,
    out_of_stock_count: 0,
    sales_count: 0,
    daily_transactions_value: 0,
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{branch.name}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formattedAddress || "Address details not set yet"}
            </p>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit2 className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {/* Items Card */}
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            Items
          </div>
          <p className="mt-1 text-xl font-semibold text-foreground">{displayStats.items_count}</p>
        </div>
        
        {/* Sales Card */}
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShoppingCart className="h-3.5 w-3.5" />
            Sales
          </div>
          <p className="mt-1 text-xl font-semibold text-foreground">{displayStats.sales_count}</p>
        </div>
        
        {/* Total Value Card */}
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            Total Value
          </div>
          <p className="mt-1 text-xl font-semibold text-foreground">
            ${displayStats.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        
        {/* Daily Transactions Value */}
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            Daily Sales
          </div>
          <p className="mt-1 text-xl font-semibold text-foreground">
            ${displayStats.daily_transactions_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        
        {/* Low Stock */}
        <div className="rounded-md border border-border bg-yellow-50 p-3">
          <div className="flex items-center gap-2 text-xs text-yellow-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Low Stock
          </div>
          <p className="mt-1 text-xl font-semibold text-yellow-900">{displayStats.low_stock_count}</p>
        </div>
        
        {/* Out of Stock */}
        <div className="rounded-md border border-border bg-red-50 p-3">
          <div className="flex items-center gap-2 text-xs text-red-700">
            <XCircle className="h-3.5 w-3.5" />
            Out of Stock
          </div>
          <p className="mt-1 text-xl font-semibold text-red-900">{displayStats.out_of_stock_count}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Street
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{branch.street || "Not set"}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" />
            Branch Manager
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">
            {branch.branchManager || "Not assigned"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <div className="text-xs text-muted-foreground">Building</div>
          <p className="mt-1 text-sm font-medium text-foreground">{branch.building || "Not set"}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <div className="text-xs text-muted-foreground">Floor / Room</div>
          <p className="mt-1 text-sm font-medium text-foreground">
            {[branch.floor, branch.roomNumber].filter(Boolean).join(" · ") || "Not set"}
          </p>
        </div>
      </div>

      {/* Branch Receipt Header Customization Info */}
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
          Receipt Header Customization
        </h4>
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Header Title: </span>
            <span className="font-medium text-foreground">{branch.receiptTitle || branch.name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Contact Line: </span>
            <span className="font-medium text-foreground">{branch.contactLine || branch.phone || "Company default"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tax / TIN ID: </span>
            <span className="font-medium text-foreground">{branch.taxId || "Company default"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Receipt Slogan: </span>
            <span className="font-medium text-foreground">{branch.receiptSlogan || "Company default"}</span>
          </div>
        </div>
      </div>

      {locationItems.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No items are currently assigned to this branch
        </p>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            Top Items {locationItems.length > 10 && `(${locationItems.length} total)`}
          </h3>
          <div className="divide-y divide-border rounded-md border border-border">
            {top10.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{item.currentStock} {item.unit}</span>
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </div>
          <a
            href={`/app/catalog?branch=${branch.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all in catalog
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
