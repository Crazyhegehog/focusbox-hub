import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, CheckCircle2, Circle, Clock, UserCheck, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusConfig = {
  not_started: { label: "Not Started", icon: Circle, className: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Clock, className: "text-info" },
  completed: { label: "Completed", icon: CheckCircle2, className: "text-success" },
};

const Todos = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("todos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["todo_participants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("todo_participants").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createTodo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("todos").insert({
        title,
        description,
        responsible_id: responsibleId || null,
        due_date: dueDate || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      setTitle(""); setDescription(""); setResponsibleId(""); setDueDate("");
      setDialogOpen(false);
      toast({ title: "Todo created" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("todos").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });

  const acceptTodo = useMutation({
    mutationFn: async (todoId: string) => {
      // Upsert participant as accepted
      const { error } = await supabase.from("todo_participants").upsert(
        { todo_id: todoId, user_id: user!.id, accepted: true, accepted_at: new Date().toISOString() },
        { onConflict: "todo_id,user_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todo_participants"] });
      toast({ title: "Todo accepted" });
    },
  });

  const getProfileName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = profiles.find((p) => p.id === id);
    return p?.full_name || "Unknown";
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const nextStatus = (s: string) => {
    if (s === "not_started") return "in_progress";
    if (s === "in_progress") return "completed";
    return "not_started";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Todos</h1>
          <p className="text-muted-foreground font-body mt-1">Tasks with ownership and acceptance</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Todo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Todo</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              <Select value={responsibleId} onValueChange={setResponsibleId}>
                <SelectTrigger><SelectValue placeholder="Responsible person" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <Button className="w-full" onClick={() => createTodo.mutate()} disabled={!title}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : todos.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No todos yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {todos.map((todo) => {
            const sc = statusConfig[todo.status as keyof typeof statusConfig];
            const StatusIcon = sc.icon;
            const todoParticipants = participants.filter((p) => p.todo_id === todo.id);
            const userAccepted = todoParticipants.find((p) => p.user_id === user?.id)?.accepted;

            return (
              <Card key={todo.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => updateStatus.mutate({ id: todo.id, status: nextStatus(todo.status) })} className="mt-1">
                      <StatusIcon className={`h-5 w-5 ${sc.className}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{todo.title}</h3>
                        <Badge variant="outline" className="text-xs">{sc.label}</Badge>
                        {todo.due_date && (
                          <span className="text-xs text-muted-foreground">{todo.due_date}</span>
                        )}
                      </div>
                      {todo.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{todo.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>Responsible: <strong>{getProfileName(todo.responsible_id)}</strong></span>
                        </div>
                        {todoParticipants.length > 0 && (
                          <div className="flex items-center gap-1">
                            {todoParticipants.map((tp) => {
                              const pName = getProfileName(tp.user_id);
                              return (
                                <Avatar key={tp.id} className="h-5 w-5">
                                  <AvatarFallback className={`text-[9px] ${tp.accepted ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                                    {getInitials(pName)}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {!userAccepted && (
                      <Button size="sm" variant="outline" onClick={() => acceptTodo.mutate(todo.id)} className="shrink-0">
                        <UserCheck className="h-3 w-3 mr-1" /> Accept
                      </Button>
                    )}
                    {userAccepted && (
                      <Badge variant="outline" className="bg-success/15 text-success border-success/30 shrink-0">
                        <UserCheck className="h-3 w-3 mr-1" /> Accepted
                      </Badge>
                    )}
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

export default Todos;
