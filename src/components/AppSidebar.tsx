import {
  ClipboardList,
  Users,
  Mail,
  FileText,
  ScrollText,
  Tags,
  CheckSquare,
  CalendarDays,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const sections = [
  {
    title: "Packages",
    items: [
      { title: "Orders", url: "/orders", icon: ClipboardList },
    ],
  },
  {
    title: "Partners",
    items: [
      { title: "Partner List", url: "/partners", icon: Users },
      { title: "Email Templates", url: "/email-templates", icon: Mail },
      { title: "Partner Brief", url: "/partner-brief", icon: FileText },
      { title: "Partner Contract", url: "/partner-contract", icon: ScrollText },
    ],
  },
  {
    title: "Team",
    items: [
      { title: "Todos", url: "/todos", icon: CheckSquare },
      { title: "Calendar", url: "/calendar", icon: CalendarDays },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
              L
            </div>
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
              Lock<span className="text-sidebar-foreground/60">In</span>
            </span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold mx-auto">
            L
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => {
          const sectionActive = section.items.some((i) => isActive(i.url));
          return (
            <Collapsible key={section.title} defaultOpen={sectionActive || true}>
              <SidebarGroup>
                <CollapsibleTrigger className="w-full">
                  <SidebarGroupLabel className="text-sidebar-foreground/40 text-xs uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-sidebar-foreground/60 transition-colors">
                    {!collapsed && <span>{section.title}</span>}
                    {!collapsed && <ChevronDown className="h-3 w-3" />}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive(item.url)}
                            tooltip={item.title}
                          >
                            <NavLink
                              to={item.url}
                              className="hover:bg-sidebar-accent"
                              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            >
                              <item.icon className="h-4 w-4" />
                              {!collapsed && <span>{item.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || "User"}
              </p>
              <p className="text-xs text-sidebar-foreground/50 truncate">
                {profile?.role_title}
              </p>
            </div>
            <button onClick={signOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button onClick={signOut} className="flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors mx-auto">
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
