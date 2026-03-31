import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Save, Package, Box } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STOCK_ITEMS = ["Baseplate", "Insert S", "Insert M", "Insert L"];

const StockPlanning = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock_planning"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .in("name", STOCK_ITEMS)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateStock = useMutation({
    mutationFn: async ({ id, current_stock }: { id: string; current_stock: number }) => {
      const { error } = await supabase
        .from("inventory_items")
        .update({ current_stock })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_planning"] });
      setEditingId(null);
      toast({ title: "Bestand aktualisiert" });
    },
  });

  const adjustStock = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const newStock = Math.max(0, item.current_stock + delta);
      const { error } = await supabase
        .from("inventory_items")
        .update({ current_stock: newStock })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_planning"] });
    },
  });

  const getIcon = (name: string) => {
    if (name === "Baseplate") return <Package className="h-5 w-5" />;
    return <Box className="h-5 w-5" />;
  };

  const getLabel = (name: string) => {
    switch (name) {
      case "Baseplate": return "Baseplate";
      case "Insert S": return "Grösse S";
      case "Insert M": return "Grösse M";
      case "Insert L": return "Grösse L";
      default: return name;
    }
  };

  const totalStock = items.reduce((sum, i) => sum + i.current_stock, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lagerbestandsplanung</h1>
        <p className="text-muted-foreground mt-1">Baseplates & Inserts verwalten</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-20 animate-pulse bg-muted rounded" />
                </CardContent>
              </Card>
            ))
          : items.map((item) => {
              const isEditing = editingId === item.id;
              const isLow = item.current_stock < item.reorder_threshold;

              return (
                <Card key={item.id} className="relative overflow-hidden">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {getIcon(item.name)}
                      <CardTitle className="text-sm font-medium">{getLabel(item.name)}</CardTitle>
                    </div>
                    {isLow && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Low</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(Number(e.target.value))}
                          className="w-20 text-center text-2xl font-bold h-10"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") updateStock.mutate({ id: item.id, current_stock: editValue });
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => updateStock.mutate({ id: item.id, current_stock: editValue })}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <button
                          className="text-4xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditValue(item.current_stock);
                          }}
                        >
                          {item.current_stock}
                        </button>
                        <div className="flex flex-col gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => adjustStock.mutate({ id: item.id, delta: 1 })}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => adjustStock.mutate({ id: item.id, delta: -1 })}
                            disabled={item.current_stock <= 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Teile am Lager</span>
          <span className="text-2xl font-bold">{totalStock}</span>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockPlanning;
