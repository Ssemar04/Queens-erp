import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

export interface TourStep {
  target?: string; // data-tour attribute value
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function useOnboarding(tourId: string) {
  const { user } = useAuth();
  const storageKey = useMemo(
    () => `qterp:onboarding:${tourId}:${user?.id ?? "anonymous"}`,
    [tourId, user?.id],
  );
  const [hasCompleted, setHasCompleted] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(storageKey) === "completed";
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    setHasCompleted(window.localStorage.getItem(storageKey) === "completed");
    setIsActive(false);
    setCurrentStep(0);
  }, [storageKey]);

  const markCompleted = useCallback(() => {
    window.localStorage.setItem(storageKey, "completed");
    setHasCompleted(true);
    setIsActive(false);
  }, [storageKey]);

  const startTour = useCallback(() => {
    if (!hasCompleted) {
      setCurrentStep(0);
      setIsActive(true);
    }
  }, [hasCompleted]);

  const skipTour = useCallback(() => {
    markCompleted();
  }, [markCompleted]);

  const completeTour = useCallback(() => {
    markCompleted();
  }, [markCompleted]);

  const next = useCallback(() => setCurrentStep((s) => s + 1), []);
  const back = useCallback(() => setCurrentStep((s) => Math.max(0, s - 1)), []);

  const resetTour = useCallback(() => {
    window.localStorage.removeItem(storageKey);
    setHasCompleted(false);
    setIsActive(false);
    setCurrentStep(0);
  }, [storageKey]);

  return { hasCompleted, currentStep, isActive, startTour, skipTour, completeTour, next, back, resetTour };
}
