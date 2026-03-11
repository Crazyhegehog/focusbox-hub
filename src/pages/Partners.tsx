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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Users, Trophy, Trash2, RefreshCw } from "lucide-react";
import PartnerNotesSheet from "@/components/partners/PartnerNotesSheet";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays } from "date-fns";

const statusConfig: Record<string, { label: string; className: string }> = {
  discussion: { label: "Discussion", className: "bg-info/15 text-info border-info/30" },
  no_answer: { label: "No Answer", className: "bg-warning/15 text-warning border-warning/30" },
  sent_contract: { label: "Contacted", className: "bg-accent text-accent-foreground border-border" },
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [notesPartnerId, setNotesPartnerId] = useState<string | null>(null);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allNotes = [] } = useQuery({
    queryKey: ["partner-notes-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_notes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
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
      setEmail(""); setName(""); setDialogOpen(false);
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

  const deletePartner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: "Partner gelöscht" });
    },
  });

  const getDayCount = (partner: any) => {
    const refDate = partner.last_post_date || partner.signed_date || partner.created_at;
    if (!refDate) return null;
    return differenceInDays(new Date(), new Date(refDate));
  };

  // Signed contracts per user
  const contactedByUser = partners
    .filter((p) => p.status === "sent_contract" && p.created_by)
    .reduce((acc, p) => {
      acc[p.created_by!] = (acc[p.created_by!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const getProfileNameByUserId = (userId: string) =>
    profiles.find((p) => p.user_id === userId)?.full_name || "Unknown";

  const getLatestNote = (partnerId: string) =>
    allNotes.find((n) => n.partner_id === partnerId);

  const syncSmartlead = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-smartlead");
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: `Smartlead sync complete`, description: `${data.imported} leads imported from ${data.campaigns_checked} campaigns` });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const filteredPartners = statusFilter === "all" ? partners : partners.filter((p) => p.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partners</h1>
          <p className="text-muted-foreground font-body mt-1">Manage partner pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={syncSmartlead} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Refresh Smartlead"}
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add Partner</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Partner</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Input placeholder="Partner name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Button className="w-full" onClick={() => createPartner.mutate()} disabled={!email}>Add Partner</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Contacted partners leaderboard */}
      {Object.keys(contactedByUser).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(contactedByUser)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([userId, count]) => (
              <Card key={userId}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-warning" />
                  <div>
                    <p className="text-sm font-semibold">{getProfileNameByUserId(userId)}</p>
                    <p className="text-xs text-muted-foreground">{count as number} contacted partner{(count as number) !== 1 ? "s" : ""}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading partners...</div>
          ) : filteredPartners.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">{statusFilter === "all" ? "No partners yet" : "No partners with this status"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">Todo</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Last Post</TableHead>
                   <TableHead className="text-center">Days</TableHead>
                   <TableHead className="text-right">Actions</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.map((p) => {
                  const days = getDayCount(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={(p as any).needs_todo === true}
                          onChange={(e) => {
                            updatePartner.mutate({
                              id: p.id,
                              updates: { needs_todo: e.target.checked },
                            });
                          }}
                          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{p.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.created_by ? getProfileNameByUserId(p.created_by) : "—"}
                      </TableCell>
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
                      <TableCell
                        className="max-w-[200px] cursor-pointer hover:bg-muted/50"
                        onClick={() => setNotesPartnerId(p.id)}
                      >
                        {(() => {
                          const note = getLatestNote(p.id);
                          if (!note) return <span className="text-muted-foreground text-xs">—</span>;
                          return (
                            <p className="text-xs text-muted-foreground truncate" title={note.content}>
                              {note.content}
                            </p>
                          );
                        })()}
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <PartnerNotesSheet partnerId={p.id} partnerName={p.name || p.email} />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Partner löschen?</AlertDialogTitle>
                                <AlertDialogDescription>{p.name || p.email} wird unwiderruflich gelöscht.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deletePartner.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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
