import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LogOut } from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  auxiliar_operacional: "Aux. Operacional",
  auxiliar_emissao: "Aux. Emissão",
};

export function Topbar() {
  const { profile, role, signOut } = useAuth();

  return (
    <header className="h-14 flex items-center justify-between border-b px-4 bg-card">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <span className="text-sm font-medium">{profile?.nome ?? "Usuário"}</span>
        {role && <Badge variant="secondary">{roleLabels[role] ?? role}</Badge>}
      </div>
      <Button variant="ghost" size="sm" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-1" /> Sair
      </Button>
    </header>
  );
}
