import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Package, ArrowRight, Mail, Lock } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in · Queens tech ERP" },
      {
        name: "description",
        content:
          "Sign in to Queens tech ERP · the inventory command center for real-time tracking, smart reorders, and supplier management.",
      },
      { property: "og:title", content: "Sign in · Queens tech ERP" },
      {
        property: "og:description",
        content:
          "Sign in to Queens tech ERP · the inventory command center for modern teams.",
      },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        setError(signInError.message || "Login failed");
        return;
      }

      await navigate({ to: "/app/dashboard" });
    } catch (err) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(message || (err instanceof Error ? err.message : "Unable to connect to the backend"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Package className="h-7 w-7 text-primary" />
            <span className="text-xl font-semibold tracking-tight">
              Queens tech ERP
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your inventory command center
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium"
              >
                Email
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  suppressHydrationWarning
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="admin@queenstech.com"
                  className="w-full rounded-lg border border-input bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium"
                >
                  Password
                </label>

                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() =>
                    setError(
                      "Contact your System Administrator for password reset."
                    )
                  }
                >
                  Forgot?
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  suppressHydrationWarning
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="********"
                  className="w-full rounded-lg border border-input bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                />
              </div>
            </div>

            {error && (
              <p
                className="text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Signing In..." : "Sign In"}

              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>

          </form>

        </div>

      </div>
    </main>
  );
}
