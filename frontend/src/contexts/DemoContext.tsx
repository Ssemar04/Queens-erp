import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DemoStore } from "@/lib/demo-store";

export interface DemoContextValue {
  isDemo: boolean;
  demoStore: DemoStore;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  resetDemoData: () => void;
  /** Increment after any store mutation to trigger re-renders */
  bumpVersion: () => void;
  version: number;
}

export const DemoContext = createContext<DemoContextValue | null>(null);

const DEMO_MODE_KEY = "qterp:demo-mode";
const FRONTEND_DATA_KEYS = [
  DEMO_MODE_KEY,
  "notification-prefs",
  "custom-field-defs",
  "reorder-defaults",
  "qterp-settings",
];

function getInitialDemoMode() {
  return false;
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(getInitialDemoMode);
  const [store, setStore] = useState(() => new DemoStore());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    FRONTEND_DATA_KEYS.forEach((key) => window.localStorage.removeItem(key));
  }, []);

  const enterDemoMode = useCallback(() => {
    setIsDemo(false);
    window.localStorage.removeItem(DEMO_MODE_KEY);
    setStore(new DemoStore());
    setVersion(0);
  }, []);

  const exitDemoMode = useCallback(() => {
    setIsDemo(false);
    window.localStorage.removeItem(DEMO_MODE_KEY);
    setStore(new DemoStore());
    setVersion(0);
  }, []);

  const resetDemoData = useCallback(() => {
    setStore(new DemoStore());
    setVersion(0);
  }, []);

  const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo<DemoContextValue>(
    () => ({
      isDemo,
      demoStore: store,
      enterDemoMode,
      exitDemoMode,
      resetDemoData,
      bumpVersion,
      version,
    }),
    [isDemo, store, enterDemoMode, exitDemoMode, resetDemoData, bumpVersion, version],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
