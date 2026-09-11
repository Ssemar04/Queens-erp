import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useCreateLocation, useUpdateLocation } from "@/hooks/useInventoryMutations";
import type { Location } from "@/types/inventory";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  street: z.string().min(1, "Street is required").max(120),
  building: z.string().max(120),
  floor: z.string().max(60),
  roomNumber: z.string().max(60),
  branchManager: z.string().min(1, "Branch manager is required").max(120),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface LocationFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLocation?: Location | null;
}

function buildAddress(values: Pick<FormValues, "street" | "building" | "floor" | "roomNumber">) {
  return [values.street, values.building, values.floor, values.roomNumber]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

export function LocationFormSheet({ open, onOpenChange, editLocation }: LocationFormSheetProps) {
  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();
  const isEdit = !!editLocation;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      street: "",
      building: "",
      floor: "",
      roomNumber: "",
      branchManager: "",
      isActive: true,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (open && editLocation) {
      form.reset({
        name: editLocation.name,
        street: editLocation.street ?? "",
        building: editLocation.building ?? "",
        floor: editLocation.floor ?? "",
        roomNumber: editLocation.roomNumber ?? "",
        branchManager: editLocation.branchManager ?? "",
        isActive: editLocation.isActive,
      });
    } else if (open) {
      form.reset({
        name: "",
        street: "",
        building: "",
        floor: "",
        roomNumber: "",
        branchManager: "",
        isActive: true,
      });
    }
  }, [open, editLocation, form]);

  function onSubmit(values: FormValues) {
    const address = buildAddress(values);
    if (isEdit && editLocation) {
      updateMutation.mutate(
        {
          id: editLocation.id,
          updates: {
            name: values.name,
            street: values.street,
            building: values.building,
            floor: values.floor,
            roomNumber: values.roomNumber,
            branchManager: values.branchManager,
            address,
            isActive: values.isActive,
          },
        },
        {
          onSuccess: () => {
            toast.success("Branch updated");
            onOpenChange(false);
          },
          onError: (e) => toast.error(e.message || "Failed to update branch."),
        },
      );
    } else {
      const newLocation: Location = {
        id: `loc-${Date.now()}`,
        name: values.name,
        description: "",
        street: values.street,
        building: values.building,
        floor: values.floor,
        roomNumber: values.roomNumber,
        branchManager: values.branchManager,
        isActive: values.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: "warehouse",
        parentId: null,
        address,
      };
      createMutation.mutate(newLocation, {
        onSuccess: () => {
          toast.success("Branch created");
          onOpenChange(false);
        },
        onError: (e) => toast.error(e.message || "Failed to create branch."),
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Branch" : "New Branch"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update branch details." : "Add a branch with its physical location details."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Main Warehouse" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Kampala Road" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="building"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Queens House" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="floor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 3rd Floor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="roomNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Room 12B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="branchManager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch Manager</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Sarah Nakato" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border border-border p-3">
                  <FormLabel className="cursor-pointer">Active</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isLoading || updateMutation.isLoading}>
                {isEdit ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
