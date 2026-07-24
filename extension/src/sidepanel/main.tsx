import React from "react";
import { createRoot } from "react-dom/client";
import "@/styles.css";
import { SidePanelApp } from "./SidePanelApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";

const container = document.getElementById("root");
if (!container) throw new Error("Side panel root missing");
createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <SidePanelApp />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
