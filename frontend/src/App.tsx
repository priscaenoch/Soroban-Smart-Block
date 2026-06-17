import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import ErrorBoundary from "./components/ErrorBoundary";

const Home = lazy(() => import("./pages/Home"));
const ContractPage = lazy(() => import("./pages/ContractPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const EventPage = lazy(() => import("./pages/EventPage"));
const XdrInspector = lazy(() => import("./pages/XdrInspector"));
const RpcMetricsDashboard = lazy(() => import("./pages/RpcMetricsDashboard"));
const GraphPage = lazy(() => import("./pages/GraphPage"));
const Sandbox = lazy(() => import("./pages/Sandbox"));
const SharedSandbox = lazy(() => import("./pages/SharedSandbox"));
const DeveloperWorkspace = lazy(() => import("./pages/DeveloperWorkspace"));
const SetupPage = lazy(() => import("./pages/SetupPage"));

function Fallback() {
  return <p style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading…</p>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Nav />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/contract/:id" element={<ContractPage />} />
            <Route path="/contract/:id/workspace" element={<DeveloperWorkspace />} />
            <Route path="/wallet/:address" element={<WalletPage />} />
            <Route path="/event/:seq" element={<EventPage />} />
            <Route path="/xdr" element={<XdrInspector />} />
            <Route path="/rpc-metrics" element={<RpcMetricsDashboard />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="/sandbox" element={<Sandbox />} />
            <Route path="/sandbox/:id" element={<SharedSandbox />} />
            <Route path="/setup" element={<SetupPage />} />
          </Routes>
        </Suspense>
      </main>
    </ErrorBoundary>
  );
}
