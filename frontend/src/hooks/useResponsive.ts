import * as React from "react";

export type BreakpointKey = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export const BREAKPOINTS: Record<BreakpointKey, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

function matchWidth(breakpoint: BreakpointKey) {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(min-width: ${BREAKPOINTS[breakpoint]}px)`).matches;
}

export interface UseResponsiveReturn {
  width: number;
  height: number;
  breakpoint: BreakpointKey;
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  is2xl: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  orientation: "portrait" | "landscape";
  reducedMotion: boolean;
}

export function useResponsive(): UseResponsiveReturn {
  const [sizes, setSizes] = React.useState<{ w: number; h: number }>(() =>
    typeof window === "undefined"
      ? { w: 1024, h: 768 }
      : { w: window.innerWidth, h: window.innerHeight },
  );

  const reducedMotion = React.useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,
    [],
  );

  React.useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(
        () => setSizes({ w: window.innerWidth, h: window.innerHeight }),
        40,
      );
    };
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const breakpoint = React.useMemo<BreakpointKey>(() => {
    const { w } = sizes;
    if (w >= BREAKPOINTS["2xl"]) return "2xl";
    if (w >= BREAKPOINTS.xl) return "xl";
    if (w >= BREAKPOINTS.lg) return "lg";
    if (w >= BREAKPOINTS.md) return "md";
    if (w >= BREAKPOINTS.sm) return "sm";
    return "xs";
  }, [sizes.w]);

  return {
    width: sizes.w,
    height: sizes.h,
    breakpoint,
    isXs: matchWidth("xs"),
    isSm: matchWidth("sm"),
    isMd: matchWidth("md"),
    isLg: matchWidth("lg"),
    isXl: matchWidth("xl"),
    is2xl: matchWidth("2xl"),
    isMobile: sizes.w < BREAKPOINTS.md,
    isTablet: sizes.w >= BREAKPOINTS.md && sizes.w < BREAKPOINTS.lg,
    isDesktop: sizes.w >= BREAKPOINTS.lg,
    isLargeDesktop: sizes.w >= BREAKPOINTS.xl,
    orientation: sizes.h >= sizes.w ? "portrait" : "landscape",
    reducedMotion,
  };
}

export type ScrollDirection = "up" | "down" | "none";

export interface UseScrollDirectionOptions {
  thresholdPx?: number;
  windowScoped?: boolean;
}

export function useScrollDirection(
  options: UseScrollDirectionOptions = {},
): { direction: ScrollDirection; scrollY: number; atTop: boolean; scrolled: boolean } {
  const { thresholdPx = 4, windowScoped = true } = options;
  const lastYRef = React.useRef(0);
  const lastDirRef = React.useRef<ScrollDirection>("none");
  const [state, setState] = React.useState<{
    direction: ScrollDirection;
    scrollY: number;
    atTop: boolean;
    scrolled: boolean;
  }>({ direction: "none", scrollY: 0, atTop: true, scrolled: false });

  React.useEffect(() => {
    if (typeof window === "undefined" || !windowScoped) return;

    const update = () => {
      const current = window.scrollY;
      const diff = current - lastYRef.current;
      const moved = Math.abs(diff);
      let nextDir: ScrollDirection = lastDirRef.current;
      if (moved > thresholdPx) {
        nextDir = diff > 0 ? "down" : "up";
        lastDirRef.current = nextDir;
        lastYRef.current = current;
      }
      setState({
        direction: nextDir,
        scrollY: current,
        atTop: current < 6,
        scrolled: current > 8,
      });
    };

    update();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [thresholdPx, windowScoped]);

  return state;
}
