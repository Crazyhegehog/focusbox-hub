import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/external-supabase/client";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Package, Search, MapPin, Mail, Pencil, Save, X, Truck, ShoppingBag, CheckCircle2, Clock, CreditCard, StickyNote, Trash2, Download, Send, RefreshCw, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ExternalOrder = {
  id: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string;
  phone_model: string;
  quantity: number;
  amount_total: number;
  currency: string;
  delivery_method: string;
  shipping_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  pickup_class: string | null;
  pickup_email: string | null;
  order_status: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  notes: string | null;
};

const ORDER_STATUSES = ["new", "paid", "shipped", "delivered"] as const;

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  new: { label: "Neu", icon: <Clock className="h-3 w-3" />, className: "bg-warning/15 text-warning border-warning/30" },
  paid: { label: "Bezahlt", icon: <CreditCard className="h-3 w-3" />, className: "bg-info/15 text-info border-info/30" },
  shipped: { label: "Versendet", icon: <Truck className="h-3 w-3" />, className: "bg-secondary/15 text-secondary border-secondary/30" },
  delivered: { label: "Zugestellt", icon: <CheckCircle2 className="h-3 w-3" />, className: "bg-success/15 text-success border-success/30" },
};

const formatAmount = (amount: number, currency: string = "chf") =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);

