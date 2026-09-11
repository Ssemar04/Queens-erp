
import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { getLoyaltyTiers, createLoyaltyTier, updateLoyaltyTier, deleteLoyaltyTier, type LoyaltyTier } from "@/services/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoyaltyTiersSheet({ open, onOpenChange }: Props) {
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Partial<LoyaltyTier>>({});
  const [newTier, setNewTier] = useState({ name: "", minPoints: 0, maxPoints: "", color: "#0EA5E9" });

  useEffect(() => {
    if (open) {
      loadTiers();
    }
  }, [open]);

  async function loadTiers() {
    try {
      setTiers(await getLoyaltyTiers());
    } catch (error) {
      toast.error("Failed to load loyalty tiers");
    }
  }

  async function handleCreateTier() {
    if (!newTier.name) return;
    try {
      const tier = await createLoyaltyTier({
        name: newTier.name,
        minPoints: newTier.minPoints,
        maxPoints: newTier.maxPoints ? parseInt(newTier.maxPoints) : undefined,
        color: newTier.color,
      });
      setTiers([...tiers, tier]);
      setNewTier({ name: "", minPoints: 0, maxPoints: "", color: "#0EA5E9" });
      toast.success("Tier created");
    } catch (error) {
      toast.error("Failed to create tier");
    }
  }

  async function handleSaveEdit(tier: LoyaltyTier) {
    try {
      const updated = await updateLoyaltyTier(tier.id, {
        name: editBuffer.name,
        minPoints: editBuffer.minPoints,
        maxPoints: editBuffer.maxPoints,
        color: editBuffer.color,
      });
      setTiers(tiers.map(t => t.id === tier.id ? updated : t));
      setEditingId(null);
      setEditBuffer({});
      toast.success("Tier updated");
    } catch (error) {
      toast.error("Failed to update tier");
    }
  }

  async function handleDeleteTier(id: string) {
    if (!confirm("Delete this tier?")) return;
    try {
      await deleteLoyaltyTier(id);
      setTiers(tiers.filter(t => t.id !== id));
      toast.success("Tier deleted");
    } catch (error) {
      toast.error("Failed to delete tier");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Loyalty Tiers</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Tier name</Label>
                  <Input
                    value={newTier.name}
                    onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                    placeholder="e.g. Bronze"
                  />
                </div>
                <div>
                  <Label>Min points</Label>
                  <Input
                    type="number"
                    value={newTier.minPoints}
                    onChange={(e) => setNewTier({ ...newTier, minPoints: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Max points (optional)</Label>
                  <Input
                    type="number"
                    value={newTier.maxPoints}
                    onChange={(e) => setNewTier({ ...newTier, maxPoints: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={newTier.color}
                    onChange={(e) => setNewTier({ ...newTier, color: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleCreateTier} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add tier
              </Button>
            </CardContent>
          </Card>

          {tiers.map((tier) => (
            <Card key={tier.id}>
              <CardContent className="p-4 space-y-3">
                {editingId === tier.id ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label>Tier name</Label>
                        <Input
                          value={editBuffer.name ?? tier.name}
                          onChange={(e) => setEditBuffer({ ...editBuffer, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Min points</Label>
                        <Input
                          type="number"
                          value={editBuffer.minPoints ?? tier.minPoints}
                          onChange={(e) => setEditBuffer({ ...editBuffer, minPoints: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Max points (optional)</Label>
                        <Input
                          type="number"
                          value={editBuffer.maxPoints ?? tier.maxPoints ?? ""}
                          onChange={(e) => setEditBuffer({ ...editBuffer, maxPoints: e.target.value ? parseInt(e.target.value) : undefined })}
                        />
                      </div>
                      <div>
                        <Label>Color</Label>
                        <Input
                          type="color"
                          value={editBuffer.color ?? tier.color}
                          onChange={(e) => setEditBuffer({ ...editBuffer, color: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleSaveEdit(tier)} className="flex-1">
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => { setEditingId(null); setEditBuffer({}); }}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: tier.color }}
                        />
                        <h3 className="font-medium">{tier.name}</h3>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingId(tier.id); setEditBuffer(tier); }}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTier(tier.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tier.minPoints.toLocaleString()} - {tier.maxPoints ? tier.maxPoints.toLocaleString() : "∞"} points
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <SheetFooter className="mt-6">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
