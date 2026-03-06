import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, CheckCircle2, Circle, Clock, UserCheck, Users, ListTodo, UserPlus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusConfig = {
  not_started: { label: "Not Started", icon: Circle, className: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Clock, className: "text-info" },
  completed: { label: "Completed", icon: CheckCircle2, className: "text-success" },
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const Todos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [newSubtask, setNewSubtask] = useState<Record<string, string>>({});

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

  const { data: subtasks = [] } = useQuery({
    queryKey: ["todo_subtasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("todo_subtasks").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const createTodo = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("todos").insert({
        title, description,
        responsible_id: responsibleId || null,
        due_date: dueDate || null,
        created_by: user!.id,
      }).select().single();
      if (error) throw error;
      // Add participants
      if (selectedParticipants.length > 0) {
        const { error: pErr } = await supabase.from("todo_participants").insert(
          selectedParticipants.map((uid) => ({ todo_id: data.id, user_id: uid }))
        );
        if (pErr) throw pErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      queryClient.invalidateQueries({ queryKey: ["todo_participants"] });
      setTitle(""); setDescription(""); setResponsibleId(""); setDueDate(""); setSelectedParticipants([]);
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

  const addParticipant = useMutation({
    mutationFn: async ({ todoId, userId }: { todoId: string; userId: string }) => {
      const { error } = await supabase.from("todo_participants").insert({ todo_id: todoId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todo_participants"] });
      toast({ title: "Participant added" });
    },
  });

  const addSubtask = useMutation({
    mutationFn: async ({ todoId, subtaskTitle }: { todoId: string; subtaskTitle: string }) => {
      const { error } = await supabase.from("todo_subtasks").insert({ todo_id: todoId, title: subtaskTitle });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["todo_subtasks"] });
      setNewSubtask((prev) => ({ ...prev, [vars.todoId]: "" }));
    },
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("todo_subtasks").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todo_subtasks"] }),
  });

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todo_subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todo_subtasks"] }),
  });

  const getProfileName = (id: string | null) => {
    if (!id) return "Unassigned";
    return profiles.find((p) => p.id === id || p.user_id === id)?.full_name || "Unknown";
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const nextStatus = (s: string) => {
    if (s === "not_started") return "in_progress";
    if (s === "in_progress") return "completed";
    return "not_started";
  };

  const filteredTodos = statusFilter === "all" ? todos : todos.filter((t) => t.status === statusFilter);

  const toggleParticipantSelection = (id: string) => {
    setSelectedParticipants((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Todos</h1>
          <p className="text-muted-foreground font-body mt-1">Tasks with ownership and acceptance</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <div>
                  <p className="text-sm font-medium mb-2">Participants</p>
                  <div className="flex flex-wrap gap-2">
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleParticipantSelection(p.user_id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors ${
                          selectedParticipants.includes(p.user_id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-accent"
                        }`}
                      >
                        {p.full_name}
                      </button>
                    ))}
                  </div>
                </div>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <Button className="w-full" onClick={() => createTodo.mutate()} disabled={!title}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filteredTodos.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{statusFilter === "all" ? "No todos yet" : "No todos with this status"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTodos.map((todo) => {
            const sc = statusConfig[todo.status as keyof typeof statusConfig];
            const StatusIcon = sc.icon;
            const todoParticipants = participants.filter((p) => p.todo_id === todo.id);
            const userAccepted = todoParticipants.find((p) => p.user_id === user?.id)?.accepted;
            const todoSubtasks = subtasks.filter((s) => s.todo_id === todo.id);
            const completedSubtasks = todoSubtasks.filter((s) => s.completed).length;

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
                        {todo.due_date && <span className="text-xs text-muted-foreground">{todo.due_date}</span>}
                        {todoSubtasks.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            <ListTodo className="h-3 w-3 inline mr-0.5" />
                            {completedSubtasks}/{todoSubtasks.length}
                          </span>
                        )}
                      </div>
                      {todo.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{todo.description}</p>
                      )}

                      {/* Subtasks */}
                      {todoSubtasks.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {todoSubtasks.map((st) => (
                            <div key={st.id} className="flex items-center gap-2 group">
                              <Checkbox
                                checked={st.completed}
                                onCheckedChange={(checked) => toggleSubtask.mutate({ id: st.id, completed: !!checked })}
                                className="h-3.5 w-3.5"
                              />
                              <span className={`text-xs flex-1 ${st.completed ? "line-through text-muted-foreground/50" : "text-foreground"}`}>
                                {st.title}
                              </span>
                              <button
                                onClick={() => deleteSubtask.mutate(st.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add subtask inline */}
                      <div className="mt-2 flex items-center gap-1">
                        <Input
                          placeholder="Add subtask…"
                          className="h-7 text-xs"
                          value={newSubtask[todo.id] || ""}
                          onChange={(e) => setNewSubtask((prev) => ({ ...prev, [todo.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newSubtask[todo.id]?.trim()) {
                              addSubtask.mutate({ todoId: todo.id, subtaskTitle: newSubtask[todo.id].trim() });
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={!newSubtask[todo.id]?.trim()}
                          onClick={() => {
                            if (newSubtask[todo.id]?.trim()) {
                              addSubtask.mutate({ todoId: todo.id, subtaskTitle: newSubtask[todo.id].trim() });
                            }
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Responsible + participants */}
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
                        {/* Add participant inline */}
                        <Select onValueChange={(uid) => addParticipant.mutate({ todoId: todo.id, userId: uid })}>
                          <SelectTrigger className="h-6 w-6 p-0 border-dashed border-muted-foreground/30 [&>svg]:hidden">
                            <UserPlus className="h-3 w-3 text-muted-foreground" />
                          </SelectTrigger>
                          <SelectContent>
                            {profiles
                              .filter((p) => !todoParticipants.some((tp) => tp.user_id === p.user_id))
                              .map((p) => (
                                <SelectItem key={p.id} value={p.user_id}>{p.full_name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
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