const exportOrdersCSV = (orders: ExternalOrder[]) => {
  const headers = ["Name", "E-Mail", "Modell", "Menge", "Betrag", "Währung", "Versandart", "Status", "Versandname", "Adresse 1", "Adresse 2", "Stadt", "PLZ", "Land", "Datum", "Notizen"];
  const rows = orders.map((o) => [
    o.customer_name,
    o.customer_email,
    o.phone_model || "",
    o.quantity || 1,
    ((o.amount_total || 0) / 100).toFixed(2),
    (o.currency || "chf").toUpperCase(),
    o.delivery_method === "shipping" ? "Versand" : "Abholung",
    statusConfig[o.order_status]?.label || o.order_status,
    o.shipping_name || "",
    o.shipping_address_line1 || "",
    o.shipping_address_line2 || "",
    o.shipping_city || "",
    o.shipping_postal_code || "",
    o.shipping_country || "",
    new Date(o.created_at).toLocaleDateString("de-CH"),
    (o.notes || "").replace(/"/g, '""'),
  ]);
  const csv = [headers.join(";"), ...rows.map((r) => r.map((v) => `"${v}"`).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bestellungen-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const getEmailsByStatus = (orders: ExternalOrder[], status: string) => {
  return orders
    .filter((o) => o.order_status === status && o.customer_email)
    .map((o) => o.customer_email)
    .filter((v, i, a) => a.indexOf(v) === i);
};

const SPREADSHEET_DATA = [
  { name: "Chanelle Ott", delivery: "pickup", email: "chanelle.ott@stift.ch", qty: 1, price: 24, phone: "iPhone 13", address: "" },
  { name: "Viviana Lindemann", delivery: "pickup", email: "viviana.lindemann@stift.ch", qty: 1, price: 24, phone: "iPhone 13", address: "Sternenweg 8 Einsiedeln" },
  { name: "Josephine Troxler", delivery: "pickup", email: "josephine.troxler@stift.ch", qty: 1, price: 24, phone: "iPhone 14", address: "Hungerstrasse 29 Wollerau" },
  { name: "Chris Hein", delivery: "pickup", email: "", qty: 1, price: 24, phone: "", address: "Etzelstrasse 52 Schindellegi" },
  { name: "Markus Ebner", delivery: "pickup", email: "", qty: 1, price: 35, phone: "iPhone 14 Pro", address: "Hurtnerstrasse 94 Hurden" },
  { name: "Lisa Eitzinger", delivery: "pickup", email: "lisa.eitzinger@stift.ch", qty: 1, price: 24, phone: "", address: "" },
  { name: "Elika Mkhize", delivery: "pickup", email: "elika.mkhize@stift.ch", qty: 1, price: 24, phone: "iPhone 12 mini", address: "Hügelweg 8 Galgenen" },
  { name: "Claudia Scholz", delivery: "shipping", email: "scholz-claudia@gmx.de", qty: 1, price: 29, phone: "iPhone 14 Pro", address: "Grotzenmühlestrasse 5b", postal: "8840", city: "Einsiedeln" },
  { name: "Calogero Rinaldi", delivery: "shipping", email: "calogero.rinaldi@gmail.com", qty: 1, price: 34, phone: "iPhone 13 Pro Max", address: "Walterswilerstrasse 1h", postal: "5745", city: "Safenwil", country: "CH", shipping_name: "Calogero Rinaldi" },
  { name: "Massad Lili-Rose", delivery: "shipping", email: "lili.rose.massad@gmail.com", qty: 1, price: 34, phone: "iPhone 16 Pro", address: "Sur les Moulins 13", postal: "1026", city: "Denges", country: "CH", shipping_name: "Massad Lili-Rose" },
  { name: "Gian Bissig", delivery: "pickup", email: "gian.bissig@icloud.com", qty: 1, price: 23.2, phone: "iPhone 15", address: "" },
  { name: "Anita Brunner", delivery: "shipping", email: "anita_brunner@yahoo.com", qty: 3, price: 92, phone: "iPhone 15+", address: "Seegartenstrasse 67", postal: "8813", city: "Horgen" },
  { name: "Anna Piattini", delivery: "pickup", email: "anna.piattini@stift.ch", qty: 1, price: 29, phone: "iPhone 15 Pro", address: "Bifangweg 3", postal: "8836", city: "Bennau" },
  { name: "Annegret Ziltener", delivery: "shipping", email: "annegret.ziltener@bluewin.ch", qty: 1, price: 34, phone: "iPhone 17 Pro", address: "Im Seehof 6", postal: "8852", city: "Altendorf", country: "CH", shipping_name: "Annegret Ziltener" },
  { name: "Carine Brändle", delivery: "shipping", email: "carine_braendle@hotmail.com", qty: 2, price: 63, phone: "iPhone 14/15", address: "Hürdweg 27b", postal: "8854", city: "Galgenen", shipping_name: "Carine Brändle" },
] as const;


const OrdersOverview = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detailOrder, setDetailOrder] = useState<ExternalOrder | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [editingInfo, setEditingInfo] = useState(false);
  const [editValues, setEditValues] = useState<Partial<ExternalOrder>>({});
  const [importingAddresses, setImportingAddresses] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["external-orders"],
    queryFn: async () => {
      const { data, error } = await externalSupabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExternalOrder[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await externalSupabase.from("orders").update({ order_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      toast({ title: "Status aktualisiert" });
    },
    onError: (err: any) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const { error } = await externalSupabase.from("orders").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      setEditingInfo(false);
      if (detailOrder) setDetailOrder({ ...detailOrder, ...vars.data });
      toast({ title: "Bestellung aktualisiert" });
    },
    onError: (err: any) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await externalSupabase.from("orders").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      setEditingNotes(false);
      if (detailOrder) setDetailOrder({ ...detailOrder, notes: vars.notes });
      toast({ title: "Notizen gespeichert" });
    },
    onError: (err: any) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await externalSupabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      setDetailOrder(null);
      toast({ title: "Bestellung gelöscht" });
    },
    onError: (err: any) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const handleImportAddresses = async () => {
    const ordersWithStripe = orders.filter((o) => o.stripe_session_id && (!o.shipping_address_line1 || o.shipping_address_line1 === ""));
    if (ordersWithStripe.length === 0) {
      toast({ title: "Keine Bestellungen", description: "Alle Bestellungen haben bereits Adressen oder keine Stripe Session." });
      return;
    }

    setImportingAddresses(true);
    try {
      const sessionIds = ordersWithStripe.map((o) => o.stripe_session_id!);
      const { data, error } = await supabase.functions.invoke("fetch-stripe-addresses", {
        body: { session_ids: sessionIds },
      });
      if (error) throw error;

      const results = data.results || {};
      let updated = 0;

      for (const order of ordersWithStripe) {
        const stripeData = results[order.stripe_session_id!];
        if (!stripeData || stripeData.error) continue;

        const updateData: Record<string, any> = {};
        if (stripeData.shipping_name) updateData.shipping_name = stripeData.shipping_name;
        if (stripeData.shipping_address_line1) updateData.shipping_address_line1 = stripeData.shipping_address_line1;
        if (stripeData.shipping_address_line2) updateData.shipping_address_line2 = stripeData.shipping_address_line2;
        if (stripeData.shipping_city) updateData.shipping_city = stripeData.shipping_city;
        if (stripeData.shipping_postal_code) updateData.shipping_postal_code = stripeData.shipping_postal_code;
        if (stripeData.shipping_country) updateData.shipping_country = stripeData.shipping_country;
        if (!order.customer_name && stripeData.customer_name) updateData.customer_name = stripeData.customer_name;
        if (!order.customer_email && stripeData.customer_email) updateData.customer_email = stripeData.customer_email;

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await externalSupabase.from("orders").update(updateData).eq("id", order.id);
          if (!updateError) updated++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      toast({ title: "Import abgeschlossen", description: `${updated} Bestellungen mit Adressen aktualisiert.` });
    } catch (err: any) {
      toast({ title: "Import-Fehler", description: err.message, variant: "destructive" });
    } finally {
      setImportingAddresses(false);
    }
  };

  const handleImportSingleAddress = async (order: ExternalOrder) => {
    if (!order.stripe_session_id) {
      toast({ title: "Keine Stripe Session", description: "Diese Bestellung hat keine Stripe Session ID.", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("fetch-stripe-addresses", {
        body: { session_ids: [order.stripe_session_id] },
      });
      if (error) throw error;

      const stripeData = data.results?.[order.stripe_session_id];
      if (!stripeData || stripeData.error) {
        toast({ title: "Fehler", description: stripeData?.error || "Keine Daten von Stripe", variant: "destructive" });
        return;
      }

      const updateData: Record<string, any> = {};
      if (stripeData.shipping_name) updateData.shipping_name = stripeData.shipping_name;
      if (stripeData.shipping_address_line1) updateData.shipping_address_line1 = stripeData.shipping_address_line1;
      if (stripeData.shipping_address_line2) updateData.shipping_address_line2 = stripeData.shipping_address_line2;
      if (stripeData.shipping_city) updateData.shipping_city = stripeData.shipping_city;
      if (stripeData.shipping_postal_code) updateData.shipping_postal_code = stripeData.shipping_postal_code;
      if (stripeData.shipping_country) updateData.shipping_country = stripeData.shipping_country;
      if (stripeData.customer_name) updateData.customer_name = stripeData.customer_name;
      if (stripeData.customer_email) updateData.customer_email = stripeData.customer_email;

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await externalSupabase.from("orders").update(updateData).eq("id", order.id);
        if (updateError) throw updateError;
        queryClient.invalidateQueries({ queryKey: ["external-orders"] });
        setDetailOrder({ ...order, ...updateData });
        toast({ title: "Adresse importiert" });
      } else {
        toast({ title: "Keine neuen Daten", description: "Stripe hat keine Adressdaten für diese Session." });
      }
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
  };

  const startEditing = (order: ExternalOrder) => {
    setEditingInfo(true);
    setEditValues({
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      phone_model: order.phone_model,
      quantity: order.quantity,
      delivery_method: order.delivery_method,
      shipping_name: order.shipping_name,
      shipping_address_line1: order.shipping_address_line1,
      shipping_address_line2: order.shipping_address_line2,
      shipping_city: order.shipping_city,
      shipping_postal_code: order.shipping_postal_code,
      shipping_country: order.shipping_country,
      pickup_class: order.pickup_class,
      pickup_email: order.pickup_email,
    });
  };

  const saveEditing = () => {
    if (!detailOrder) return;
    updateOrder.mutate({ id: detailOrder.id, data: editValues });
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchTerm ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone_model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shipping_city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.order_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount_total || 0), 0);
  const totalUnits = orders.reduce((sum, o) => sum + (o.quantity || 1), 0);
  const openOrders = orders.filter((o) => o.order_status !== "delivered").length;

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.order_status] = (acc[o.order_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleSendEmail = (status: string) => {
    const emails = getEmailsByStatus(orders, status);
    if (emails.length === 0) {
      toast({ title: "Keine E-Mails", description: `Keine Kunden mit Status "${statusConfig[status]?.label || status}" gefunden.` });
      return;
    }
    const mailto = `mailto:?bcc=${emails.join(",")}`;
    window.open(mailto, "_blank");
    toast({ title: `${emails.length} Empfänger`, description: `E-Mail-Client geöffnet für "${statusConfig[status]?.label}" Bestellungen.` });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bestellungen</h1>
          <p className="text-muted-foreground font-body mt-1">Admin-Dashboard — Externe Datenbank</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleImportAddresses} disabled={importingAddresses}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${importingAddresses ? "animate-spin" : ""}`} /> Adressen importieren
          </Button>
          <Button variant="outline" size="sm" onClick={() => { exportOrdersCSV(filteredOrders); toast({ title: "CSV exportiert" }); }}>
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Send className="h-4 w-4 mr-1.5" /> Gruppen-E-Mail
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>E-Mail an Gruppe senden</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ORDER_STATUSES.map((s) => {
                const count = statusCounts[s] || 0;
                return (
                  <DropdownMenuItem key={s} onClick={() => handleSendEmail(s)} disabled={count === 0}>
                    <span className="flex items-center gap-2 w-full">
                      {statusConfig[s]?.icon}
                      <span>{statusConfig[s]?.label}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">{count}</Badge>
                    </span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                const unshipped = orders.filter((o) => o.order_status !== "shipped" && o.order_status !== "delivered" && o.customer_email);
                const emails = [...new Set(unshipped.map((o) => o.customer_email))];
                if (emails.length === 0) { toast({ title: "Keine E-Mails" }); return; }
                window.open(`mailto:?bcc=${emails.join(",")}`, "_blank");
                toast({ title: `${emails.length} Empfänger`, description: "Alle noch nicht versendeten." });
              }}>
                <span className="flex items-center gap-2 w-full">
                  <Package className="h-3 w-3" />
                  <span>Alle nicht versendet</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Bestellungen</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalOrders}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Einheiten total</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalUnits}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Umsatz</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{formatAmount(totalRevenue, "chf")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Offen</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{openOrders}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <Badge key={status} variant="outline" className={`text-xs ${statusConfig[status]?.className || ""}`}>
                  {statusConfig[status]?.label || status}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Suche nach Name, E-Mail, Modell, Stadt..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Alle Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-1.5">{statusConfig[s]?.icon} {statusConfig[s]?.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Bestellungen laden...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">{searchTerm || statusFilter !== "all" ? "Keine Ergebnisse" : "Keine Bestellungen"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Modell</TableHead>
                    <TableHead className="text-center">Menge</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Versandart</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setDetailOrder(order); setEditingNotes(false); setEditingInfo(false); setNotesValue(order.notes || ""); }}>
                      <TableCell>
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" />{order.customer_email}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{order.phone_model || "—"}</TableCell>
                      <TableCell className="text-center">{order.quantity || 1}</TableCell>
                      <TableCell className="font-medium">{formatAmount(order.amount_total || 0, order.currency || "chf")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {order.delivery_method === "shipping" ? (
                            <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Versand</span>
                          ) : (
                            <span className="flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> Abholung</span>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusConfig[order.order_status]?.className || ""}>
                          <span className="flex items-center gap-1">
                            {statusConfig[order.order_status]?.icon}
                            {statusConfig[order.order_status]?.label || order.order_status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString("de-CH")}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Select
                            value={order.order_status}
                            onValueChange={(v) => updateStatus.mutate({ id: order.id, status: v })}
                          >
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  <span className="flex items-center gap-1.5">{statusConfig[s]?.icon} {statusConfig[s]?.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Bestellung löschen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Bestellung von <strong>{order.customer_name}</strong> wird unwiderruflich gelöscht.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteOrder.mutate(order.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {detailOrder && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">{detailOrder.customer_name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-5 text-sm">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Select
                    value={detailOrder.order_status}
                    onValueChange={(v) => {
                      updateStatus.mutate({ id: detailOrder.id, status: v });
                      setDetailOrder({ ...detailOrder, order_status: v });
                    }}
                  >
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <span className="flex items-center gap-1.5">{statusConfig[s]?.icon} {statusConfig[s]?.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Editable Info */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Bestelldetails
                    </p>
                    <div className="flex gap-1">
                      {!editingInfo ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEditing(detailOrder)}>
                            <Pencil className="h-3 w-3 mr-1" /> Bearbeiten
                          </Button>
                          {detailOrder.stripe_session_id && (
                            <Button size="sm" variant="ghost" onClick={() => handleImportSingleAddress(detailOrder)}>
                              <RefreshCw className="h-3 w-3 mr-1" /> Stripe
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditingInfo(false)}><X className="h-3 w-3" /></Button>
                          <Button size="sm" onClick={saveEditing} disabled={updateOrder.isPending}>
                            <Save className="h-3 w-3 mr-1" /> Speichern
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingInfo ? (
                    <div className="space-y-3 pl-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Name</Label>
                          <Input value={editValues.customer_name || ""} onChange={(e) => setEditValues({ ...editValues, customer_name: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">E-Mail</Label>
                          <Input value={editValues.customer_email || ""} onChange={(e) => setEditValues({ ...editValues, customer_email: e.target.value })} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Modell</Label>
                          <Input value={editValues.phone_model || ""} onChange={(e) => setEditValues({ ...editValues, phone_model: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Menge</Label>
                          <Input type="number" value={editValues.quantity || 1} onChange={(e) => setEditValues({ ...editValues, quantity: parseInt(e.target.value) || 1 })} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Versandart</Label>
                        <Select value={editValues.delivery_method || "shipping"} onValueChange={(v) => setEditValues({ ...editValues, delivery_method: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="shipping">Versand</SelectItem>
                            <SelectItem value="pickup">Abholung</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {editValues.delivery_method === "shipping" && (
                        <>
                          <div>
                            <Label className="text-xs text-muted-foreground">Versandname</Label>
                            <Input value={editValues.shipping_name || ""} onChange={(e) => setEditValues({ ...editValues, shipping_name: e.target.value })} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Adresse 1</Label>
                            <Input value={editValues.shipping_address_line1 || ""} onChange={(e) => setEditValues({ ...editValues, shipping_address_line1: e.target.value })} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Adresse 2</Label>
                            <Input value={editValues.shipping_address_line2 || ""} onChange={(e) => setEditValues({ ...editValues, shipping_address_line2: e.target.value })} className="h-8 text-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">PLZ</Label>
                              <Input value={editValues.shipping_postal_code || ""} onChange={(e) => setEditValues({ ...editValues, shipping_postal_code: e.target.value })} className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Stadt</Label>
                              <Input value={editValues.shipping_city || ""} onChange={(e) => setEditValues({ ...editValues, shipping_city: e.target.value })} className="h-8 text-sm" />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Land</Label>
                            <Input value={editValues.shipping_country || ""} onChange={(e) => setEditValues({ ...editValues, shipping_country: e.target.value })} className="h-8 text-sm" />
                          </div>
                        </>
                      )}

                      {editValues.delivery_method === "pickup" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Klasse</Label>
                            <Input value={editValues.pickup_class || ""} onChange={(e) => setEditValues({ ...editValues, pickup_class: e.target.value })} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Abhol-E-Mail</Label>
                            <Input value={editValues.pickup_email || ""} onChange={(e) => setEditValues({ ...editValues, pickup_email: e.target.value })} className="h-8 text-sm" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 pl-1">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{detailOrder.customer_name}</span>
                      <span className="text-muted-foreground">E-Mail</span>
                      <span className="truncate">{detailOrder.customer_email}</span>
                      <span className="text-muted-foreground">Modell</span>
                      <span className="font-medium">{detailOrder.phone_model || "—"}</span>
                      <span className="text-muted-foreground">Menge</span>
                      <span className="font-medium">{detailOrder.quantity || 1}</span>
                      <span className="text-muted-foreground">Betrag</span>
                      <span className="font-medium">{formatAmount(detailOrder.amount_total || 0, detailOrder.currency || "chf")}</span>
                      <span className="text-muted-foreground">Versandart</span>
                      <span className="font-medium">{detailOrder.delivery_method === "shipping" ? "Versand" : "Abholung"}</span>
                    </div>
                  )}
                </div>

                {/* Shipping or Pickup (read-only view when not editing) */}
                {!editingInfo && detailOrder.delivery_method === "shipping" && (
                  <div className="pt-3 border-t">
                    <p className="text-muted-foreground mb-2 flex items-center gap-1.5 font-medium"><MapPin className="h-3.5 w-3.5" /> Lieferadresse</p>
                    <div className="space-y-0.5 pl-5">
                      {detailOrder.shipping_name && <p className="font-medium">{detailOrder.shipping_name}</p>}
                      <p>{detailOrder.shipping_address_line1 || <span className="text-muted-foreground italic">Keine Adresse</span>}</p>
                      {detailOrder.shipping_address_line2 && <p>{detailOrder.shipping_address_line2}</p>}
                      <p>{[detailOrder.shipping_postal_code, detailOrder.shipping_city].filter(Boolean).join(" ")}</p>
                      {detailOrder.shipping_country && <p>{detailOrder.shipping_country}</p>}
                    </div>
                  </div>
                )}

                {!editingInfo && detailOrder.delivery_method === "pickup" && (
                  <div className="pt-3 border-t">
                    <p className="text-muted-foreground mb-2 flex items-center gap-1.5 font-medium"><ShoppingBag className="h-3.5 w-3.5" /> Abholung</p>
                    <div className="space-y-0.5 pl-5">
                      {detailOrder.pickup_class && <p>Klasse: {detailOrder.pickup_class}</p>}
                      {detailOrder.pickup_email && <p>E-Mail: {detailOrder.pickup_email}</p>}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-muted-foreground flex items-center gap-1.5 font-medium"><StickyNote className="h-3.5 w-3.5" /> Notizen</p>
                    {!editingNotes ? (
                      <Button size="sm" variant="ghost" onClick={() => { setEditingNotes(true); setNotesValue(detailOrder.notes || ""); }}>
                        <Pencil className="h-3 w-3 mr-1" /> Bearbeiten
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}><X className="h-3 w-3" /></Button>
                        <Button size="sm" onClick={() => updateNotes.mutate({ id: detailOrder.id, notes: notesValue })}><Save className="h-3 w-3 mr-1" /> Speichern</Button>
                      </div>
                    )}
                  </div>
                  {editingNotes ? (
                    <Textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} rows={4} placeholder="Notizen hinzufügen..." />
                  ) : (
                    <p className="text-sm pl-5 whitespace-pre-wrap">{detailOrder.notes || <span className="text-muted-foreground italic">Keine Notizen</span>}</p>
                  )}
                </div>

                {/* Stripe */}
                {(detailOrder.stripe_session_id || detailOrder.stripe_payment_intent) && (
                  <div className="pt-3 border-t">
                    <p className="text-muted-foreground mb-2 font-medium">Stripe</p>
                    <div className="space-y-1 pl-5 text-xs text-muted-foreground">
                      {detailOrder.stripe_session_id && <p className="break-all">Session: {detailOrder.stripe_session_id}</p>}
                      {detailOrder.stripe_payment_intent && <p className="break-all">Payment Intent: {detailOrder.stripe_payment_intent}</p>}
                    </div>
                  </div>
                )}

                {/* Delete */}
                <div className="pt-3 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="w-full">
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Bestellung löschen
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Bestellung löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bestellung von <strong>{detailOrder.customer_name}</strong> wird unwiderruflich gelöscht.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteOrder.mutate(detailOrder.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <p className="text-xs text-muted-foreground pt-2">
                  Erstellt: {new Date(detailOrder.created_at).toLocaleString("de-CH")}
                  {detailOrder.updated_at && ` · Aktualisiert: ${new Date(detailOrder.updated_at).toLocaleString("de-CH")}`}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default OrdersOverview;
