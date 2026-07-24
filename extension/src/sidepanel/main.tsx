import React from "react";
import { createRoot } from "react-dom/client";
import "@/styles.css";
import { SidePanelApp } from "./SidePanelApp";

const container = document.getElementById("root");
if (!container) throw new Error("Side panel root missing");
createRoot(container).render(
  <React.StrictMode>
    <SidePanelApp />
  </React.StrictMode>,
);
