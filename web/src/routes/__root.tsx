import "../index.css";
import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "arch-doc — Vault Editor" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body onContextMenu={(e) => e.preventDefault()}>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}

// Required for TanStack Start SSR — ensures component is typed as ReactNode
export type { ReactNode };
