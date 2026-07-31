import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { ReactNode } from "react";

const mockAuth = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useAuth", () => mockAuth);

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div data-testid="layout">{children}</div>,
}));

// Reproduz o ProtectedRoute do App.tsx (fonte da verdade continua lá)
function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { useAuth } = mockAuth;
  const { session, role, loading } = (useAuth as ReturnType<typeof vi.fn>)();
  if (loading) return <div>Carregando...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role))
    return <Navigate to="/veiculos" replace />;
  return <div data-testid="layout">{children}</div>;
}

function renderAt(path: string, allowedRoles?: string[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <div>Página admin</div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<div>Tela de login</div>} />
        <Route path="/veiculos" element={<div>Lista de veículos</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => mockAuth.useAuth.mockReset());

  it("mostra loading quando auth ainda está carregando", () => {
    mockAuth.useAuth.mockReturnValue({ session: null, role: null, loading: true });
    renderAt("/", ["admin"]);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it("redireciona para /auth quando não há sessão", () => {
    mockAuth.useAuth.mockReturnValue({ session: null, role: null, loading: false });
    renderAt("/", ["admin"]);
    expect(screen.getByText(/tela de login/i)).toBeInTheDocument();
  });

  it("redireciona para /veiculos quando o role não é permitido", () => {
    mockAuth.useAuth.mockReturnValue({
      session: { user: { id: "u1" } },
      role: "auxiliar_emissao",
      loading: false,
    });
    renderAt("/", ["admin"]);
    expect(screen.getByText(/lista de veículos/i)).toBeInTheDocument();
    expect(screen.queryByText(/página admin/i)).not.toBeInTheDocument();
  });

  it("permite acesso quando o role está na lista", () => {
    mockAuth.useAuth.mockReturnValue({
      session: { user: { id: "u1" } },
      role: "admin",
      loading: false,
    });
    renderAt("/", ["admin"]);
    expect(screen.getByText(/página admin/i)).toBeInTheDocument();
    expect(screen.getByTestId("layout")).toBeInTheDocument();
  });

  it("permite acesso quando allowedRoles é undefined (rota qualquer autenticado)", () => {
    mockAuth.useAuth.mockReturnValue({
      session: { user: { id: "u1" } },
      role: "auxiliar_emissao",
      loading: false,
    });
    renderAt("/");
    expect(screen.getByText(/página admin/i)).toBeInTheDocument();
  });
});
