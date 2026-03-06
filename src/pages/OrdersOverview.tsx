import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Plus, Truck, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PHONE_SIZES = ["iPhone 14", "iPhone 15", "iPhone 15 Pro", "iPhone 16", "iPhone 16 Pro", "Samsung S24", "Samsung S24 Ultra", "Other"];

const statusConfig = {
  pending: { label: "Pending", className: "bg-warning/15 text-warning border-warning/30" },
  packaged: { label: "Packaged", className: "bg-info/15 text-info border-info/30" },
  sent: { label: "Sent", className: "bg-success/15 text-success border-success/30" },
};

const OrdersOverview = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phoneSize, setPhoneSize] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("orders").insert({ customer_name: customerName, phone_size: phoneSize, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCustomerName("");
      setPhoneSize("");
      setDialogOpen(false);
      toast({ title: "Order created" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Status updated" });
    },
  });

  const totalOrders = orders.length;
  const toShip = orders.filter((o) => o.status !== "sent").length;

  // Phone size summary
  const phoneSizeCounts = orders
    .filter((o) => o.status !== "sent")
    .reduce((acc, o) => {
      acc[o.phone_size] = (acc[o.phone_size] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders Overview</h1>
          <p className="text-muted-foreground font-body mt-1">Track and fulfill orders</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Order</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Order</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <Select value={phoneSize} onValueChange={setPhoneSize}>
                <SelectTrigger><SelectValue placeholder="Phone size" /></SelectTrigger>
                <SelectContent>
                  {PHONE_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={() => createOrder.mutate()} disabled={!customerName || !phoneSize}>
                Create Order
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalOrders}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Still to Ship</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{toShip}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Phone Sizes Needed</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(phoneSizeCounts).map(([size, count]) => (
                <Badge key={size} variant="outline" className="text-xs">{size}: {count}</Badge>
              ))}
              {Object.keys(phoneSizeCounts).length === 0 && <span className="text-sm text-muted-foreground">All shipped</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.customer_name}</TableCell>
                    <TableCell>{order.phone_size}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig[order.status as keyof typeof statusConfig]?.className}>
                        {statusConfig[order.status as keyof typeof statusConfig]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {order.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: order.id, status: "packaged" })}>
                          <Package className="h-3 w-3 mr-1" /> Packaged
                        </Button>
                      )}
                      {order.status === "packaged" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: order.id, status: "sent" })}>
                          <Truck className="h-3 w-3 mr-1" /> Sent
                        </Button>
                      )}
                      {order.status === "sent" && (
                        <CheckCircle2 className="h-4 w-4 text-success inline-block" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrdersOverview;
