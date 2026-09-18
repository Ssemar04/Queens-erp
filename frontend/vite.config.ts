import path from "path";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function devClientErrorLogger() {
  const VIRTUAL_ID = "virtual:dev-client-error-handler";
  const RESOLVED_ID = "\0" + VIRTUAL_ID;

  return {
    name: "dev-client-error-logger",
    apply: "serve" as const,
    enforce: "pre" as const,

    resolveId(id: string) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },

    load(id: string) {
      if (id !== RESOLVED_ID) return;

      return [
        "if (typeof window !== 'undefined' && import.meta.hot) {",
        "  const isIgnoredBrowserNoise = (d) => {",
        "    const message = d?.message || '';",
        "    const filename = d?.filename || '';",
        "    return (",
        "      (filename.includes('content.js') && message.includes('elementFromPoint')) ||",
        "      message.includes('A listener indicated an asynchronous response by returning true')",
        "    );",
        "  };",
        "",
        "  const send = (d) => {",
        "    if (isIgnoredBrowserNoise(d)) return;",
        "    try {",
        "      import.meta.hot.send('client-runtime-error', d)",
        "    } catch {}",
        "  };",
        "",
        "  window.addEventListener('error', (e) => {",
        "    send({",
        "      type: 'runtime-error',",
        "      message: e.message,",
        "      stack: e.error?.stack,",
        "      filename: e.filename,",
        "      lineno: e.lineno,",
        "      colno: e.colno",
        "    });",
        "  });",
        "",
        "  window.addEventListener('unhandledrejection', (e) => {",
        "    const err = e.reason;",
        "    if (isIgnoredBrowserNoise({ message: err?.message || String(err), stack: err?.stack })) {",
        "      e.preventDefault();",
        "      return;",
        "    }",
        "    send({",
        "      type: 'unhandled-rejection',",
        "      message: err?.message || String(err),",
        "      stack: err?.stack",
        "    });",
        "  });",
        "}",
      ].join("\n");
    },

    configureServer(server: import("vite").ViteDevServer) {
      const originalConsoleError = console.error;
      let forwarding = false;

      console.error = (...args: unknown[]) => {
        originalConsoleError.apply(console, args);

        if (forwarding) return;

        forwarding = true;

        try {
          const error = args[0];

          if (error instanceof Error) {
            server.ws.send({
              type: "custom",
              event: "client-runtime-error",
              data: {
                source: "ssr",
                type: "ssr-render-error",
                name: error.name,
                message: error.message,
                stack: error.stack,
              },
            });
          }
        } finally {
          forwarding = false;
        }
      };

      server.ws.on(
        "client-runtime-error",
        (data: Record<string, string>) => {
          const { type, message, stack, filename, lineno, colno } = data;

          if (
            (filename?.includes("content.js") && message?.includes("elementFromPoint")) ||
            message?.includes("A listener indicated an asynchronous response by returning true")
          ) {
            return;
          }

          const label =
            type === "unhandled-rejection"
              ? "Unhandled Rejection"
              : "Runtime Error";

          let location = "";

          if (filename) {
            location = ` at ${filename}`;

            if (lineno) {
              location += `:${lineno}`;
            }

            if (colno) {
              location += `:${colno}`;
            }
          }

          server.config.logger.error(
            `\n[client] ${label}: ${message}${location}`,
          );

          if (stack) {
            server.config.logger.error(stack);
          }

          server.ws.send({
            type: "custom",
            event: "client-runtime-error",
            data,
          });
        },
      );
    },

    transform(code: string, id: string) {
      const normalizedId = id.replace(/\\/g, "/");

      if (normalizedId.includes("routes/__root")) {
        return `import "${VIRTUAL_ID}";\n${code}`;
      }

      return null;
    },
  };
}

function devServerFnErrorLogger() {
  const HMR_SEND_KEY = "__TANSTACK_SERVER_FN_HMR_SEND__";

  return {
    name: "dev-server-fn-error-logger",
    apply: "serve" as const,
    enforce: "pre" as const,

    configureServer(server: import("vite").ViteDevServer) {
      (
        globalThis as Record<string, unknown>
      )[HMR_SEND_KEY] = (data: unknown) => {
        server.ws.send({
          type: "custom",
          event: "server-fn-error",
          data,
        });
      };
    },

    transform(code: string, id: string) {
      const normalizedId = id.replace(/\\/g, "/");

      const isTargetModule =
        normalizedId.includes(
          "/@tanstack/start-server-core/src/server-functions-handler.ts",
        ) ||
        normalizedId.includes(
          "/@tanstack/start-server-core/dist/esm/server-functions-handler.js",
        );

      if (!isTargetModule) {
        return null;
      }

      const needle = "const unwrapped = res.result || res.error";

      if (!code.includes(needle)) {
        return null;
      }

      return code.replace(
        needle,
        `${needle}

      if (res?.error) {
        const err = res.error;

        const payload = {
          source: 'tanstack',
          type: 'server-fn-error',
          method: request.method,
          url: request.url,
          name: err?.name ?? 'Error',
          message: err?.message ?? String(err),
          stack: typeof err?.stack === 'string'
            ? err.stack
            : undefined,
        };

        globalThis.${HMR_SEND_KEY}?.(payload);
      }`,
      );
    },
  };
}

export default defineConfig(({ command }) => {
  const base = "/";

  return {
    /**
     * IMPORTANT:
     * If deployed to:
     * https://domain.com/queens-erp/
     * keep this value.
     *
     * If deployed to root:
     * https://domain.com/
     * change it to "/"
     */
    base,

    server: {
      host: "::",
      port: 3000,
      strictPort: false,
    },

    preview: {
      host: "::",
      port: 3000,
    },

    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            router: ["@tanstack/react-router", "@tanstack/react-query"],
            ui: [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-avatar",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-collapsible",
              "@radix-ui/react-context-menu",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-hover-card",
              "@radix-ui/react-label",
              "@radix-ui/react-menubar",
              "@radix-ui/react-navigation-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-progress",
              "@radix-ui/react-radio-group",
              "@radix-ui/react-scroll-area",
              "@radix-ui/react-select",
              "@radix-ui/react-separator",
              "@radix-ui/react-slider",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toggle",
              "@radix-ui/react-toggle-group",
              "@radix-ui/react-tooltip",
              "cmdk",
              "vaul",
            ],
            charts: ["recharts"],
          },
        },
      },
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    plugins: [
      tailwindcss(),

      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),

      devClientErrorLogger(),

      devServerFnErrorLogger(),

      tanstackRouter(),

      viteReact(),
    ],
  };
});
