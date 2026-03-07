import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  endOfMonth,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
} from "date-fns";
import {
  CalendarDays,
  Clock,
  Flag,
  Plus,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Enums, Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Todo = Tables<"todos">;
type CalendarEvent = Tables<"calendar_events">;
type TodoProject = Tables<"todo_projects">;
type CalendarEventType = Enums<"calendar_event_type">;

const eventTypeConfig: Record<
  CalendarEventType,
  { label: string; className: string }
> = {
  meeting: { label: "Meeting", className: "bg-info/15 text-info border-info/30" },
  deadline: { label: "Deadline", className: "bg-destructive/15 text-destructive border-destructive/30" },
  reminder: { label: "Reminder", className: "bg-warning/15 text-warning border-warning/30" },
  personal: { label: "Personal", className: "bg-success/15 text-success border-success/30" },
  other: { label: "Other", className: "bg-muted text-muted-foreground border-border" },
};

const CalendarPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    eventDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    type: "other" as CalendarEventType,
    relatedTodoId: "none",
  });

  const { data: todos = [] } = useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["todo_projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("todo_projects").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["calendar_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .order("event_date")
        .order("start_time", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("calendar_events").insert({
        title: eventForm.title,
        description: eventForm.description || null,
        event_date: eventForm.eventDate,
        start_time: eventForm.startTime || null,
        end_time: eventForm.endTime || null,
        type: eventForm.type,
        related_todo_id: eventForm.relatedTodoId === "none" ? null : eventForm.relatedTodoId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      setDialogOpen(false);
      setEventForm({
        title: "",
        description: "",
        eventDate: format(selectedDate, "yyyy-MM-dd"),
        startTime: "",
        endTime: "",
        type: "other",
        relatedTodoId: "none",
      });
      toast({ title: "Event created" });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      toast({ title: "Event deleted" });
    },
  });

  const getProject = (projectId: string | null) =>
    projects.find((project) => project.id === projectId) || null;

  const selectedDayTasks = todos.filter((todo) => {
    const startMatch = todo.start_date && isSameDay(parseISO(todo.start_date), selectedDate);
    const dueMatch = todo.due_date && isSameDay(parseISO(todo.due_date), selectedDate);
    return !!startMatch || !!dueMatch;
  });

  const selectedDayEvents = events.filter((event) =>
    isSameDay(parseISO(event.event_date), selectedDate)
  );

  const scheduledTodos = todos.filter((todo) => todo.start_date || todo.due_date);
  const scheduleItems = [
    ...scheduledTodos.flatMap((todo) => {
      const items: Array<{
        id: string;
        date: string;
        type: "task-start" | "task-due";
        title: string;
        description: string | null;
        project: TodoProject | null;
        status: Todo["status"];
      }> = [];

      if (todo.start_date) {
        items.push({
          id: `${todo.id}-start`,
          date: todo.start_date,
          type: "task-start",
          title: todo.title,
          description: todo.description,
          project: getProject(todo.project_id),
          status: todo.status,
        });
      }

      if (todo.due_date) {
        items.push({
          id: `${todo.id}-due`,
          date: todo.due_date,
          type: "task-due",
          title: todo.title,
          description: todo.description,
          project: getProject(todo.project_id),
          status: todo.status,
        });
      }

      return items;
    }),
    ...events.map((event) => ({
      id: event.id,
      date: event.event_date,
      type: "event" as const,
      title: event.title,
      description: event.description,
      project: null,
      status: null,
      event,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  const monthRange = {
    start: startOfMonth(visibleMonth),
    end: endOfMonth(visibleMonth),
  };

  const monthTaskCount = scheduledTodos.filter((todo) => {
    const relevantDates = [todo.start_date, todo.due_date].filter(Boolean) as string[];
    return relevantDates.some((date) => isWithinInterval(parseISO(date), monthRange));
  }).length;

  const monthEventCount = events.filter((event) =>
    isWithinInterval(parseISO(event.event_date), monthRange)
  ).length;

  const overdueTasks = todos.filter((todo) => {
    if (!todo.due_date || todo.status === "completed") return false;
    return parseISO(todo.due_date) < new Date();
  }).length;

  const taskDates = scheduledTodos.flatMap((todo) =>
    [todo.start_date, todo.due_date].filter(Boolean).map((date) => parseISO(date!))
  );
  const eventDates = events.map((event) => parseISO(event.event_date));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground font-body mt-1">
            View all scheduled tasks and add standalone events
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() =>
                setEventForm((current) => ({
                  ...current,
                  eventDate: format(selectedDate, "yyyy-MM-dd"),
                }))
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                placeholder="Event title"
                value={eventForm.title}
                onChange={(event) =>
                  setEventForm((current) => ({ ...current, title: event.target.value }))
                }
              />
              <Textarea
                rows={3}
                placeholder="Description"
                value={eventForm.description}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
              <Input
                type="date"
                value={eventForm.eventDate}
                onChange={(event) =>
                  setEventForm((current) => ({ ...current, eventDate: event.target.value }))
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="time"
                  value={eventForm.startTime}
                  onChange={(event) =>
                    setEventForm((current) => ({
                      ...current,
                      startTime: event.target.value,
                    }))
                  }
                />
                <Input
                  type="time"
                  value={eventForm.endTime}
                  onChange={(event) =>
                    setEventForm((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                />
              </div>
              <Select
                value={eventForm.type}
                onValueChange={(value) =>
                  setEventForm((current) => ({
                    ...current,
                    type: value as CalendarEventType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(eventTypeConfig).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={eventForm.relatedTodoId}
                onValueChange={(value) =>
                  setEventForm((current) => ({ ...current, relatedTodoId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Link to task (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked task</SelectItem>
                  {todos.map((todo) => (
                    <SelectItem key={todo.id} value={todo.id}>
                      {todo.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                disabled={!eventForm.title.trim() || !eventForm.eventDate}
                onClick={() => createEvent.mutate()}
              >
                Create Event
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Scheduled tasks this month</p>
            <p className="mt-2 text-3xl font-bold">{monthTaskCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Events this month</p>
            <p className="mt-2 text-3xl font-bold">{monthEventCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Overdue tasks</p>
            <p className="mt-2 text-3xl font-bold">{overdueTasks}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Schedule overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={visibleMonth}
              onMonthChange={setVisibleMonth}
              modifiers={{
                task: taskDates,
                event: eventDates,
              }}
              modifiersClassNames={{
                task: "bg-warning/10 font-semibold text-foreground",
                event: "border border-info/40",
              }}
              className="rounded-md border border-border/60"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{format(selectedDate, "EEEE, MMMM d")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Tasks</p>
              <div className="space-y-2">
                {selectedDayTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks on this date</p>
                ) : (
                  selectedDayTasks.map((todo) => {
                    const project = getProject(todo.project_id);
                    return (
                      <div key={todo.id} className="rounded-lg border border-border/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{todo.title}</p>
                          <Badge variant="outline">{todo.status.replace("_", " ")}</Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {todo.start_date && (
                            <Badge variant="outline" className="gap-1">
                              <Flag className="h-3 w-3" />
                              Start {todo.start_date}
                            </Badge>
                          )}
                          {todo.due_date && (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Due {todo.due_date}
                            </Badge>
                          )}
                          {project && (
                            <Badge variant="outline">{project.name}</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Events</p>
              <div className="space-y-2">
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events on this date</p>
                ) : (
                  selectedDayEvents.map((event) => {
                    const config = eventTypeConfig[event.type];
                    return (
                      <div key={event.id} className="rounded-lg border border-border/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{event.title}</p>
                            {event.description && (
                              <p className="text-sm text-muted-foreground">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteEvent.mutate(event.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={config.className}>
                            {config.label}
                          </Badge>
                          {event.start_time && (
                            <Badge variant="outline">
                              {event.start_time.slice(0, 5)}
                              {event.end_time ? ` - ${event.end_time.slice(0, 5)}` : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Full schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduleItems.length === 0 ? (
            <p className="text-muted-foreground">No scheduled tasks or events yet</p>
          ) : (
            scheduleItems.map((item) => {
              if (item.type === "event") {
                const event = item.event as CalendarEvent;
                const config = eventTypeConfig[event.type];
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-4"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(item.date), "MMM d, yyyy")}
                        {event.start_time ? ` • ${event.start_time.slice(0, 5)}` : ""}
                      </p>
                      {item.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={config.className}>
                      {config.label}
                    </Badge>
                  </div>
                );
              }

              const isDue = item.type === "task-due";
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-4"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(item.date), "MMM d, yyyy")} •{" "}
                      {isDue ? "Task due" : "Task start"}
                    </p>
                    {item.project && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.project.name}
                      </p>
                    )}
                    {item.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  <Badge variant="outline">
                    {(item.status || "").replace("_", " ")}
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarPage;
