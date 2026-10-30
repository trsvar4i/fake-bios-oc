import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AdminPortal, TeacherPortal } from "./class/Portal";
import "./app.css";
import "./bios/bios.css";

/** #teacher и #admin — страницы кабинета вне симулятора, всё остальное — сам симулятор. */
function Root() {
  const page = () => (location.hash.startsWith("#teacher") ? "teacher" : location.hash.startsWith("#admin") ? "admin" : "sim");
  const [p, setP] = useState(page);
  useEffect(() => {
    const on = () => setP(page());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return p === "teacher" ? <TeacherPortal /> : p === "admin" ? <AdminPortal /> : <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
