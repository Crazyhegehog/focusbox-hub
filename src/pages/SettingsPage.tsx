import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground font-body mt-1">App preferences</p>
      </div>
      <Card className="border-border/50 border-dashed">
        <CardContent className="py-16 text-center">
          <Settings className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Settings Coming Soon</p>
          <p className="text-sm text-muted-foreground/70 font-body mt-1">
            Theme toggle, export options, and more.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
