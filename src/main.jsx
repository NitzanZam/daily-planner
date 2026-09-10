import React from "react";
import { createRoot } from "react-dom/client";
import DayPlanner from "./DayPlanner.jsx";

createRoot(document.getElementById("root")).render(<DayPlanner />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
