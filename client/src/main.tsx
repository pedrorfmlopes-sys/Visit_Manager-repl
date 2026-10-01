import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => undefined);
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
