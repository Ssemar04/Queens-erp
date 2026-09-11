import { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown, TrendingUp, Sparkles } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { MovementType, type Item, type StockMovement } from "@/types/inventory";

type SortDir = "asc" | "desc" | null;
type SortKey = "name" | "sku" | "currentStock" | "sellingPrice" | "sold" | "profit";

export interface SortState { key: SortKey | null; dir: SortDir }

interface Row {
  item: Item;
  sold: number;
  profit: number;
}

interface Props {
  items: Item[];
  movements: StockMovement[];
  sort: SortState;
  onSortChange: (s: SortState) => void;
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  onRowClick?: (item: Item) => void;
  actionRenderer?: (item: Item) => React.ReactNode;
  showCheckboxes?: boolean;
}

const PER_PAGE = 20;
const fmt = (n: number) => n.toLocaleString();
const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "UGX", maximumFractionDigits: 0 });

export function InventoryTable({
  items, movements, sort, onSortChange, selected, onSelectedChange,
  onRowClick, actionRenderer, showCheckboxes = true,
}: Props) {
  const [page, setPage] = useState(0);
  const isMobile = useIsMobile();

  const soldByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of movements) {
      if (mv.type === MovementType.Shipped) {
        m.set(mv.itemId, (m.get(mv.itemId) ?? 0) + Math.abs(mv.quantity));
      }
    }
    return m;
  }, [movements]);

  const rows: Row[] = useMemo(
    () => items.map((item) => {
      const sold = soldByItem.get(item.id) ?? 0;
      const profit = sold * Math.max(0, item.sellingPrice - item.costPrice);
      return { item, sold, profit };
    }),
    [items, soldByItem],
  );

  const sorted = useMemo(() => {
    if (!sort.key || !sort.dir) return rows;
    const k = sort.key, dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const get = (r: Row) =>
        k === "sold" ? r.sold : k === "profit" ? r.profit : (r.item[k as keyof Item] ?? "") as string | number;
      const av = get(a), bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);
  const start = safePage * PER_PAGE;

  const toggleSort = (key: SortKey) => {
    if (sort.key !== key) { onSortChange({ key, dir: "asc" }); setPage(0); }
    else if (sort.dir === "asc") { onSortChange({ key, dir: "desc" }); setPage(0); }
    else onSortChange({ key: null, dir: null });
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sort.key !== col
      ? <ChevronsUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />
      : sort.dir === "asc"
        ? <ArrowUp className="ml-1 inline h-3 w-3" />
        : <ArrowDown className="ml-1 inline h-3 w-3" />;

  const allSelected = paged.length > 0 && paged.every((r) => selected.has(r.item.id));
  const maxProfit = useMemo(() => Math.max(1, ...rows.map((r) => r.profit)), [rows]);

  if (sorted.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No items in inventory</p>;
  }

  const ProfitChip = ({ value }: { value: number }) => {
    const pct = Math.min(100, Math.round((value / maxProfit) * 100));
    return (
      <span className="inline-flex items-center gap-2">
        <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          {money(value)}
        </span>
      </span>
    );
  };

  const pagination = (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>Showing {start + 1}–{Math.min(start + PER_PAGE, sorted.length)} of {sorted.length} items</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => { setPage(safePage - 1); onSelectedChange(new Set()); }}>Previous</Button>
        <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => { setPage(safePage + 1); onSelectedChange(new Set()); }}>Next</Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div>
        <div className="space-y-3">
          {paged.map((r, idx) => (
            <Card key={r.item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick?.(r.item)}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium truncate">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">#{start + idx + 1}</span>
                    {r.item.name}
                  </CardTitle>
                  <span className="font-mono text-xs text-muted-foreground">{r.item.sku}</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-sm">
                <p className="line-clamp-2 text-xs text-muted-foreground">{r.item.description || "—"}</p>
                <div className="flex justify-between"><span className="text-muted-foreground">Qty</span><span className="font-mono">{fmt(r.item.currentStock)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Unit price</span><span className="font-mono">{money(r.item.sellingPrice)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sold</span><span className="font-mono">{fmt(r.sold)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Profit</span><ProfitChip value={r.profit} /></div>
                {actionRenderer && <div className="pt-1" onClick={(e) => e.stopPropagation()}>{actionRenderer(r.item)}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
        {pagination}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-border bg-white">
        <Table>
          <TableHeader className="sticky top-0 bg-gradient-to-r from-card to-muted/40">
            <TableRow>
              {showCheckboxes && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => onSelectedChange(v ? new Set(paged.map((r) => r.item.id)) : new Set())}
                  />
                </TableHead>
              )}
              <TableHead className="w-14 text-muted-foreground">#</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>Item name<SortIcon col="name" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("sku")}>Item code<SortIcon col="sku" /></TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("currentStock")}>Quantity<SortIcon col="currentStock" /></TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("sellingPrice")}>Unit price<SortIcon col="sellingPrice" /></TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("sold")}>
                <span className="inline-flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />Items sold<SortIcon col="sold" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("profit")}>
                <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-emerald-500" />Total profits<SortIcon col="profit" /></span>
              </TableHead>
              <TableHead className="w-20 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((r, idx) => {
              const lowStock = r.item.currentStock > 0 && r.item.currentStock <= r.item.reorderPoint;
              const outStock = r.item.currentStock === 0;
              return (
                <TableRow
                  key={r.item.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/40",
                    selected.has(r.item.id) && "bg-primary/5",
                  )}
                  onClick={() => onRowClick?.(r.item)}
                >
                  {showCheckboxes && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(r.item.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(selected);
                          if (v) {
                            next.add(r.item.id);
                          } else {
                            next.delete(r.item.id);
                          }
                          onSelectedChange(next);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-xs text-muted-foreground">{String(start + idx + 1).padStart(3, "0")}</TableCell>
                  <TableCell className="font-medium">{r.item.name}</TableCell>
                  <TableCell><span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{r.item.sku}</span></TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground" title={r.item.description}>
                    {r.item.description || <span className="italic text-muted-foreground/60">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "font-mono text-sm",
                      outStock && "text-destructive font-semibold",
                      lowStock && "text-amber-600 font-semibold",
                    )}>{fmt(r.item.currentStock)}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{money(r.item.sellingPrice)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(r.sold)}</TableCell>
                  <TableCell><ProfitChip value={r.profit} /></TableCell>
                  {actionRenderer
                    ? <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>{actionRenderer(r.item)}</TableCell>
                    : <TableCell />}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {pagination}
    </div>
  );
}
