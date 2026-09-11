import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
const normalizedBasePath = basePath === "/" ? "/" : `${basePath}/`;

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    basepath: normalizedBasePath,
  });

  return router;
};
