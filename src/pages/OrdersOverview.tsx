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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Package, Plus, Truck, CheckCircle2, Search, Download, Mail, MapPin, Phone, Pencil, Save, X, Trash2 } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [detailOrder, setDetailOrder] = useState<any>(null);

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

  const updateOrder = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("orders").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setEditingId(null);
      setEditValues({});
      toast({ title: "Bestellung aktualisiert" });
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

  const importOrders = async () => {
    setImporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("import-stripe-orders", {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (res.error) throw res.error;
      const result = res.data;
      toast({ title: "Import abgeschlossen", description: `${result.imported} importiert, ${result.skipped} übersprungen` });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err: any) {
      toast({ title: "Import fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const startEdit = (order: any) => {
    setEditingId(order.id);
    setEditValues({
      customer_name: order.customer_name,
      phone_size: order.phone_size,
      customer_email: order.customer_email || "",
      customer_phone: order.customer_phone || "",
      status: order.status,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateOrder.mutate({ id: editingId, updates: editValues });
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchTerm ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.stripe_product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shipping_city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOrders = orders.length;
  const toShip = orders.filter((o) => o.status !== "sent").length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount_total || 0), 0);

  const phoneSizeCounts = orders
    .filter((o) => o.status !== "sent")
    .reduce((acc, o) => {
      if (o.phone_size) acc[o.phone_size] = (acc[o.phone_size] || 0) + (o.quantity || 1);
      return acc;
    }, {} as Record<string, number>);

  const formatAmount = (amount: number, currency: string = "eur") => {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders Overview</h1>
          <p className="text-muted-foreground font-body mt-1">Track and fulfill orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={importOrders} disabled={importing}>
            <Download className="h-4 w-4 mr-1" />
            {importing ? "Importing..." : "Import from Stripe"}
          </Button>
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalOrders}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Still to Ship</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{toShip}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{formatAmount(totalRevenue)}</p></CardContent>
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

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, product, city..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="packaged">Packaged</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">{searchTerm || statusFilter !== "all" ? "No orders match your filters" : "No orders yet"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Phone Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const isEditing = editingId === order.id;
                    return (
                      <TableRow key={order.id} className="cursor-pointer" onClick={() => !isEditing && setDetailOrder(order)}>
                        <TableCell className="font-medium">
                          {isEditing ? (
                            <Input value={editValues.customer_name} onChange={(e) => setEditValues({ ...editValues, customer_name: e.target.value })} className="w-36" />
                          ) : order.customer_name}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="space-y-1">
                              <Input value={editValues.customer_email} onChange={(e) => setEditValues({ ...editValues, customer_email: e.target.value })} placeholder="Email" className="w-40 text-sm" />
                              <Input value={editValues.customer_phone} onChange={(e) => setEditValues({ ...editValues, customer_phone: e.target.value })} placeholder="Phone" className="w-40 text-sm" />
                            </div>
                          ) : (
                            <div className="space-y-0.5 text-sm">
                              {order.customer_email && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate max-w-[160px]">{order.customer_email}</span>
                                </div>
                              )}
                              {order.customer_phone && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  <span>{order.customer_phone}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{order.stripe_product_name || "—"}</span>
                          {(order.quantity ?? 1) > 1 && <Badge variant="secondary" className="ml-1 text-xs">x{order.quantity}</Badge>}
                        </TableCell>
                        <TableCell>
                          {order.amount_total ? <span className="font-medium">{formatAmount(order.amount_total, order.currency || "eur")}</span> : "—"}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select value={editValues.phone_size || ""} onValueChange={(v) => setEditValues({ ...editValues, phone_size: v })}>
                              <SelectTrigger className="w-36"><SelectValue placeholder="Phone size" /></SelectTrigger>
                              <SelectContent>
                                {PHONE_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            order.phone_size || "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select value={editValues.status} onValueChange={(v) => setEditValues({ ...editValues, status: v })}>
                              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="packaged">Packaged</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={statusConfig[order.status as keyof typeof statusConfig]?.className}>
                              {statusConfig[order.status as keyof typeof statusConfig]?.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                              <Button size="sm" onClick={saveEdit}><Save className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => startEdit(order)}><Pencil className="h-3 w-3" /></Button>
                              {order.status === "pending" && (
                                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: order.id, status: "packaged" })}>
                                  <Package className="h-3 w-3 mr-1" /> Pack
                                </Button>
                              )}
                              {order.status === "packaged" && (
                                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: order.id, status: "sent" })}>
                                  <Truck className="h-3 w-3 mr-1" /> Send
                                </Button>
                              )}
                              {order.status === "sent" && <CheckCircle2 className="h-4 w-4 text-success" />}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <SheetContent className="overflow-y-auto">
          {detailOrder && (
            <>
              <SheetHeader>
                <SheetTitle>{detailOrder.customer_name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-y-3">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={statusConfig[detailOrder.status as keyof typeof statusConfig]?.className}>
                    {statusConfig[detailOrder.status as keyof typeof statusConfig]?.label}
                  </Badge>
                  <span className="text-muted-foreground">Phone Size</span>
                  <span className="font-medium">{detailOrder.phone_size || "—"}</span>
                  <span className="text-muted-foreground">Product</span>
                  <span>{detailOrder.stripe_product_name || "—"}</span>
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">{detailOrder.amount_total ? formatAmount(detailOrder.amount_total, detailOrder.currency || "eur") : "—"}</span>
                  <span className="text-muted-foreground">Quantity</span>
                  <span>{detailOrder.quantity || 1}</span>
                  <span className="text-muted-foreground">Email</span>
                  <span>{detailOrder.customer_email || "—"}</span>
                  <span className="text-muted-foreground">Phone</span>
                  <span>{detailOrder.customer_phone || "—"}</span>
                </div>
                {(detailOrder.shipping_address || detailOrder.shipping_city) && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> Shipping Address</p>
                    <p>{detailOrder.shipping_address}</p>
                    <p>{[detailOrder.shipping_postal_code, detailOrder.shipping_city].filter(Boolean).join(" ")}</p>
                    <p>{[detailOrder.shipping_state, detailOrder.shipping_country].filter(Boolean).join(", ")}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-2">Created: {new Date(detailOrder.created_at).toLocaleString("de-DE")}</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default OrdersOverview;
