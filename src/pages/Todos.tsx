import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  FileText,
  FolderKanban,
  ListChecks,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Enums, Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Todo = Tables<"todos">;
type TodoStatus = Enums<"todo_status">;
type TaskPriority = Enums<"task_priority">;

const statusConfig: Record<
  TodoStatus,
  { label: string; icon: typeof Circle; className: string }
> = {
  not_started: { label: "Not Started", icon: Circle, className: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Clock, className: "text-info" },
  completed: { label: "Completed", icon: CheckCircle2, className: "text-success" },
};

const priorityConfig: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  high: { label: "High", className: "bg-destructive/15 text-destructive border-destructive/30" },
  medium: { label: "Medium", className: "bg-warning/15 text-warning border-warning/30" },
  low: { label: "Low", className: "bg-muted text-muted-foreground border-border" },
};

const emptyTaskForm = {
  id: null as string | null,
  title: "",
  description: "",
  projectId: "none",
  status: "not_started" as TodoStatus,
  priority: "medium" as TaskPriority,
  responsibleId: "none",
  startDate: "",
  dueDate: "",
  participantIds: [] as string[],
};

const emptyProjectForm = {
  name: "",
  description: "",
  color: "#1f6feb",
};

const Todos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [statusFilter, setStatusFilter] = useState<"all" | TodoStatus>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState<Record<string, string>>({});
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["todo_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo_projects")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
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
      const { data, error } = await supabase
        .from("todo_subtasks")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["todo_notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todo_notes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidateTodoData = () => {
    queryClient.invalidateQueries({ queryKey: ["todos"] });
    queryClient.invalidateQueries({ queryKey: ["todo_participants"] });
    queryClient.invalidateQueries({ queryKey: ["todo_subtasks"] });
    queryClient.invalidateQueries({ queryKey: ["todo_notes"] });
    queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
  };

  const createProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("todo_projects").insert({
        name: projectForm.name,
        description: projectForm.description || null,
        color: projectForm.color,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todo_projects"] });
      setProjectForm(emptyProjectForm);
      setProjectDialogOpen(false);
      toast({ title: "Subproject created" });
    },
  });

  const saveTask = useMutation({
    mutationFn: async () => {
      const payload = {
        title: taskForm.title,
        description: taskForm.description || null,
        project_id: taskForm.projectId === "none" ? null : taskForm.projectId,
        status: taskForm.status,
        priority: taskForm.priority,
        responsible_id: taskForm.responsibleId === "none" ? null : taskForm.responsibleId,
        start_date: taskForm.startDate || null,
        due_date: taskForm.dueDate || null,
        completed_at: taskForm.status === "completed" ? new Date().toISOString() : null,
      };

      if (taskForm.id) {
        const { error } = await supabase.from("todos").update(payload).eq("id", taskForm.id);
        if (error) throw error;

        const existingParticipants = participants
          .filter((participant) => participant.todo_id === taskForm.id)
          .map((participant) => participant.user_id);
        const nextParticipantIds = taskForm.participantIds;
        const toInsert = nextParticipantIds.filter((id) => !existingParticipants.includes(id));
        const toDelete = existingParticipants.filter((id) => !nextParticipantIds.includes(id));

        if (toInsert.length > 0) {
          const { error } = await supabase.from("todo_participants").insert(
            toInsert.map((participantId) => ({
              todo_id: taskForm.id!,
              user_id: participantId,
            }))
          );
          if (error) throw error;
        }

        if (toDelete.length > 0) {
          const { error } = await supabase
            .from("todo_participants")
            .delete()
            .eq("todo_id", taskForm.id)
            .in("user_id", toDelete);
          if (error) throw error;
        }

        return;
      }

      const { data, error } = await supabase
        .from("todos")
        .insert({
          ...payload,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;

      if (taskForm.participantIds.length > 0) {
        const { error: participantError } = await supabase.from("todo_participants").insert(
          taskForm.participantIds.map((participantId) => ({
            todo_id: data.id,
            user_id: participantId,
          }))
        );
        if (participantError) throw participantError;
      }
    },
    onSuccess: () => {
      invalidateTodoData();
      setTaskDialogOpen(false);
      setTaskForm(emptyTaskForm);
      toast({ title: taskForm.id ? "Task updated" : "Task created" });
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TodoStatus }) => {
      const { error } = await supabase
        .from("todos")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateTodoData(),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTodoData();
      toast({ title: "Task deleted" });
    },
  });

  const addSubtask = useMutation({
    mutationFn: async ({ todoId, title }: { todoId: string; title: string }) => {
      const { error } = await supabase.from("todo_subtasks").insert({ todo_id: todoId, title });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["todo_subtasks"] });
      setSubtaskInput((current) => ({ ...current, [variables.todoId]: "" }));
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

  const addNote = useMutation({
    mutationFn: async ({ todoId, content }: { todoId: string; content: string }) => {
      const { error } = await supabase.from("todo_notes").insert({
        todo_id: todoId,
        content,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["todo_notes"] });
      setNoteInput((current) => ({ ...current, [variables.todoId]: "" }));
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todo_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todo_notes"] }),
  });

  const getProfileByProfileId = (profileId: string | null) =>
    profiles.find((profile) => profile.id === profileId) || null;

  const getProfileByUserId = (userId: string | null) =>
    profiles.find((profile) => profile.user_id === userId) || null;

  const getInitials = (value: string) =>
    value
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const openCreateTask = () => {
    setTaskForm(emptyTaskForm);
    setTaskDialogOpen(true);
  };

  const openEditTask = (todo: Todo) => {
    const currentParticipants = participants
      .filter((participant) => participant.todo_id === todo.id)
      .map((participant) => participant.user_id);
    setTaskForm({
      id: todo.id,
      title: todo.title,
      description: todo.description || "",
      projectId: todo.project_id || "none",
      status: todo.status,
      priority: todo.priority,
      responsibleId: todo.responsible_id || "none",
      startDate: todo.start_date || "",
      dueDate: todo.due_date || "",
      participantIds: currentParticipants,
    });
    setTaskDialogOpen(true);
  };

  const toggleExpanded = (taskId: string) => {
    setExpandedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    );
  };

  const toggleParticipant = (userId: string) => {
    setTaskForm((current) => ({
      ...current,
      participantIds: current.participantIds.includes(userId)
        ? current.participantIds.filter((id) => id !== userId)
        : [...current.participantIds, userId],
    }));
  };

  const nextStatus = (status: TodoStatus): TodoStatus => {
    if (status === "not_started") return "in_progress";
    if (status === "in_progress") return "completed";
    return "not_started";
  };

  const filteredTodos = todos.filter((todo) => {
    if (statusFilter !== "all" && todo.status !== statusFilter) return false;
    if (projectFilter !== "all") {
      if (projectFilter === "none") return todo.project_id === null;
      if (todo.project_id !== projectFilter) return false;
    }
    return true;
  });

  const groupedProjects = [
    ...projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      tasks: filteredTodos.filter((todo) => todo.project_id === project.id),
    })),
    {
      id: "none",
      name: "General",
      description: "Tasks without a subproject",
      color: "#64748b",
      tasks: filteredTodos.filter((todo) => !todo.project_id),
    },
  ].filter((group) => group.tasks.length > 0 || projectFilter === "all" || projectFilter === group.id);

  const totalTasks = todos.length;
  const openTasks = todos.filter((todo) => todo.status !== "completed").length;
  const dueSoonTasks = todos.filter((todo) => {
    if (!todo.due_date || todo.status === "completed") return false;
    const dueDate = new Date(todo.due_date);
    const today = new Date();
    const diff = dueDate.getTime() - today.getTime();
    return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Workspace</h1>
          <p className="text-muted-foreground font-body mt-1">
            Organize subprojects, tasks, notes, and action people in one place
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All subprojects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subprojects</SelectItem>
              <SelectItem value="none">General</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | TodoStatus)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(statusConfig).map(([status, config]) => (
                <SelectItem key={status} value={status}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderKanban className="h-4 w-4 mr-1" />
                New Subproject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create subproject</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Input
                  placeholder="Subproject name"
                  value={projectForm.name}
                  onChange={(event) =>
                    setProjectForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
                <Textarea
                  rows={3}
                  placeholder="Description"
                  value={projectForm.description}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Color</label>
                  <Input
                    type="color"
                    value={projectForm.color}
                    onChange={(event) =>
                      setProjectForm((current) => ({ ...current, color: event.target.value }))
                    }
                    className="h-11"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!projectForm.name.trim()}
                  onClick={() => createProject.mutate()}
                >
                  Create Subproject
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateTask}>
                <Plus className="h-4 w-4 mr-1" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{taskForm.id ? "Edit task" : "Create task"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 pt-2 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Input
                    placeholder="Task title"
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Textarea
                    rows={4}
                    placeholder="Task description"
                    value={taskForm.description}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
                <Select
                  value={taskForm.projectId}
                  onValueChange={(value) =>
                    setTaskForm((current) => ({ ...current, projectId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Subproject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={taskForm.status}
                  onValueChange={(value) =>
                    setTaskForm((current) => ({
                      ...current,
                      status: value as TodoStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([status, config]) => (
                      <SelectItem key={status} value={status}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={taskForm.priority}
                  onValueChange={(value) =>
                    setTaskForm((current) => ({
                      ...current,
                      priority: value as TaskPriority,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([priority, config]) => (
                      <SelectItem key={priority} value={priority}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={taskForm.responsibleId}
                  onValueChange={(value) =>
                    setTaskForm((current) => ({ ...current, responsibleId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Responsible person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={taskForm.startDate}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, startDate: event.target.value }))
                  }
                />
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                  }
                />
                <div className="md:col-span-2 space-y-2">
                  <p className="text-sm font-medium">Action people</p>
                  <div className="flex flex-wrap gap-2">
                    {profiles.map((profile) => {
                      const selected = taskForm.participantIds.includes(profile.user_id);
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => toggleParticipant(profile.user_id)}
                          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-muted text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {profile.full_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Button
                    className="w-full"
                    disabled={!taskForm.title.trim()}
                    onClick={() => saveTask.mutate()}
                  >
                    {taskForm.id ? "Save task" : "Create task"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total tasks</p>
            <p className="mt-2 text-3xl font-bold">{totalTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Open tasks</p>
            <p className="mt-2 text-3xl font-bold">{openTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Due in 7 days</p>
            <p className="mt-2 text-3xl font-bold">{dueSoonTasks}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {projects.map((project) => {
          const count = todos.filter((todo) => todo.project_id === project.id).length;
          return (
            <Card key={project.id}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-2 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold">{project.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {count} task{count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isLoading ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-16 text-center text-muted-foreground">
            Loading tasks...
          </CardContent>
        </Card>
      ) : groupedProjects.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-16 text-center">
            <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No tasks match the current filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedProjects.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name}
                  <Badge variant="outline">{group.tasks.length}</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {group.description || "No description"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.tasks.map((todo) => {
                  const taskParticipants = participants.filter(
                    (participant) => participant.todo_id === todo.id
                  );
                  const taskSubtasks = subtasks.filter((subtask) => subtask.todo_id === todo.id);
                  const taskNotes = notes.filter((note) => note.todo_id === todo.id);
                  const completedSubtasks = taskSubtasks.filter((subtask) => subtask.completed).length;
                  const status = statusConfig[todo.status];
                  const priority = priorityConfig[todo.priority];
                  const StatusIcon = status.icon;
                  const responsible = getProfileByProfileId(todo.responsible_id);
                  const isExpanded = expandedTaskIds.includes(todo.id);

                  return (
                    <Card key={todo.id} className="border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-1"
                            onClick={() =>
                              updateTaskStatus.mutate({
                                id: todo.id,
                                status: nextStatus(todo.status),
                              })
                            }
                          >
                            <StatusIcon className={`h-5 w-5 ${status.className}`} />
                          </button>
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold">{todo.title}</h3>
                                  <Badge variant="outline">{status.label}</Badge>
                                  <Badge variant="outline" className={priority.className}>
                                    {priority.label}
                                  </Badge>
                                  {todo.start_date && (
                                    <Badge variant="outline" className="gap-1">
                                      <CalendarDays className="h-3 w-3" />
                                      Starts {todo.start_date}
                                    </Badge>
                                  )}
                                  {todo.due_date && (
                                    <Badge variant="outline" className="gap-1">
                                      <Clock className="h-3 w-3" />
                                      Due {todo.due_date}
                                    </Badge>
                                  )}
                                </div>
                                {todo.description && (
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {todo.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditTask(todo)}
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteTask.mutate(todo.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <UserRound className="h-4 w-4" />
                                <span>
                                  Responsible:{" "}
                                  <strong className="text-foreground">
                                    {responsible?.full_name || "Unassigned"}
                                  </strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <div className="flex items-center -space-x-2">
                                  {taskParticipants.length === 0 ? (
                                    <span>No action people</span>
                                  ) : (
                                    taskParticipants.map((participant) => {
                                      const profile = getProfileByUserId(participant.user_id);
                                      const label = profile?.full_name || "User";
                                      return (
                                        <Avatar key={participant.id} className="h-7 w-7 border border-background">
                                          <AvatarFallback className="text-[10px]">
                                            {getInitials(label)}
                                          </AvatarFallback>
                                        </Avatar>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <ListChecks className="h-4 w-4" />
                                <span>
                                  {completedSubtasks}/{taskSubtasks.length} subtasks
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-4 w-4" />
                                <span>{taskNotes.length} notes</span>
                              </div>
                            </div>

                            <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(todo.id)}>
                              <CollapsibleTrigger asChild>
                                <Button size="sm" variant="ghost" className="px-0">
                                  <ChevronDown
                                    className={`mr-1 h-4 w-4 transition-transform ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                  />
                                  {isExpanded ? "Hide details" : "Show details"}
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-4 pt-2">
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <div className="space-y-3">
                                    <div className="rounded-lg border border-border/60 p-3">
                                      <div className="mb-2 flex items-center gap-2">
                                        <ListChecks className="h-4 w-4" />
                                        <p className="font-medium">Subtasks</p>
                                      </div>
                                      <div className="space-y-2">
                                        {taskSubtasks.map((subtask) => (
                                          <div key={subtask.id} className="flex items-center gap-2">
                                            <Checkbox
                                              checked={subtask.completed}
                                              onCheckedChange={(checked) =>
                                                toggleSubtask.mutate({
                                                  id: subtask.id,
                                                  completed: !!checked,
                                                })
                                              }
                                            />
                                            <span
                                              className={`flex-1 text-sm ${
                                                subtask.completed
                                                  ? "line-through text-muted-foreground"
                                                  : ""
                                              }`}
                                            >
                                              {subtask.title}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => deleteSubtask.mutate(subtask.id)}
                                            >
                                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                            </button>
                                          </div>
                                        ))}
                                        <div className="flex gap-2">
                                          <Input
                                            placeholder="Add subtask"
                                            value={subtaskInput[todo.id] || ""}
                                            onChange={(event) =>
                                              setSubtaskInput((current) => ({
                                                ...current,
                                                [todo.id]: event.target.value,
                                              }))
                                            }
                                            onKeyDown={(event) => {
                                              if (
                                                event.key === "Enter" &&
                                                (subtaskInput[todo.id] || "").trim()
                                              ) {
                                                addSubtask.mutate({
                                                  todoId: todo.id,
                                                  title: subtaskInput[todo.id].trim(),
                                                });
                                              }
                                            }}
                                          />
                                          <Button
                                            variant="outline"
                                            disabled={!(subtaskInput[todo.id] || "").trim()}
                                            onClick={() =>
                                              addSubtask.mutate({
                                                todoId: todo.id,
                                                title: (subtaskInput[todo.id] || "").trim(),
                                              })
                                            }
                                          >
                                            <Plus className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="rounded-lg border border-border/60 p-3">
                                      <div className="mb-2 flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        <p className="font-medium">Notes</p>
                                      </div>
                                      <div className="space-y-3">
                                        {taskNotes.length === 0 && (
                                          <p className="text-sm text-muted-foreground">
                                            No notes yet
                                          </p>
                                        )}
                                        {taskNotes.map((note) => {
                                          const author = getProfileByUserId(note.created_by);
                                          return (
                                            <div key={note.id} className="rounded-md bg-muted/50 p-3">
                                              <div className="mb-1 flex items-center justify-between gap-2">
                                                <p className="text-xs text-muted-foreground">
                                                  {author?.full_name || "Unknown"} •{" "}
                                                  {format(new Date(note.created_at), "MMM d, yyyy p")}
                                                </p>
                                                {note.created_by === user?.id && (
                                                  <button
                                                    type="button"
                                                    onClick={() => deleteNote.mutate(note.id)}
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                  </button>
                                                )}
                                              </div>
                                              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                            </div>
                                          );
                                        })}
                                        <Textarea
                                          rows={3}
                                          placeholder="Add note, decision, meeting summary, or handoff detail"
                                          value={noteInput[todo.id] || ""}
                                          onChange={(event) =>
                                            setNoteInput((current) => ({
                                              ...current,
                                              [todo.id]: event.target.value,
                                            }))
                                          }
                                        />
                                        <Button
                                          variant="outline"
                                          disabled={!(noteInput[todo.id] || "").trim()}
                                          onClick={() =>
                                            addNote.mutate({
                                              todoId: todo.id,
                                              content: (noteInput[todo.id] || "").trim(),
                                            })
                                          }
                                        >
                                          Add Note
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Todos;
