import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// if (process.env.NODE_ENV === "development") {
//   import("react-scan").then(({ scan }) => {
//     scan({
//       enabled: true,
//       log: true,
//       trackChanges: true,
//     });
//   });
// }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
