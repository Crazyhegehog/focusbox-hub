import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PartnerBrief = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partner Brief</h1>
          <p className="text-muted-foreground font-body mt-1">
            Embedded LockIn brieflet for partner conversations
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/lockin-brieflet.pdf" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            Open PDF
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            LockIn Brieflet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/60 overflow-hidden bg-muted/20">
            <iframe
              src="/lockin-brieflet.pdf"
              title="LockIn Brieflet"
              className="h-[78vh] w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerBrief;
