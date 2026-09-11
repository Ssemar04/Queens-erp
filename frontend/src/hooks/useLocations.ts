import { useMemo } from "react";
import { useLocations as useInventoryLocations } from "@/hooks/useInventoryData";
import type { Location } from "@/types/inventory";

export interface LocationTreeNode extends Location {
  children: LocationTreeNode[];
  depth: number;
}

function buildTree(locations: Location[]): LocationTreeNode[] {
  const map = new Map<string, LocationTreeNode>();
  const roots: LocationTreeNode[] = [];

  for (const loc of locations) {
    map.set(loc.id, { ...loc, children: [], depth: 0 });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Set depth recursively for deeper nesting
  function setDepth(nodes: LocationTreeNode[], depth: number) {
    for (const n of nodes) {
      n.depth = depth;
      setDepth(n.children, depth + 1);
    }
  }
  setDepth(roots, 0);

  return roots;
}

export function useLocations() {
  return useInventoryLocations();
}

export function useLocationTree() {
  const { data: locations } = useLocations();

  return useMemo(() => buildTree(locations), [locations]);
}
