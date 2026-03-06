import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

const Orders = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders & Fulfillment</h1>
        <p className="text-muted-foreground font-body mt-1">Manage Stripe orders and shipping</p>
      </div>
      <Card className="border-border/50 border-dashed">
        <CardContent className="py-16 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Stripe Integration</p>
          <p className="text-sm text-muted-foreground/70 font-body mt-1">
            Connect your Stripe account to see orders and manage fulfillment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Orders;
