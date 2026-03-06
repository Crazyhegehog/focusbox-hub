import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const Team = () => {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;

      const { data: roles } = await supabase.from("user_roles").select("*");

      return (profiles || []).map((p) => ({
        ...p,
        roles: (roles || []).filter((r) => r.user_id === p.user_id),
      }));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <p className="text-muted-foreground font-body mt-1">Your LockIn team members</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground font-body">Loading team...</p>
      ) : members.length === 0 ? (
        <p className="text-muted-foreground font-body">No team members yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const initials = member.full_name
              ? member.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
              : "U";
            const roles = member.roles || [];
            return (
              <Card key={member.id} className="border-border/50">
                <CardContent className="flex items-center gap-4 py-5">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{member.full_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground font-body truncate">{member.role_title}</p>
                    <div className="flex gap-1 mt-1">
                      {roles.map((r) => (
                        <Badge key={r.role} variant="secondary" className="text-xs">
                          {r.role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Team;
