import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, ArrowRight, Users, Shield, ShieldCheck } from "lucide-react";

const TEAM_MEMBERS = [
  { email: "ella.brunner@stift.ch", password: "Ella#Lock2026", name: "Ella Brunner", role: "Member", icon: Users },
  { email: "allegra.schober@stift.ch", password: "Allegra#Lock2026", name: "Allegra Schober", role: "Member", icon: Users },
  { email: "paul.vogt@stift.ch", password: "Paul#Lock2026", name: "Paul Vogt", role: "Member", icon: Users },
  { email: "viviana.lindemann@stift.ch", password: "Viviana#Lock2026", name: "Viviana Lindemann", role: "Member", icon: Users },
  { email: "elis.schoenbaechler@stift.ch", password: "Elis#Lock2026", name: "Elis Schönbächler", role: "Superadmin", icon: ShieldCheck },
  { email: "matthew.edelman@stift.ch", password: "Matthew#Lock2026", name: "Matthew Edelman", role: "Admin", icon: Shield },
];

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMember, setLoadingMember] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (loginEmail: string, loginPassword: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return false;
    }
    navigate("/");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await handleLogin(email, password);
    setLoading(false);
  };

  const handleQuickLogin = async (member: typeof TEAM_MEMBERS[0]) => {
    setLoadingMember(member.email);
    await handleLogin(member.email, member.password);
    setLoadingMember(null);
  };

  const roleColor = (role: string) => {
    if (role === "Superadmin") return "text-destructive";
    if (role === "Admin") return "text-warning";
    return "text-muted-foreground";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Lock<span className="text-muted-foreground">In</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-body">
            Team Productivity Dashboard
          </p>
        </div>

        {/* Quick Login Buttons */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-lg">Team Login</CardTitle>
            <CardDescription className="font-body">Wähle deinen Account</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {TEAM_MEMBERS.map((member) => {
              const Icon = member.icon;
              return (
                <Button
                  key={member.email}
                  variant="outline"
                  className="h-auto py-3 px-3 flex flex-col items-start gap-1 text-left"
                  disabled={loadingMember !== null}
                  onClick={() => handleQuickLogin(member)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="font-medium text-sm truncate">
                      {loadingMember === member.email ? "Logging in..." : member.name}
                    </span>
                  </div>
                  <span className={`text-xs ${roleColor(member.role)}`}>{member.role}</span>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Manual Login */}
        <Card className="border-border/50">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-base">Manueller Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 font-body"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 font-body"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? "Loading..." : "Sign In"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
