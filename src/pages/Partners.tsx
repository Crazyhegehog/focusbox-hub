import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, format } from "date-fns";

const statusConfig = {
  discussion: { label: "Discussion", className: "bg-info/15 text-info border-info/30" },
  no_answer: { label: "No Answer", className: "bg-warning/15 text-warning border-warning/30" },
  sent_contract: { label: "Sent Contract", className: "bg-accent text-accent-foreground border-border" },
  signed: { label: "Signed", className: "bg-success/15 text-success border-success/30" },
};

const STATUS_OPTIONS = ["discussion", "no_answer", "sent_contract", "signed"] as const;

const Partners = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createPartner = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("partners").insert({ email, name, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      setEmail("");
      setName("");
      setDialogOpen(false);
      toast({ title: "Partner added" });
    },
  });

  const updatePartner = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("partners").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: "Partner updated" });
    },
  });

  const getDayCount = (partner: any) => {
    const refDate = partner.last_post_date || partner.signed_date || partner.created_at;
    if (!refDate) return null;
    return differenceInDays(new Date(), new Date(refDate));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partners</h1>
          <p className="text-muted-foreground font-body mt-1">Manage partner pipeline</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Partner</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Partner</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Partner name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button className="w-full" onClick={() => createPartner.mutate()} disabled={!email}>
                Add Partner
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading partners...</div>
          ) : partners.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No partners yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Post</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p) => {
                  const days = getDayCount(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell>
                        <Select
                          value={p.status}
                          onValueChange={(val) => {
                            const updates: Record<string, any> = { status: val };
                            if (val === "signed") updates.signed_date = new Date().toISOString().split("T")[0];
                            updatePartner.mutate({ id: p.id, updates });
                          }}
                        >
                          <SelectTrigger className="w-[150px] h-8">
                            <Badge variant="outline" className={statusConfig[p.status as keyof typeof statusConfig]?.className}>
                              {statusConfig[p.status as keyof typeof statusConfig]?.label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className="w-[140px] h-8 text-xs"
                          value={p.last_post_date || ""}
                          onChange={(e) => updatePartner.mutate({ id: p.id, updates: { last_post_date: e.target.value || null } })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {days !== null ? (
                          <Badge variant="outline" className={days > 7 ? "bg-destructive/15 text-destructive border-destructive/30" : ""}>
                            {days}d ago
                          </Badge>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Partners;
