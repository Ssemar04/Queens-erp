import { cn } from "@/lib/utils";

export type AppContentSize = "narrow" | "standard" | "wide" | "fluid";
export type AppContentSpace = "sm" | "md" | "lg" | "xl";

interface AppContentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  size?: AppContentSize;
  space?: AppContentSpace;
  centered?: boolean;
  noPadding?: boolean;
  fluidMobile?: boolean;
  as?: "div" | "section" | "article" | "main";
}

const containerMap: Record<AppContentSize, string> = {
  narrow: "w-full max-w-full",
  standard: "w-full max-w-full",
  wide: "w-full max-w-full",
  fluid: "w-full max-w-full",
};

const spaceMap: Record<AppContentSpace, string> = {
  sm: "space-y-[var(--sp-fluid-3)]",
  md: "space-y-[var(--sp-fluid-4)]",
  lg: "space-y-[var(--sp-fluid-5)]",
  xl: "space-y-[var(--sp-fluid-7)]",
};

export function AppContent({
  size = "standard",
  space = "md",
  centered = true,
  noPadding = false,
  fluidMobile = true,
  className,
  children,
  as: Tag = "div",
  ...props
}: AppContentProps) {
  const Comp = Tag as "div";
  return (
    <Comp
      {...(props as React.HTMLAttributes<HTMLDivElement>)}
      className={cn(
        "w-full h-full relative",
        !noPadding && [
          "px-[var(--sp-fluid-4)] py-[var(--sp-fluid-4)]",
          "md:px-[var(--sp-fluid-6)] md:py-[var(--sp-fluid-6)]",
          "xl:px-[var(--sp-fluid-8)]",
        ],
        noPadding && "px-0 py-0",
        !fluidMobile && "md:px-0",
        className,
      )}
    >
      <div
        className={cn(
          "w-full relative",
          centered && "mx-auto",
          containerMap[size],
          spaceMap[space],
        )}
      >
        {children}
      </div>
    </Comp>
  );
}

interface AppHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Reduce vertical density when scrolled */
  compact?: boolean;
  /** Adds subtle separator at bottom */
  separator?: boolean;
  /** Stacks title/description vs inline with actions */
  stacked?: boolean;
}

export function AppHeader({
  compact = false,
  separator = true,
  stacked = false,
  className,
  children,
  ...props
}: AppHeaderProps) {
  return (
    <div
      {...props}
      className={cn(
        "w-full relative flex shrink-0 items-end gap-[var(--sp-fluid-3)] transition-all duration-200",
        stacked ? "flex-col items-start" : "flex-col sm:flex-row sm:items-center sm:justify-between",
        compact
          ? "pb-[var(--sp-fluid-2)] pt-0"
          : "pb-[var(--sp-fluid-5)] pt-[var(--sp-fluid-1)]",
        separator && "border-b border-border/60",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface AppTitleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
}

export function AppTitle({ eyebrow, title, description, className, ...props }: AppTitleProps) {
  return (
    <div className={cn("min-w-0 max-w-full", className)} {...props}>
      {eyebrow && (
        <p className="mb-1 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h1 className="truncate font-bold tracking-tight text-foreground leading-[1.1] text-[clamp(1.5rem,2.6vw,2.25rem)]">
        {title}
      </h1>
      {description && (
        <p className="mt-1.5 text-[clamp(0.8125rem,1vw,0.9375rem)] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

interface AppActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true, wraps to new row on mobile instead of overflow */
  wrapOnMobile?: boolean;
}

export function AppActions({
  wrapOnMobile = true,
  className,
  children,
  ...props
}: AppActionsProps) {
  return (
    <div
      {...props}
      className={cn(
        "shrink-0 flex items-center gap-[var(--sp-fluid-2)]",
        wrapOnMobile
          ? "flex-wrap w-full sm:w-auto justify-start sm:justify-end"
          : "flex-nowrap justify-end max-w-full overflow-x-auto pb-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface StatsGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of cards / target columns hint (used to derive adaptive min-col width) */
  count?: number;
  /** Responsive column count presets; true uses auto-fit */
  adaptive?: boolean;
}

export function StatsGrid({
  count,
  adaptive = true,
  className,
  children,
  style,
  ...props
}: StatsGridProps) {
  const min = count && count >= 4 ? "180px" : count && count === 3 ? "220px" : count && count === 2 ? "260px" : "200px";
  const cols = adaptive
    ? {
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))`,
      }
    : undefined;
  return (
    <div
      {...props}
      className={cn(
        "grid gap-[var(--sp-fluid-3)] md:gap-[var(--sp-fluid-4)] w-full",
        !adaptive && "grid-cols-2 lg:grid-cols-4",
        className,
      )}
      style={{ ...cols, ...style }}
    >
      {children}
    </div>
  );
}

interface ContentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  hoverLift?: boolean;
}

export function ContentCard({
  padded = true,
  hoverLift = false,
  className,
  children,
  ...props
}: ContentCardProps) {
  return (
    <div
      {...props}
      className={cn(
        "w-full rounded-[var(--radius-fluid-card)] border border-border/70 bg-card text-card-foreground shadow-sm transition-all duration-200",
        padded && "p-[var(--sp-fluid-4)] md:p-[var(--sp-fluid-5)]",
        hoverLift && "hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}
