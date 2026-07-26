import "@/styles.css";
import { bootstrap } from "@/bootstrap";
import { SidePanelApp } from "./SidePanelApp";

void bootstrap({
  surface: "sidepanel",
  render: () => <SidePanelApp />,
});
