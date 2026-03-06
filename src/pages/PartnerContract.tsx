import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

const PartnerContract = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Partner Contract</h1>
        <p className="text-muted-foreground font-body mt-1">Standard partnership agreement</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5" /> LockIn Partnership Agreement
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p className="text-muted-foreground font-body leading-relaxed">
            Add your partner contract content here. Include terms and conditions,
            obligations, revenue sharing details, and any legal provisions.
          </p>
          <div className="mt-6 rounded-lg border border-dashed border-border/50 p-8 text-center">
            <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Replace this placeholder with your actual partnership contract.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerContract;
