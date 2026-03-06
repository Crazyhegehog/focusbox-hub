import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus, Package, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Inventory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [stock, setStock] = useState("0");
  const [threshold, setThreshold] = useState("10");
  const [unitCost, setUnitCost] = useState("0");
  const [location, setLocation] = useState("");
  const [supplierName, setSupplierName] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory_items").insert({
        name,
        current_stock: parseInt(stock),
        reorder_threshold: parseInt(threshold),
        unit_cost: parseFloat(unitCost),
        storage_location: location,
        supplier_name: supplierName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Item added" });
      setName(""); setStock("0"); setThreshold("10"); setUnitCost("0"); setLocation(""); setSupplierName("");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const adjustStock = useMutation({
    mutationFn: async ({ id, amount, currentStock }: { id: string; amount: number; currentStock: number }) => {
      const newStock = currentStock + amount;
      if (newStock < 0) throw new Error("Stock cannot go below zero");
      const { error: updateErr } = await supabase
        .from("inventory_items")
        .update({ current_stock: newStock })
        .eq("id", id);
      if (updateErr) throw updateErr;
      const { error: histErr } = await supabase.from("inventory_history").insert({
        inventory_item_id: id,
        change_amount: amount,
        reason: amount > 0 ? "Manual increment" : "Manual decrement",
        changed_by: user!.id,
      });
      if (histErr) throw histErr;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const lowStockCount = items.filter((i) => i.current_stock <= i.reorder_threshold).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground font-body mt-1">
            Track components and materials
            {lowStockCount > 0 && (
              <Badge variant="outline" className="ml-2 bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {lowStockCount} low stock
              </Badge>
            )}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Inventory Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createItem.mutate(); }} className="space-y-3">
              <Input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} required className="font-body" />
              <div className="grid grid-cols-3 gap-3">
                <Input type="number" placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} className="font-body" />
                <Input type="number" placeholder="Reorder at" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="font-body" />
                <Input type="number" step="0.01" placeholder="Unit cost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="font-body" />
              </div>
              <Input placeholder="Storage location" value={location} onChange={(e) => setLocation(e.target.value)} className="font-body" />
              <Input placeholder="Supplier name" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="font-body" />
              <Button type="submit" className="w-full" disabled={createItem.isPending}>
                {createItem.isPending ? "Adding..." : "Add Item"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground font-body">Loading inventory...</p>
      ) : items.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-body">No inventory items yet. Add your first component.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="text-center">Threshold</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isLow = item.current_stock <= item.reorder_threshold;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{item.name}</span>
                        {item.supplier_name && (
                          <p className="text-xs text-muted-foreground font-body">{item.supplier_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-mono font-medium ${isLow ? "text-destructive" : ""}`}>
                        {item.current_stock}
                      </span>
                      {isLow && <AlertTriangle className="inline ml-1 h-3 w-3 text-destructive" />}
                    </TableCell>
                    <TableCell className="text-center font-mono text-muted-foreground">
                      {item.reorder_threshold}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      CHF {Number(item.unit_cost ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-body">
                      {item.storage_location || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => adjustStock.mutate({ id: item.id, amount: -1, currentStock: item.current_stock })}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => adjustStock.mutate({ id: item.id, amount: 1, currentStock: item.current_stock })}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default Inventory;
