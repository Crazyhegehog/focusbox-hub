import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Mail, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_TEMPLATES = [
  {
    title: "First Outreach",
    body:
      "Hallo [Name],\n\nich hoffe, es geht dir gut. Ich melde mich von LockIn, weil wir lokale Partner sichtbarer machen und Nutzer fuer handyfreie Zeit mit einloesbaren Gutscheinen belohnen.\n\nIch glaube, dass [Unternehmen] gut zu unserer Community passen koennte. Gerne zeige ich dir kurz, wie eine Partnerschaft aussieht und welchen Gutschein wir gemeinsam aufsetzen koennten.\n\nHaettest du diese oder naechste Woche 15 Minuten fuer einen kurzen Austausch?\n\nLiebe Gruesse\n[Dein Name]\nLockIn",
  },
  {
    title: "Empty Template",
    body: "",
  },
];

const EmailTemplates = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const seededDefaultsRef = useRef(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("email_templates").update({ title, body }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("email_templates").insert({ title, body });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
      resetForm();
      toast({ title: editId ? "Template updated" : "Template created" });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const resetForm = () => { setTitle(""); setBody(""); setEditId(null); setDialogOpen(false); };

  const openEdit = (t: any) => { setEditId(t.id); setTitle(t.title); setBody(t.body); setDialogOpen(true); };

  useEffect(() => {
    if (isLoading || seededDefaultsRef.current || templates.length > 0) return;

    seededDefaultsRef.current = true;
    supabase
      .from("email_templates")
      .insert(DEFAULT_TEMPLATES)
      .then(({ error }) => {
        if (error) {
          seededDefaultsRef.current = false;
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["email_templates"] });
      });
  }, [isLoading, queryClient, templates.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-muted-foreground font-body mt-1">Pre-written emails for partner outreach</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Template</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Template title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Email body…" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
              <Button className="w-full" onClick={() => upsert.mutate()} disabled={!title}>
                {editId ? "Update" : "Create"} Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : templates.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-16 text-center">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No templates yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{t.title}</CardTitle>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteTemplate.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-body">{t.body}</pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailTemplates;
