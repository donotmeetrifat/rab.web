import React from "react";
import { createRoot } from "react-dom/client";
import "@/styles.css";
import { PopupApp } from "./PopupApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";

const container = document.getElementById("root");
if (!container) throw new Error("Popup root missing");
createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <PopupApp />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
