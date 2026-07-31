import { Car, LayoutDashboard, Building2, Users, Receipt, UserCheck, CreditCard, Landmark, CalendarClock, FileWarning, FileSpreadsheet, UsersRound } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const allItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["admin"] },
  { title: "Veículos", url: "/veiculos", icon: Car, roles: ["admin", "auxiliar_operacional", "auxiliar_emissao"] },
  { title: "Caixa Diário", url: "/caixa", icon: Receipt, roles: ["admin", "auxiliar_operacional"] },
  { title: "Cartões", url: "/cartoes", icon: CreditCard, roles: ["admin", "auxiliar_operacional"] },
  { title: "Financiamentos", url: "/financiamentos", icon: Landmark, roles: ["admin", "auxiliar_operacional"] },
  { title: "Contas Fixas", url: "/contas-fixas", icon: CalendarClock, roles: ["admin"] },
  { title: "A Pagar/Receber", url: "/contas-pagar-receber", icon: FileWarning, roles: ["admin"] },
  { title: "Conciliação", url: "/conciliacao", icon: FileSpreadsheet, roles: ["admin"] },
  { title: "Contas Bancárias", url: "/contas", icon: Building2, roles: ["admin"] },
  { title: "Clientes", url: "/clientes", icon: UserCheck, roles: ["admin", "auxiliar_operacional", "auxiliar_emissao"] },
  { title: "Equipe", url: "/equipe", icon: UsersRound, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role } = useAuth();

  const items = allItems.filter((i) => !role || i.roles.includes(role));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <span className="flex items-center gap-2 font-bold text-base">
                <Car className="h-5 w-5" /> Trato Feito Bank
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
