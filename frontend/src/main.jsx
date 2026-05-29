/**
 * Application entry — providers + root render.
 *
 * Provider order (outer → inner):
 *   StrictMode  →  BrowserRouter  →  QueryClientProvider  →  App
 *
 * Phase 2.1 adds:
 *   - QueryClientProvider (TanStack Query)
 *   - ReactQueryDevtools (development only)
 *   - react-hot-toast Toaster mounted at root
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";

import App from "./App";
import { queryClient } from "./lib/queryClient";
import "./index.css";

const isDev = import.meta.env.DEV;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#0f172a",
              color: "#e2e8f0",
              border: "1px solid #1e293b",
            },
            success: { iconTheme: { primary: "#22c55e", secondary: "#0f172a" } },
            error:   { iconTheme: { primary: "#ef4444", secondary: "#0f172a" } },
          }}
        />
        {isDev && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
