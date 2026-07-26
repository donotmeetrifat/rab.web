import "@/styles.css";
import { bootstrap } from "@/bootstrap";
import { OptionsApp } from "./OptionsApp";

void bootstrap({
  surface: "options",
  render: () => <OptionsApp />,
});
