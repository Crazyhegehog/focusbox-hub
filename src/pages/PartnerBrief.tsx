import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

const PartnerBrief = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Partner Brief</h1>
        <p className="text-muted-foreground font-body mt-1">Our partner brieflet document</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" /> LockIn Partner Brieflet
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p className="text-muted-foreground font-body leading-relaxed">
            Add your partner brieflet content here. You can include information about your company,
            partnership benefits, collaboration expectations, and any other relevant details for potential partners.
          </p>
          <div className="mt-6 rounded-lg border border-dashed border-border/50 p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Replace this placeholder with your actual partner brief content.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerBrief;
