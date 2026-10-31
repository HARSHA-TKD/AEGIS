import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./styles/global.css";
import "./styles/dashboard.css";
import "./styles/review.css";
import "./styles/intel.css";
import "./styles/repos.css";
import "./styles/reports.css";
import "./styles/settings.css";
import "./styles/responsive.css";
import "./styles/typography.css";
import "./styles/login.css";
import "./styles/simple.css";
import App from "./App";
import { applyStoredAccent } from "./lib/theme";

applyStoredAccent();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
