import { rumEvent } from "./lib/rum-actions.js";
import { Suspense, lazy, useEffect } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import ConnectionStatus from "./components/ConnectionStatus";
import Home from "./pages/Home";
import Join from "./pages/Join";
import Play from "./pages/Play";
import Certificate from "./pages/Certificate";

const Console = lazy(() => import("./console/Console"));
const Captain = lazy(() => import("./pages/Captain"));
const Screen = lazy(() => import("./console/Screen"));

function RumRoutes() {
  const { pathname } = useLocation();
  useEffect(() => {
    const pages: Record<string,string> = { "/":"Home", "/join":"Join", "/play":"Workshop", "/certificate":"Certificate", "/console":"Facilitator Console", "/captain":"Captain Dashboard", "/screen":"Projector" };
    rumEvent("page_view", {page:pages[pathname] ?? "Home",site:"chaicart-live"});
  }, [pathname]);
  return null;
}
export default function App() {
  return (
    <HashRouter>
      <RumRoutes />
      <ConnectionStatus />
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<Join />} />
          <Route path="/play" element={<Play />} />
          <Route path="/certificate" element={<Certificate />} />
          <Route path="/console" element={<Console />} />
          <Route path="/captain" element={<Captain />} />
          <Route path="/screen" element={<Screen />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
