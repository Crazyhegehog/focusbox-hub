import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Plus, Minus, Pencil, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const InventoryTracking = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<number>(0);
  const [editThreshold, setEditThreshold] = useState<number>(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStock, setNewStock] = useState(0);
  const [newThreshold, setNewThreshold] = useState(10);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders_pending_count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id").neq("status", "sent");
      if (error) throw error;
      return data;
    },
  });

  const pendingOrderCount = orders.length;

  const updateItem = useMutation({
    mutationFn: async ({ id, current_stock, reorder_threshold }: { id: string; current_stock: number; reorder_threshold: number }) => {
      const { error } = await supabase.from("inventory_items").update({ current_stock, reorder_threshold }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      setEditingId(null);
      toast({ title: "Lagerbestand aktualisiert" });
    },
  });

  const adjustStock = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const newStock = Math.max(0, item.current_stock + delta);
      const { error } = await supabase.from("inventory_items").update({ current_stock: newStock }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
    },
  });

  const createItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory_items").insert({ name: newName, current_stock: newStock, reorder_threshold: newThreshold });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      setAddDialogOpen(false);
      setNewName("");
      setNewStock(0);
      setNewThreshold(10);
      toast({ title: "Komponente hinzugefügt" });
    },
  });

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditStock(item.current_stock);
    setEditThreshold(item.reorder_threshold);
  };

  const lowStockCount = items.filter((i) => i.current_stock < i.reorder_threshold).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lagerbestand</h1>
          <p className="text-muted-foreground font-body mt-1">Komponenten verwalten und Bestand tracken</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Komponente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neue Komponente</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Bestand</label>
                  <Input type="number" value={newStock} onChange={(e) => setNewStock(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Min. Bestand</label>
                  <Input type="number" value={newThreshold} onChange={(e) => setNewThreshold(Number(e.target.value))} />
                </div>
              </div>
              <Button className="w-full" onClick={() => createItem.mutate()} disabled={!newName}>Hinzufügen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Komponenten</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{items.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Offene Bestellungen</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{pendingOrderCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Niedrig</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-warning">{lowStockCount}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Laden...</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Keine Komponenten vorhanden</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Komponente</TableHead>
                  <TableHead className="text-center">Bestand</TableHead>
                  <TableHead className="text-center">Min. Bestand</TableHead>
                  <TableHead className="text-center">Benötigt (×{pendingOrderCount})</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const needed = pendingOrderCount;
                  const sufficient = item.current_stock >= needed;
                  const isEditing = editingId === item.id;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editStock}
                            onChange={(e) => setEditStock(Number(e.target.value))}
                            className="w-20 mx-auto text-center"
                          />
                        ) : (
                          <span className="font-semibold">{item.current_stock}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editThreshold}
                            onChange={(e) => setEditThreshold(Number(e.target.value))}
                            className="w-20 mx-auto text-center"
                          />
                        ) : (
                          item.reorder_threshold
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold">{needed}</TableCell>
                      <TableCell className="text-center">
                        {sufficient ? (
                          <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Low
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                            <Button size="sm" onClick={() => updateItem.mutate({ id: item.id, current_stock: editStock, reorder_threshold: editThreshold })}>
                              <Save className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => adjustStock.mutate({ id: item.id, delta: -1 })}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => adjustStock.mutate({ id: item.id, delta: 1 })}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryTracking;
