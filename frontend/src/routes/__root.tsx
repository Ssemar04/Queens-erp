import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoProvider } from "@/contexts/DemoContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { SettingsProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/query-client";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Queenstech ERP" },
      { name: "description", content: "Manage inventory with real-time stock tracking, supplier management, purchase orders, and AI-powered demand forecasting. Includes role-based access, barcode sup" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Queenstech ERP" },
      { property: "og:description", content: "Manage inventory with real-time stock tracking, supplier management, purchase orders, and AI-powered demand forecasting. Includes role-based access, barcode sup" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ce8fd1f7-8ca4-425d-a29c-052d48d54d68/id-preview-991ef288--eaf13a24-9d23-4ea5-ae81-bd8ed9669775.lovable.app-1774415671292.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ce8fd1f7-8ca4-425d-a29c-052d48d54d68/id-preview-991ef288--eaf13a24-9d23-4ea5-ae81-bd8ed9669775.lovable.app-1774415671292.png" },
      { name: "twitter:title", content: "Queenstech ERP" },
      { name: "twitter:description", content: "Manage inventory with real-time stock tracking, supplier management, purchase orders, and AI-powered demand forecasting. Includes role-based access, barcode sup" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DemoProvider>
          <TooltipProvider>
            <RealtimeBridge />
            <SettingsProvider>
              <RoleProvider>
                <ErrorBoundary>
                  <Outlet />
                </ErrorBoundary>
                <Toaster position="bottom-right" richColors />
              </RoleProvider>
            </SettingsProvider>
          </TooltipProvider>
        </DemoProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RealtimeBridge() {
  useRealtimeInvalidation();
  return null;
}

function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div className="max-w-md">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you opened does not exist or has moved.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Back to sign in</Link>
        </Button>
      </div>
    </main>
  );
}
