import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Package, Search, MapPin, Mail, Pencil, Save, X, Truck, ShoppingBag, CheckCircle2, Clock, CreditCard, StickyNote, Trash2, Download, Send, RefreshCw, Phone, Plus } from "lucide-react";
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

const getBoxSize = (phoneModel: string): string => {
  if (!phoneModel) return "—";
  const lower = phoneModel.toLowerCase();
  if (lower.includes("mini")) return "S";
  if (lower.includes("plus") || lower.includes("max")) return "L";
  // Normal + Pro (not Pro Max) → M
  return "M";
};

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

const exportAddressesCSV = (orders: ExternalOrder[]) => {
  // Only export unshipped orders with shipping enabled
  const shippingOrders = orders.filter((o) => o.delivery_method === "shipping" && o.order_status !== "shipped" && o.order_status !== "delivered" && (o.shipping_address_line1 || o.shipping_name));
  if (shippingOrders.length === 0) return;

  const headers = ["Name", "Adresse 1", "Adresse 2", "PLZ", "Stadt", "Land"];
  const rows = shippingOrders.map((o) => [
    o.shipping_name || o.customer_name || "",
    o.shipping_address_line1 || "",
    o.shipping_address_line2 || "",
    o.shipping_postal_code || "",
    o.shipping_city || "",
    o.shipping_country || "CH",
  ]);
  const csv = [headers.join(";"), ...rows.map((r) => r.map((v) => `"${v}"`).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adressen-versand-${new Date().toISOString().slice(0, 10)}.csv`;
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
  const [importingSpreadsheet, setImportingSpreadsheet] = useState(false);
  const [importingStripe, setImportingStripe] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newOrder, setNewOrder] = useState({
    customer_name: "",
    customer_email: "",
    phone_model: "",
    quantity: 1,
    amount_total: 0,
    currency: "chf",
    delivery_method: "shipping",
    payment_method: "stripe",
    order_status: "paid",
    shipping_name: "",
    shipping_address_line1: "",
    shipping_city: "",
    shipping_postal_code: "",
    shipping_country: "CH",
    notes: "",
  });
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["external-orders"],
    queryFn: async () => {
      const { data, error } = await externalSupabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const all = data || [];
      
      // Separate named entries and null-name (Stripe-only) entries
      const named = all.filter((o: any) => o.customer_name);
      const unnamed = all.filter((o: any) => !o.customer_name);
      
      // Build email lookup for named entries
      const byEmail = new Map<string, any>();
      for (const o of named) {
        if (o.customer_email) byEmail.set(o.customer_email.trim().toLowerCase(), o);
      }
      
      // Merge data from unnamed Stripe entries into named ones, then delete unnamed
      const toDeleteIds: string[] = [];
      for (const u of unnamed) {
        const email = u.customer_email?.trim().toLowerCase();
        const match = email ? byEmail.get(email) : null;
        if (match) {
          // Merge missing fields from Stripe entry into the named entry
          const mergeUpdates: Record<string, any> = {};
          for (const [key, val] of Object.entries(u)) {
            if (["id", "created_at", "updated_at", "customer_name"].includes(key)) continue;
            if (val && val !== "" && val !== 0 && (!match[key] || match[key] === "" || match[key] === null || match[key] === 0)) {
              // For amount_total: always prefer higher value (cents) to prevent 29 overwriting 2900
              if (key === "amount_total" && match[key] && match[key] > val) continue;
              mergeUpdates[key] = val;
            }
          }
          // Always prefer earliest created_at (Stripe order date)
          if (new Date(u.created_at) < new Date(match.created_at)) {
            mergeUpdates.created_at = u.created_at;
          }
          if (Object.keys(mergeUpdates).length > 0) {
            await externalSupabase.from("orders").update(mergeUpdates).eq("id", match.id);
            Object.assign(match, mergeUpdates);
          }
        }
        toDeleteIds.push(u.id);
      }
      
      // Deduplicate named entries by name
      const seen = new Map<string, any>();
      const deduped: any[] = [];
      for (const o of named) {
        const key = o.customer_name.trim().toLowerCase();
        if (seen.has(key)) {
          const existing = seen.get(key);
          // Merge missing fields
          const mergeUpdates: Record<string, any> = {};
          for (const [k, v] of Object.entries(o)) {
            if (["id", "created_at", "updated_at"].includes(k)) continue;
            if (v && v !== "" && v !== 0 && (!existing[k] || existing[k] === "" || existing[k] === null || existing[k] === 0)) {
              if (k === "amount_total" && existing[k] && existing[k] > v) continue;
              mergeUpdates[k] = v;
            }
          }
          if (Object.keys(mergeUpdates).length > 0) {
            await externalSupabase.from("orders").update(mergeUpdates).eq("id", existing.id);
            Object.assign(existing, mergeUpdates);
          }
          toDeleteIds.push(o.id);
        } else {
          seen.set(key, o);
          deduped.push(o);
        }
      }
      
      // Delete all duplicates and unnamed entries in background
      for (const id of toDeleteIds) {
        await externalSupabase.from("orders").delete().eq("id", id);
      }
      
      // Sort by created_at descending (newest first)
      deduped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return deduped as ExternalOrder[];
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

  const handleImportSpreadsheet = async () => {
    setImportingSpreadsheet(true);
    try {
      let deleted = 0;
      let updated = 0;
      let inserted = 0;

      // Step 1: Fetch all orders and deduplicate by customer_name
      const { data: allOrders } = await externalSupabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: true });

      if (allOrders) {
        const byName: Record<string, any[]> = {};
        for (const o of allOrders) {
          const key = o.customer_name?.trim().toLowerCase();
          if (!key) continue;
          if (!byName[key]) byName[key] = [];
          byName[key].push(o);
        }

        for (const [, group] of Object.entries(byName)) {
          if (group.length <= 1) continue;

          // Keep the one with the most filled fields, prefer oldest on tie
          const scored = group.map((o) => ({
            order: o,
            score: Object.values(o).filter((v) => v !== null && v !== "" && v !== 0).length,
          }));
          scored.sort((a, b) => b.score - a.score || new Date(a.order.created_at).getTime() - new Date(b.order.created_at).getTime());

          const keeper = scored[0].order;
          const duplicates = scored.slice(1);

          // Merge any missing fields from duplicates into keeper
          const mergeUpdates: Record<string, any> = {};
          for (const dup of duplicates) {
            for (const [key, val] of Object.entries(dup.order)) {
              if (key === "id" || key === "created_at" || key === "updated_at") continue;
              if (val && val !== "" && (!keeper[key] || keeper[key] === "" || keeper[key] === null)) {
                mergeUpdates[key] = val;
              }
            }
          }

          if (Object.keys(mergeUpdates).length > 0) {
            await externalSupabase.from("orders").update(mergeUpdates).eq("id", keeper.id);
          }

          // Delete duplicates
          for (const dup of duplicates) {
            await externalSupabase.from("orders").delete().eq("id", dup.order.id);
            deleted++;
          }
        }
      }

      // Step 2: Upsert spreadsheet data
      for (const row of SPREADSHEET_DATA) {
        const { data: existing } = await externalSupabase
          .from("orders")
          .select("*")
          .ilike("customer_name", row.name)
          .maybeSingle();

        const newData: Record<string, any> = {};
        if (row.email) newData.customer_email = row.email;
        if (row.phone) newData.phone_model = row.phone;
        if (row.qty) newData.quantity = row.qty;
        if (row.price) newData.amount_total = Math.round(row.price * 100);
        newData.delivery_method = row.delivery;
        newData.order_status = "paid";
        newData.currency = "chf";
        if ("address" in row && row.address) newData.shipping_address_line1 = row.address;
        if ("city" in row && row.city) newData.shipping_city = row.city;
        if ("postal" in row && row.postal) newData.shipping_postal_code = row.postal;
        if ("country" in row && row.country) newData.shipping_country = row.country;
        if ("shipping_name" in row && row.shipping_name) newData.shipping_name = row.shipping_name;

        if (existing) {
          // Only fill empty fields, don't overwrite existing data
          const updates: Record<string, any> = {};
          for (const [k, v] of Object.entries(newData)) {
            if (v && (!existing[k] || existing[k] === "" || existing[k] === null)) {
              updates[k] = v;
            }
          }
          if (Object.keys(updates).length > 0) {
            await externalSupabase.from("orders").update(updates).eq("id", existing.id);
            updated++;
          }
        } else {
          await externalSupabase.from("orders").insert({ customer_name: row.name, ...newData });
          inserted++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      toast({ title: "Bereinigung abgeschlossen", description: `${deleted} Duplikate gelöscht, ${updated} aktualisiert, ${inserted} neu.` });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setImportingSpreadsheet(false);
    }
  };

  const handleImportStripeOrders = async () => {
    setImportingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-stripe-orders");
      if (error) throw error;

      const stripeSessions = data.sessions || [];
      if (stripeSessions.length === 0) {
        toast({ title: "Keine Stripe-Bestellungen gefunden" });
        return;
      }

      // Get existing orders from external DB
      const { data: existing } = await externalSupabase.from("orders").select("customer_email, stripe_payment_intent, stripe_session_id");
      const existingEmails = new Set((existing || []).map((o: any) => o.customer_email?.trim().toLowerCase()).filter(Boolean));
      const existingIntents = new Set((existing || []).map((o: any) => o.stripe_payment_intent).filter(Boolean));
      const existingSessions = new Set((existing || []).map((o: any) => o.stripe_session_id).filter(Boolean));

      let imported = 0;
      let skipped = 0;

      for (const s of stripeSessions) {
        // Skip if already exists by session, payment intent, or email
        if (s.stripe_session_id && existingSessions.has(s.stripe_session_id)) { skipped++; continue; }
        if (s.stripe_payment_intent && existingIntents.has(s.stripe_payment_intent)) { skipped++; continue; }
        if (s.customer_email && existingEmails.has(s.customer_email.trim().toLowerCase())) { skipped++; continue; }

        console.log(`Importing order: ${s.customer_name || s.customer_email}, amount_total=${s.amount_total}, currency=${s.currency}`);
        const { error: insertError } = await externalSupabase.from("orders").insert({
          customer_name: s.customer_name || s.customer_email || "Stripe Kunde",
          customer_email: s.customer_email || "",
          phone_model: s.phone_model || "",
          quantity: s.quantity || 1,
          amount_total: s.amount_total || 0,
          currency: s.currency || "chf",
          delivery_method: s.delivery_method || "shipping",
          shipping_name: s.shipping_name || "",
          shipping_address_line1: s.shipping_address_line1 || "",
          shipping_address_line2: s.shipping_address_line2 || "",
          shipping_city: s.shipping_city || "",
          shipping_postal_code: s.shipping_postal_code || "",
          shipping_country: s.shipping_country || "",
          order_status: s.order_status || "paid",
          stripe_session_id: s.stripe_session_id,
          stripe_payment_intent: s.stripe_payment_intent,
          created_at: s.created_at,
        });

        if (!insertError) {
          imported++;
          if (s.customer_email) existingEmails.add(s.customer_email.trim().toLowerCase());
        }
      }

      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      toast({ title: "Stripe-Import abgeschlossen", description: `${imported} neu importiert, ${skipped} übersprungen.` });
    } catch (err: any) {
      toast({ title: "Stripe-Import Fehler", description: err.message, variant: "destructive" });
    } finally {
      setImportingStripe(false);
    }
  };

  const startEditing = (order: ExternalOrder) => {
    setEditingInfo(true);
    setEditValues({
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      phone_model: order.phone_model,
      quantity: order.quantity,
      amount_total: order.amount_total,
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

  // Build flat list of individual shipping units from orders
  type ShippingUnit = { orderId: string; unitIndex: number; customerName: string; customerEmail: string; phoneModel: string; boxSize: string; shippingName: string; address: string; city: string; postalCode: string; country: string; deliveryMethod: string; orderStatus: string; };
  const shippingUnits = useMemo(() => {
    const units: ShippingUnit[] = [];
    for (const order of orders) {
      if (order.delivery_method !== "shipping") continue;
      const qty = order.quantity || 1;
      for (let i = 0; i < qty; i++) {
        units.push({
          orderId: order.id,
          unitIndex: i,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          phoneModel: order.phone_model || "",
          boxSize: getBoxSize(order.phone_model),
          shippingName: order.shipping_name || order.customer_name,
          address: [order.shipping_address_line1, order.shipping_address_line2].filter(Boolean).join(", "),
          city: order.shipping_city || "",
          postalCode: order.shipping_postal_code || "",
          country: order.shipping_country || "CH",
          deliveryMethod: order.delivery_method,
          orderStatus: order.order_status,
        });
      }
    }
    return units;
  }, [orders]);

  const unshippedUnits = shippingUnits.filter(u => u.orderStatus !== "shipped" && u.orderStatus !== "delivered");
  const boxSizeStats = useMemo(() => {
    const stats = { S: 0, M: 0, L: 0 };
    for (const u of unshippedUnits) {
      if (u.boxSize === "S") stats.S++;
      else if (u.boxSize === "M") stats.M++;
      else if (u.boxSize === "L") stats.L++;
    }
    return stats;
  }, [unshippedUnits]);

  // Local pickup / nearby delivery units
  const LOCAL_CITIES = ["einsiedeln", "wollerau", "pfäffikon"];
  const localUnits = useMemo(() => {
    const units: (typeof shippingUnits[0] & { type: string; qty: number })[] = [];
    const seen = new Set<string>();
    for (const order of orders) {
      if (order.order_status === "shipped" || order.order_status === "delivered") continue;
      if (seen.has(order.id)) continue;
      seen.add(order.id);
      const isPickup = order.delivery_method === "pickup" || order.delivery_method !== "shipping";
      const isLocalShipping = order.delivery_method === "shipping" && LOCAL_CITIES.some(c => 
        (order.shipping_city || "").toLowerCase().includes(c)
      );
      if (!isPickup && !isLocalShipping) continue;
      units.push({
        orderId: order.id,
        unitIndex: 0,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        phoneModel: order.phone_model || "",
        boxSize: getBoxSize(order.phone_model),
        shippingName: order.shipping_name || order.customer_name,
        address: [order.shipping_address_line1, order.shipping_address_line2].filter(Boolean).join(", "),
        city: order.shipping_city || "",
        postalCode: order.shipping_postal_code || "",
        country: order.shipping_country || "CH",
        deliveryMethod: order.delivery_method,
        orderStatus: order.order_status,
        type: isPickup ? "Abholung" : "Lokal",
        qty: order.quantity || 1,
      });
    }
    return units;
  }, [orders]);

  // Production stats: all undelivered orders by box size
  const productionStats = useMemo(() => {
    const stats = { S: 0, M: 0, L: 0, unknown: 0, total: 0, byModel: {} as Record<string, { count: number; boxSize: string }> };
    for (const order of orders) {
      if (order.order_status === "shipped" || order.order_status === "delivered") continue;
      const qty = order.quantity || 1;
      const box = getBoxSize(order.phone_model);
      const model = order.phone_model || "Unbekannt";
      if (box === "S") stats.S += qty;
      else if (box === "M") stats.M += qty;
      else if (box === "L") stats.L += qty;
      else stats.unknown += qty;
      stats.total += qty;
      if (!stats.byModel[model]) stats.byModel[model] = { count: 0, boxSize: box };
      stats.byModel[model].count += qty;
    }
    return stats;
  }, [orders]);


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
  const handleCreateOrder = async () => {
    if (!newOrder.customer_name.trim()) {
      toast({ title: "Name erforderlich", variant: "destructive" });
      return;
    }
    const amountInCents = Math.round(newOrder.amount_total * 100);
    const { error } = await externalSupabase.from("orders").insert({
      customer_name: newOrder.customer_name,
      customer_email: newOrder.customer_email,
      phone_model: newOrder.phone_model,
      quantity: newOrder.quantity,
      amount_total: amountInCents,
      currency: newOrder.currency,
      delivery_method: newOrder.delivery_method,
      order_status: newOrder.order_status,
      shipping_name: newOrder.shipping_name || newOrder.customer_name,
      shipping_address_line1: newOrder.shipping_address_line1,
      shipping_city: newOrder.shipping_city,
      shipping_postal_code: newOrder.shipping_postal_code,
      shipping_country: newOrder.shipping_country,
      notes: [newOrder.payment_method !== "stripe" ? `Zahlungsart: ${newOrder.payment_method}` : "", newOrder.notes].filter(Boolean).join("\n"),
    });
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bestellung erstellt" });
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      setShowCreateDialog(false);
      setNewOrder({
        customer_name: "", customer_email: "", phone_model: "", quantity: 1, amount_total: 0,
        currency: "chf", delivery_method: "shipping", payment_method: "stripe", order_status: "paid",
        shipping_name: "", shipping_address_line1: "", shipping_city: "", shipping_postal_code: "",
        shipping_country: "CH", notes: "",
      });
    }
  };


    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bestellungen</h1>
          <p className="text-muted-foreground font-body mt-1">Admin-Dashboard — Externe Datenbank</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleImportSpreadsheet} disabled={importingSpreadsheet}>
            <Download className={`h-4 w-4 mr-1.5 ${importingSpreadsheet ? "animate-spin" : ""}`} /> Excel-Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportStripeOrders} disabled={importingStripe}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${importingStripe ? "animate-spin" : ""}`} /> Stripe-Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportAddresses} disabled={importingAddresses}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${importingAddresses ? "animate-spin" : ""}`} /> Adressen importieren
          </Button>
           <Button variant="outline" size="sm" onClick={() => { exportOrdersCSV(filteredOrders); toast({ title: "CSV exportiert" }); }}>
             <Download className="h-4 w-4 mr-1.5" /> Export
           </Button>
           <Button variant="outline" size="sm" onClick={() => { 
             const shippingOrders = filteredOrders.filter(o => o.delivery_method === "shipping");
             if (shippingOrders.length === 0) {
               toast({ title: "Keine Adressen", description: "Keine Versandadressen zum Exportieren gefunden.", variant: "destructive" });
               return;
             }
             exportAddressesCSV(filteredOrders);
             toast({ title: `${shippingOrders.length} Adressen exportiert` });
           }}>
             <MapPin className="h-4 w-4 mr-1.5" /> Adressen-Export
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders">Bestellungen</TabsTrigger>
          <TabsTrigger value="shipping" className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Versand
            {unshippedUnits.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{unshippedUnits.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="local" className="flex items-center gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" /> Abholung & Lokal
            {localUnits.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{localUnits.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> Produktion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6 mt-4">

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
                    <TableHead className="text-center">Box</TableHead>
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
                      <TableCell className="text-center">
                        <Badge variant="outline" className={
                          getBoxSize(order.phone_model) === "S" ? "bg-blue-500/15 text-blue-600 border-blue-500/30" :
                          getBoxSize(order.phone_model) === "M" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                          getBoxSize(order.phone_model) === "L" ? "bg-purple-500/15 text-purple-600 border-purple-500/30" :
                          ""
                        }>
                          {getBoxSize(order.phone_model)}
                        </Badge>
                      </TableCell>
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

        </TabsContent>

        <TabsContent value="shipping" className="space-y-6 mt-4">
          {/* Shipping Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Noch zu versenden</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{unshippedUnits.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/30">S</Badge> Small (Mini)</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{boxSizeStats.S}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30">M</Badge> Medium (Normal/Pro)</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{boxSizeStats.M}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Badge variant="outline" className="bg-purple-500/15 text-purple-600 border-purple-500/30">L</Badge> Large (Plus/Max)</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{boxSizeStats.L}</p></CardContent>
            </Card>
          </div>

          {/* Shipping Queue */}
          <Card>
            <CardContent className="p-0">
              {unshippedUnits.length === 0 ? (
                <div className="py-16 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-success/30 mb-4" />
                  <p className="text-muted-foreground font-medium">Alles versendet! 🎉</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Adresse</TableHead>
                        <TableHead>PLZ / Ort</TableHead>
                        <TableHead>Modell</TableHead>
                        <TableHead className="text-center">Box</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unshippedUnits.map((unit, idx) => (
                        <TableRow key={`${unit.orderId}-${unit.unitIndex}`}>
                          <TableCell>
                            <div className="font-medium">{unit.shippingName}</div>
                            <div className="text-xs text-muted-foreground">{unit.customerEmail}</div>
                          </TableCell>
                          <TableCell className="text-sm">{unit.address || "—"}</TableCell>
                          <TableCell className="text-sm">{[unit.postalCode, unit.city].filter(Boolean).join(" ") || "—"}</TableCell>
                          <TableCell className="text-sm font-medium">{unit.phoneModel || "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={
                              unit.boxSize === "S" ? "bg-blue-500/15 text-blue-600 border-blue-500/30" :
                              unit.boxSize === "M" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                              unit.boxSize === "L" ? "bg-purple-500/15 text-purple-600 border-purple-500/30" : ""
                            }>
                              {unit.boxSize}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusConfig[unit.orderStatus]?.className || ""}>
                              {statusConfig[unit.orderStatus]?.icon} {statusConfig[unit.orderStatus]?.label || unit.orderStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1.5"
                              onClick={() => {
                                updateStatus.mutate({ id: unit.orderId, status: "shipped" });
                              }}
                            >
                              <Truck className="h-3.5 w-3.5" /> Versendet
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="local" className="space-y-6 mt-4">
          {/* Local Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Abholungen & Lokal offen</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{localUnits.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Abholungen</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{localUnits.filter(u => u.type === "Abholung").length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Lokale Lieferung</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{localUnits.filter(u => u.type === "Lokal").length}</p></CardContent>
            </Card>
          </div>

          {/* Local Queue */}
          <Card>
            <CardContent className="p-0">
              {localUnits.length === 0 ? (
                <div className="py-16 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-success/30 mb-4" />
                  <p className="text-muted-foreground font-medium">Alle abgeholt / zugestellt! 🎉</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Adresse / Ort</TableHead>
                        <TableHead>Modell</TableHead>
                        <TableHead className="text-center">Menge</TableHead>
                        <TableHead className="text-center">Box</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {localUnits.map((unit) => (
                        <TableRow key={`${unit.orderId}-local-${unit.unitIndex}`}>
                          <TableCell>
                            <div className="font-medium">{unit.customerName}</div>
                            <div className="text-xs text-muted-foreground">{unit.customerEmail}</div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {unit.address ? (
                              <div>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([unit.address, unit.postalCode, unit.city, unit.country].filter(Boolean).join(", "))}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {unit.address}
                                </a>
                                <div className="text-xs text-muted-foreground ml-4">{[unit.postalCode, unit.city].filter(Boolean).join(" ")}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{unit.phoneModel || "—"}</TableCell>
                          <TableCell className="text-center font-medium">{unit.qty}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={
                              unit.boxSize === "S" ? "bg-blue-500/15 text-blue-600 border-blue-500/30" :
                              unit.boxSize === "M" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                              unit.boxSize === "L" ? "bg-purple-500/15 text-purple-600 border-purple-500/30" : ""
                            }>
                              {unit.boxSize}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={unit.type === "Abholung" ? "bg-info/15 text-info border-info/30" : "bg-accent text-accent-foreground"}>
                              {unit.type === "Abholung" ? <ShoppingBag className="h-3 w-3 mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                              {unit.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusConfig[unit.orderStatus]?.className || ""}>
                              {statusConfig[unit.orderStatus]?.icon} {statusConfig[unit.orderStatus]?.label || unit.orderStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1.5"
                              onClick={() => {
                                updateStatus.mutate({ id: unit.orderId, status: "delivered" });
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Erledigt
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="space-y-6 mt-4">
          {/* BambuLab Export */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const payload = {
                  timestamp: new Date().toISOString(),
                  total: productionStats.total,
                  sizes: { S: productionStats.S, M: productionStats.M, L: productionStats.L },
                  models: Object.entries(productionStats.byModel).map(([model, { count, boxSize }]) => ({
                    model, count, boxSize,
                  })),
                };
                const json = JSON.stringify(payload, null, 2);
                navigator.clipboard.writeText(json);
                toast({ title: "JSON kopiert", description: "Produktionsdaten in Zwischenablage kopiert — bereit für BambuLab Script." });
              }}
            >
              📋 JSON kopieren
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const payload = {
                  timestamp: new Date().toISOString(),
                  total: productionStats.total,
                  sizes: { S: productionStats.S, M: productionStats.M, L: productionStats.L },
                  models: Object.entries(productionStats.byModel).map(([model, { count, boxSize }]) => ({
                    model, count, boxSize,
                  })),
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `bambulab-queue-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: "JSON exportiert", description: "Datei heruntergeladen für BambuLab Farm Manager." });
              }}
            >
              <Download className="h-4 w-4 mr-1.5" /> JSON Export
            </Button>
          </div>

          {/* Production Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total zu produzieren</CardTitle></CardHeader>
              <CardContent><p className="text-4xl font-bold">{productionStats.total}</p></CardContent>
            </Card>
            <Card className="border-blue-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/30">S</Badge> Small (Mini)</CardTitle></CardHeader>
              <CardContent><p className="text-4xl font-bold text-blue-600">{productionStats.S}</p></CardContent>
            </Card>
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30">M</Badge> Medium (Normal/Pro)</CardTitle></CardHeader>
              <CardContent><p className="text-4xl font-bold text-amber-600">{productionStats.M}</p></CardContent>
            </Card>
            <Card className="border-purple-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Badge variant="outline" className="bg-purple-500/15 text-purple-600 border-purple-500/30">L</Badge> Large (Plus/Max)</CardTitle></CardHeader>
              <CardContent><p className="text-4xl font-bold text-purple-600">{productionStats.L}</p></CardContent>
            </Card>
          </div>

          {/* Breakdown by Model */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aufschlüsselung nach Modell</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modell</TableHead>
                    <TableHead className="text-center">Box-Grösse</TableHead>
                    <TableHead className="text-center">Anzahl</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(productionStats.byModel)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([model, { count, boxSize }]) => (
                      <TableRow key={model}>
                        <TableCell className="font-medium">{model}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={
                            boxSize === "S" ? "bg-blue-500/15 text-blue-600 border-blue-500/30" :
                            boxSize === "M" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                            boxSize === "L" ? "bg-purple-500/15 text-purple-600 border-purple-500/30" : ""
                          }>
                            {boxSize}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold">{count}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                        <Label className="text-xs text-muted-foreground">Betrag (CHF)</Label>
                        <Input type="number" step="0.01" value={((editValues.amount_total || 0) / 100).toFixed(2)} onChange={(e) => setEditValues({ ...editValues, amount_total: Math.round(parseFloat(e.target.value || "0") * 100) })} className="h-8 text-sm" />
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
                      <span className="text-muted-foreground">Box-Grösse</span>
                      <span className="font-medium">{getBoxSize(detailOrder.phone_model)}</span>
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
