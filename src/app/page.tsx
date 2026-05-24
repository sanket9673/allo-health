"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Package, MapPin, ShoppingCart, Flame } from "lucide-react";

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
  
  // State to track selected quantity for each product-warehouse combo
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
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

  const getQty = (productId: string, warehouseId: string) => {
    return quantities[`${productId}-${warehouseId}`] || 1;
  };

  const updateQty = (productId: string, warehouseId: string, delta: number, max: number) => {
    const key = `${productId}-${warehouseId}`;
    const current = getQty(productId, warehouseId);
    const next = Math.min(Math.max(1, current + delta), max);
    setQuantities((prev) => ({ ...prev, [key]: next }));
  };

  const handleReserve = async (productId: string, warehouseId: string) => {
    setLoadingId(`${productId}-${warehouseId}`);
    const quantity = getQty(productId, warehouseId);

    try {
      const idempotencyKey = crypto.randomUUID();

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        // Send the dynamically selected quantity!
        body: JSON.stringify({ productId, warehouseId, quantity }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast({
          variant: "destructive",
          title: "Reservation Failed",
          description: data.error || "Not enough stock available.",
        });
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Premium Header */}
      <div className="bg-slate-900 text-white -mx-8 -mt-8 p-8 pb-12 mb-8 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-blue-400" />
              Allo Commerce
            </h1>
            <p className="text-slate-400 mt-2">Fast, reliable fulfillment & reservations.</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="flex flex-col border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex justify-between items-start">
                <span className="text-lg font-bold text-slate-800">{product.name}</span>
                <span className="text-lg font-semibold text-blue-600">${product.price.toFixed(2)}</span>
              </CardTitle>
              <p className="text-xs text-slate-400 font-mono mt-1">SKU: {product.sku}</p>
            </CardHeader>

            <CardContent className="flex-1 space-y-4 pt-4">
              <p className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                <Package className="w-4 h-4 text-slate-400" /> Availability by Hub
              </p>
              
              <div className="space-y-3">
                {product.stocks.map((stock) => {
                  const qty = getQty(product.id, stock.warehouseId);
                  const isLowStock = stock.availableQuantity > 0 && stock.availableQuantity <= 5;
                  const isOutOfStock = stock.availableQuantity === 0;

                  return (
                    <div key={stock.warehouseId} className="flex flex-col gap-2 border rounded-lg p-3 bg-white">
                      <div className="flex justify-between items-start">
                        <div className="text-sm">
                          <p className="font-medium flex items-center gap-1.5 text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-blue-500" /> {stock.warehouse.name}
                          </p>
                          {isOutOfStock ? (
                            <p className="text-xs font-semibold text-red-500 mt-0.5">Out of stock</p>
                          ) : isLowStock ? (
                            <p className="text-xs font-semibold text-amber-600 flex items-center gap-1 mt-0.5">
                              <Flame className="w-3 h-3" /> Only {stock.availableQuantity} left!
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500 mt-0.5">{stock.availableQuantity} units available</p>
                          )}
                        </div>
                      </div>

                      {!isOutOfStock && (
                        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
                          {/* Custom Quantity Stepper */}
                          <div className="flex items-center border rounded-md bg-slate-50">
                            <button 
                              className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-l-md disabled:opacity-30"
                              disabled={qty <= 1}
                              onClick={() => updateQty(product.id, stock.warehouseId, -1, stock.availableQuantity)}
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{qty}</span>
                            <button 
                              className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-r-md disabled:opacity-30"
                              disabled={qty >= stock.availableQuantity}
                              onClick={() => updateQty(product.id, stock.warehouseId, 1, stock.availableQuantity)}
                            >
                              +
                            </button>
                          </div>

                          <Button 
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                            disabled={loadingId === `${product.id}-${stock.warehouseId}`}
                            onClick={() => handleReserve(product.id, stock.warehouseId)}
                          >
                            {loadingId === `${product.id}-${stock.warehouseId}` ? "Processing..." : "Reserve"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
