import React from "react";
import { createRoot } from "react-dom/client";
import PoolSystem from "./PoolSystem.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PoolSystem />
  </React.StrictMode>
);
