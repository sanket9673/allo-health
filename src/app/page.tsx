"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Package, MapPin } from "lucide-react";

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stocks: {
    warehouseId: string;
    availableQuantity: number;
    warehouse: { name: string; location: string };
  }[];
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const fetchProducts = async () => {
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleReserve = async (productId: string, warehouseId: string) => {
    setLoadingId(`${productId}-${warehouseId}`);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast({
          variant: "destructive",
          title: "Reservation Failed",
          description: data.error || "Not enough stock available.",
        });
        // Refresh products to show updated stock
        fetchProducts(); 
      } else if (res.ok) {
        router.push(`/checkout/${data.id}`);
      } else {
        throw new Error("Something went wrong");
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to reserve." });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Allo Store</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <span>{product.name}</span>
                <span className="text-lg font-normal text-slate-500">${product.price}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" /> Available Stock:
              </p>
              {product.stocks.map((stock) => (
                <div key={stock.warehouseId} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="text-sm">
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {stock.warehouse.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{stock.availableQuantity} units left</p>
                  </div>
                  <Button 
                    size="sm"
                    disabled={stock.availableQuantity === 0 || loadingId === `${product.id}-${stock.warehouseId}`}
                    onClick={() => handleReserve(product.id, stock.warehouseId)}
                  >
                    {loadingId === `${product.id}-${stock.warehouseId}` ? "Reserving..." : "Reserve 1"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
