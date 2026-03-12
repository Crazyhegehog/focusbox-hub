import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PartnerTypes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [city, setCity] = useState("");
  const [partnerType, setPartnerType] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["partner-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_types")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("partner_types").insert({
        city: city.trim(),
        partner_type: partnerType.trim(),
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-types"] });
      setCity("");
      setPartnerType("");
      toast({ title: "Entry added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partner-types"] }),
  });

  const cities = [...new Set(entries.map((e) => e.city))].sort();
  const filtered = cityFilter === "all" ? entries : entries.filter((e) => e.city === cityFilter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !partnerType.trim()) return;
    addEntry.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Partner Types</h1>
        <p className="text-muted-foreground text-sm">Manage partner types by city</p>
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">City</label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Berlin" className="w-48" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Partner Type</label>
          <Input value={partnerType} onChange={(e) => setPartnerType(e.target.value)} placeholder="e.g. Restaurant" className="w-48" />
        </div>
        <Button type="submit" disabled={!city.trim() || !partnerType.trim() || addEntry.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </form>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by city" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cityFilter !== "all" && (
          <Badge variant="secondary">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>City</TableHead>
              <TableHead>Partner Type</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No entries yet
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.city}</TableCell>
                  <TableCell>{entry.partner_type}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteEntry.mutate(entry.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default PartnerTypes;
