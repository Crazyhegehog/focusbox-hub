import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, AlertTriangle, CheckCircle2 } from "lucide-react";

// Design-only mock data — no backend wiring
const BOX_COMPONENTS = [
  { name: "Karton Box", perUnit: 1, inStock: 48, icon: "📦" },
  { name: "Base Plate", perUnit: 1, inStock: 52, icon: "🔲" },
  { name: "NFC Chip", perUnit: 1, inStock: 35, icon: "📡" },
  { name: "Info Paper", perUnit: 1, inStock: 60, icon: "📄" },
  { name: "Sticker Sheet", perUnit: 1, inStock: 44, icon: "🏷️" },
  { name: "Phone Case", perUnit: 1, inStock: 29, icon: "📱" },
];

const PACKAGED_ORDERS = 23; // mock: orders marked as packaged

const InventoryTracking = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory Tracking</h1>
        <p className="text-muted-foreground font-body mt-1">Component requirements per box — design preview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Packaged Orders</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{PACKAGED_ORDERS}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Components Low</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-warning">
              {BOX_COMPONENTS.filter((c) => c.inStock < PACKAGED_ORDERS * c.perUnit).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Box Component Requirements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead className="text-center">Per Box</TableHead>
                <TableHead className="text-center">Needed (× {PACKAGED_ORDERS})</TableHead>
                <TableHead className="text-center">In Stock</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BOX_COMPONENTS.map((comp) => {
                const needed = PACKAGED_ORDERS * comp.perUnit;
                const sufficient = comp.inStock >= needed;
                return (
                  <TableRow key={comp.name}>
                    <TableCell className="font-medium">
                      <span className="mr-2">{comp.icon}</span>
                      {comp.name}
                    </TableCell>
                    <TableCell className="text-center">{comp.perUnit}</TableCell>
                    <TableCell className="text-center font-semibold">{needed}</TableCell>
                    <TableCell className="text-center">{comp.inStock}</TableCell>
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center italic">
        This is a design preview. Inventory tracking will be wired to live order data in a future update.
      </p>
    </div>
  );
};

export default InventoryTracking;
