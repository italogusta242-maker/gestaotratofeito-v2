import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Veiculos = lazy(() => import("./pages/Veiculos"));
const VeiculoDetalhe = lazy(() => import("./pages/VeiculoDetalhe"));
const CaixaDiario = lazy(() => import("./pages/CaixaDiario"));
const ContasBancarias = lazy(() => import("./pages/ContasBancarias"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Cartoes = lazy(() => import("./pages/Cartoes"));
const Financiamentos = lazy(() => import("./pages/Financiamentos"));
const ContasFixas = lazy(() => import("./pages/ContasFixas"));
const ContasPagarReceber = lazy(() => import("./pages/ContasPagarReceber"));
const Equipe = lazy(() => import("./pages/Equipe"));
const Conciliacao = lazy(() => import("./pages/Conciliacao"));
const Recibo = lazy(() => import("./pages/Recibo"));
const ContratoCompra = lazy(() => import("./pages/ContratoCompra"));
const ContratoVenda = lazy(() => import("./pages/ContratoVenda"));
const ContratoIntermediacao = lazy(() => import("./pages/ContratoIntermediacao"));
const ContratoRepasse = lazy(() => import("./pages/ContratoRepasse"));
const Procuracao = lazy(() => import("./pages/Procuracao"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageFallback() {
  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { session, role, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (!session) return <Navigate to="/auth" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/veiculos" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { session, loading } = useAuth();
  if (loading) return <PageFallback />;

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/auth" element={session ? <Navigate to="/" replace /> : <Auth />} />
        <Route path="/recibo/:id" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional", "auxiliar_emissao"]}><Recibo /></ProtectedRoute>} />
        <Route path="/veiculos/:id/contrato-compra" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional"]}><ContratoCompra /></ProtectedRoute>} />
        <Route path="/veiculos/:id/contrato-venda" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional"]}><ContratoVenda /></ProtectedRoute>} />
        <Route path="/veiculos/:id/contrato-intermediacao" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional"]}><ContratoIntermediacao /></ProtectedRoute>} />
        <Route path="/veiculos/:id/contrato-repasse" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional"]}><ContratoRepasse /></ProtectedRoute>} />
        <Route path="/veiculos/:id/procuracao" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional", "auxiliar_emissao"]}><Procuracao /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute allowedRoles={["admin"]}><Dashboard /></ProtectedRoute>} />
        <Route path="/veiculos" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional", "auxiliar_emissao"]}><Veiculos /></ProtectedRoute>} />
        <Route path="/veiculos/:id/detalhe" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional", "auxiliar_emissao"]}><VeiculoDetalhe /></ProtectedRoute>} />
        <Route path="/caixa" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional"]}><CaixaDiario /></ProtectedRoute>} />
        <Route path="/contas" element={<ProtectedRoute allowedRoles={["admin"]}><ContasBancarias /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional", "auxiliar_emissao"]}><Clientes /></ProtectedRoute>} />
        <Route path="/cartoes" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional"]}><Cartoes /></ProtectedRoute>} />
        <Route path="/financiamentos" element={<ProtectedRoute allowedRoles={["admin", "auxiliar_operacional"]}><Financiamentos /></ProtectedRoute>} />
        <Route path="/contas-fixas" element={<ProtectedRoute allowedRoles={["admin"]}><ContasFixas /></ProtectedRoute>} />
        <Route path="/contas-pagar-receber" element={<ProtectedRoute allowedRoles={["admin"]}><ContasPagarReceber /></ProtectedRoute>} />
        <Route path="/conciliacao" element={<ProtectedRoute allowedRoles={["admin"]}><Conciliacao /></ProtectedRoute>} />
        <Route path="/equipe" element={<ProtectedRoute allowedRoles={["admin"]}><Equipe /></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute allowedRoles={["admin"]}><Usuarios /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
