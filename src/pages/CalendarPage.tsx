import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
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
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type Todo = Tables<"todos">;
type CalendarEvent = Tables<"calendar_events">;
type TodoProject = Tables<"todo_projects">;
type CalendarEventType = Enums<"calendar_event_type">;

const eventTypeConfig: Record<CalendarEventType, { label: string; className: string }> = {
  meeting: { label: "Meeting", className: "bg-info/15 text-info border-info/30" },
  deadline: { label: "Deadline", className: "bg-destructive/15 text-destructive border-destructive/30" },
  reminder: { label: "Reminder", className: "bg-warning/15 text-warning border-warning/30" },
  personal: { label: "Personal", className: "bg-success/15 text-success border-success/30" },
  other: { label: "Other", className: "bg-muted text-muted-foreground border-border" },
};

type ScheduleItem = {
  id: string;
  date: string;
  type: "task-start" | "task-due" | "event";
  title: string;
  description: string | null;
  project: TodoProject | null;
  status: Todo["status"] | null;
  event?: CalendarEvent;
};

const CalendarPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
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
        user_id: user!.id,
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
        eventDate: format(new Date(), "yyyy-MM-dd"),
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
      setSelectedItem(null);
      toast({ title: "Event deleted" });
    },
  });

  const getProject = (projectId: string | null) =>
    projects.find((p) => p.id === projectId) || null;

  // Build 14 days
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), weekOffset * 14 + i));

  // Build all schedule items
  const allItems: ScheduleItem[] = [
    ...todos.flatMap((todo) => {
      const items: ScheduleItem[] = [];
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
  ];

  const getItemsForDay = (day: Date) =>
    allItems.filter((item) => isSameDay(parseISO(item.date), day));

  const today = startOfDay(new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground mt-1">
              {format(days[0], "MMM d")} – {format(days[13], "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
                onChange={(e) => setEventForm((c) => ({ ...c, title: e.target.value }))}
              />
              <Textarea
                rows={3}
                placeholder="Description"
                value={eventForm.description}
                onChange={(e) => setEventForm((c) => ({ ...c, description: e.target.value }))}
              />
              <Input
                type="date"
                value={eventForm.eventDate}
                onChange={(e) => setEventForm((c) => ({ ...c, eventDate: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) => setEventForm((c) => ({ ...c, startTime: e.target.value }))}
                />
                <Input
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) => setEventForm((c) => ({ ...c, endTime: e.target.value }))}
                />
              </div>
              <Select
                value={eventForm.type}
                onValueChange={(v) => setEventForm((c) => ({ ...c, type: v as CalendarEventType }))}
              >
                <SelectTrigger><SelectValue placeholder="Event type" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(eventTypeConfig).map(([type, cfg]) => (
                    <SelectItem key={type} value={type}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={eventForm.relatedTodoId}
                onValueChange={(v) => setEventForm((c) => ({ ...c, relatedTodoId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Link to task (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked task</SelectItem>
                  {todos.map((todo) => (
                    <SelectItem key={todo.id} value={todo.id}>{todo.title}</SelectItem>
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

      {/* 14-day grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Weekday headers */}
        {days.slice(0, 7).map((day) => (
          <div key={format(day, "EEE")} className="text-center text-xs font-medium text-muted-foreground pb-1">
            {format(day, "EEE")}
          </div>
        ))}

        {/* Week 1 */}
        {days.slice(0, 7).map((day) => {
          const dayItems = getItemsForDay(day);
          const isToday = isSameDay(day, today);
          return (
            <DayCell key={day.toISOString()} day={day} items={dayItems} isToday={isToday} onSelect={setSelectedItem} onDayClick={(d) => setSelectedDay(d)} />
          );
        })}

        {/* Week 2 headers */}
        {days.slice(7, 14).map((day) => (
          <div key={format(day, "EEE") + "2"} className="text-center text-xs font-medium text-muted-foreground pb-1 pt-3">
            {format(day, "EEE")}
          </div>
        ))}

        {/* Week 2 */}
        {days.slice(7, 14).map((day) => {
          const dayItems = getItemsForDay(day);
          const isToday = isSameDay(day, today);
          return (
            <DayCell key={day.toISOString()} day={day} items={dayItems} isToday={isToday} onSelect={setSelectedItem} onDayClick={(d) => setSelectedDay(d)} />
          );
        })}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedItem?.title}</SheetTitle>
          </SheetHeader>
          {selectedItem && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">
                  {format(parseISO(selectedItem.date), "EEEE, MMM d")}
                </Badge>
                {selectedItem.type === "event" && selectedItem.event && (
                  <Badge variant="outline" className={eventTypeConfig[selectedItem.event.type].className}>
                    {eventTypeConfig[selectedItem.event.type].label}
                  </Badge>
                )}
                {selectedItem.type === "task-due" && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" /> Due
                  </Badge>
                )}
                {selectedItem.type === "task-start" && (
                  <Badge variant="outline" className="gap-1">
                    <Flag className="h-3 w-3" /> Start
                  </Badge>
                )}
                {selectedItem.status && (
                  <Badge variant="outline">{selectedItem.status.replace("_", " ")}</Badge>
                )}
              </div>

              {selectedItem.event?.start_time && (
                <p className="text-sm text-muted-foreground">
                  {selectedItem.event.start_time.slice(0, 5)}
                  {selectedItem.event.end_time ? ` – ${selectedItem.event.end_time.slice(0, 5)}` : ""}
                </p>
              )}

              {selectedItem.description && (
                <p className="text-sm">{selectedItem.description}</p>
              )}

              {selectedItem.project && (
                <p className="text-sm text-muted-foreground">
                  Project: {selectedItem.project.name}
                </p>
              )}

              {selectedItem.type === "event" && selectedItem.event && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteEvent.mutate(selectedItem.event!.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Event
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Day Detail Sheet */}
      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedDay ? format(selectedDay, "EEEE, MMM d, yyyy") : ""}</SheetTitle>
          </SheetHeader>
          {selectedDay && (
            <div className="pt-4 space-y-2">
              {(() => {
                const dayItems = getItemsForDay(selectedDay);
                // Sort: events with time first (by time), then items without time
                const withTime = dayItems
                  .filter((i) => i.type === "event" && i.event?.start_time)
                  .sort((a, b) => (a.event!.start_time! > b.event!.start_time! ? 1 : -1));
                const withoutTime = dayItems.filter(
                  (i) => !(i.type === "event" && i.event?.start_time)
                );

                if (dayItems.length === 0) {
                  return <p className="text-sm text-muted-foreground">No events or tasks for this day.</p>;
                }

                return (
                  <>
                    {withTime.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setSelectedDay(null); setTimeout(() => setSelectedItem(item), 150); }}
                        className="w-full text-left flex items-start gap-3 rounded-lg border border-border/50 p-3 hover:bg-accent/30 transition-colors"
                      >
                        <div className="text-xs font-mono text-muted-foreground pt-0.5 min-w-[50px]">
                          {item.event!.start_time!.slice(0, 5)}
                          {item.event!.end_time && (
                            <span className="block">{item.event!.end_time.slice(0, 5)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          {item.event && (
                            <Badge variant="outline" className={`mt-1 text-[10px] ${eventTypeConfig[item.event.type].className}`}>
                              {eventTypeConfig[item.event.type].label}
                            </Badge>
                          )}
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                    {withoutTime.length > 0 && withTime.length > 0 && (
                      <p className="text-xs font-medium text-muted-foreground pt-2">All day / Tasks</p>
                    )}
                    {withoutTime.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setSelectedDay(null); setTimeout(() => setSelectedItem(item), 150); }}
                        className="w-full text-left flex items-start gap-3 rounded-lg border border-border/50 p-3 hover:bg-accent/30 transition-colors"
                      >
                        <div className="text-xs text-muted-foreground pt-0.5 min-w-[50px]">
                          {item.type === "task-due" ? "Due" : item.type === "task-start" ? "Start" : "Event"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          {item.status && (
                            <Badge variant="outline" className="mt-1 text-[10px]">{item.status.replace("_", " ")}</Badge>
                          )}
                          {item.project && (
                            <p className="text-xs text-muted-foreground mt-1">{item.project.name}</p>
                          )}
                        </div>
                      </button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => {
                        setSelectedDay(null);
                        setEventForm((c) => ({ ...c, eventDate: format(selectedDay, "yyyy-MM-dd") }));
                        setTimeout(() => setDialogOpen(true), 150);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Event
                    </Button>
                  </>
                );
              })()}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

function DayCell({
  day,
  items,
  isToday,
  onSelect,
  onDayClick,
}: {
  day: Date;
  items: ScheduleItem[];
  isToday: boolean;
  onSelect: (item: ScheduleItem) => void;
  onDayClick: (day: Date) => void;
}) {
  return (
    <Card
      className={`min-h-[120px] cursor-pointer transition-colors hover:bg-accent/30 ${isToday ? "border-primary/50 bg-primary/5" : "border-border/40"}`}
      onClick={() => onDayClick(day)}
    >
      <CardContent className="p-2">
        <p className={`text-xs font-semibold mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
          {format(day, "d")}
        </p>
        <div className="space-y-1">
          {items.slice(0, 4).map((item) => (
            <button
              key={item.id}
              onClick={(e) => { e.stopPropagation(); onSelect(item); }}
              className="w-full text-left rounded px-1.5 py-0.5 text-[11px] leading-tight transition-colors hover:bg-accent"
              style={{
                borderLeft: `2px solid ${
                  item.type === "event"
                    ? "hsl(var(--info))"
                    : item.type === "task-due"
                    ? "hsl(var(--destructive))"
                    : "hsl(var(--warning))"
                }`,
              }}
            >
              <div className="flex items-center gap-1">
                {item.event?.start_time && (
                  <span className="font-mono text-muted-foreground flex-shrink-0">{item.event.start_time.slice(0, 5)}</span>
                )}
                <span className="truncate">{item.title}</span>
              </div>
            </button>
          ))}
          {items.length > 4 && (
            <p className="text-[10px] text-muted-foreground px-1">+{items.length - 4} more</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default CalendarPage;
