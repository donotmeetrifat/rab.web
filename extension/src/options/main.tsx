import React from "react";
import { createRoot } from "react-dom/client";
import "@/styles.css";
import { OptionsApp } from "./OptionsApp";

const container = document.getElementById("root");
if (!container) throw new Error("Options root missing");
createRoot(container).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
