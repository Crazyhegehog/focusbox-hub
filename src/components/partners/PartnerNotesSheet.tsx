import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PartnerNotesSheetProps {
  partnerId: string;
  partnerName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PartnerNotesSheet = ({ partnerId, partnerName, open: controlledOpen, onOpenChange }: PartnerNotesSheetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["partner-notes", partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_notes")
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("partner_notes").insert({
        partner_id: partnerId,
        content,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-notes", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["partner-notes-all"] });
      setContent("");
      toast({ title: "Note added" });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-notes", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["partner-notes-all"] });
    },
  });

  const getAuthorName = (userId: string) =>
    profiles.find((p) => p.user_id === userId)?.full_name || "Unknown";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost">
          <MessageSquare className="h-3 w-3" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notes — {partnerName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a note..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => addNote.mutate()}
            disabled={!content.trim()}
          >
            Add Note
          </Button>

          <div className="space-y-3 mt-4">
            {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {notes.map((note) => (
              <div key={note.id} className="rounded-md border border-border p-3 space-y-1">
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {getAuthorName(note.created_by)} · {format(new Date(note.created_at), "dd.MM.yy HH:mm")}
                  </span>
                  {note.created_by === user?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => deleteNote.mutate(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!isLoading && notes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PartnerNotesSheet;
