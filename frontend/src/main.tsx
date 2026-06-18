import "@fontsource/inter";
import "@fontsource/jetbrains-mono";
import "@fontsource/source-serif-4";

import "@/index.css";

import App from "@/App.tsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
