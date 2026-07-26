import React from "react";
import { createRoot } from "react-dom/client";
import "@/core/subscribers";
import "@/styles.css";
import { OptionsApp } from "./OptionsApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";

const container = document.getElementById("root");
if (!container) throw new Error("Options root missing");
createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <OptionsApp />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
