import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

const CalendarPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground font-body mt-1">View deadlines and milestones</p>
      </div>
      <Card className="border-border/50 border-dashed">
        <CardContent className="py-16 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Calendar Coming Soon</p>
          <p className="text-sm text-muted-foreground/70 font-body mt-1">
            Month/week/day views with task deadlines and milestones.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarPage;
