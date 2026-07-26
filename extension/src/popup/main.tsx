import "@/styles.css";
import { bootstrap } from "@/bootstrap";
import { PopupApp } from "./PopupApp";

void bootstrap({
  surface: "popup",
  render: () => <PopupApp />,
});
