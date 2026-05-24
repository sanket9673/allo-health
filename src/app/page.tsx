"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Package, MapPin, ShoppingBag } from "lucide-react";

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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans selection:bg-[#0071e3] selection:text-white pb-24">
      {/* Apple-style Global Header */}
      <nav className="w-full h-12 bg-white/80 backdrop-blur-md border-b border-[#d2d2d7] sticky top-0 z-50 flex items-center px-4 md:px-8">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-lg">
            <ShoppingBag className="w-5 h-5" />
            <span>Allo Store</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 md:px-8 pt-16">
        {/* Apple-style Large Typography Header */}
        <div className="mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f]">
            Store. <span className="text-[#86868b]">The best way to buy the products you love.</span>
          </h1>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden transition-transform duration-300 hover:scale-[1.01] flex flex-col">
              
              {/* Product Header */}
              <div className="p-8 pb-6 border-b border-[#f5f5f7]">
                <h2 className="text-2xl font-semibold tracking-tight">{product.name}</h2>
                <p className="text-lg text-[#1d1d1f] mt-2 font-medium">${product.price.toFixed(2)}</p>
                <p className="text-xs text-[#86868b] font-mono mt-1">SKU: {product.sku}</p>
              </div>

              {/* Warehouses & Stock */}
              <div className="p-8 pt-6 flex-1 bg-[#fbfbfd]">
                <h3 className="text-xs font-bold text-[#86868b] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Availability
                </h3>
                
                <div className="space-y-6">
                  {product.stocks.map((stock) => {
                    const qty = getQty(product.id, stock.warehouseId);
                    const isLowStock = stock.availableQuantity > 0 && stock.availableQuantity <= 5;
                    const isOutOfStock = stock.availableQuantity === 0;

                    return (
                      <div key={stock.warehouseId} className="flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-[#1d1d1f] flex items-center gap-1.5 text-sm">
                              <MapPin className="w-4 h-4 text-[#86868b]" /> {stock.warehouse.name}
                            </p>
                            {isOutOfStock ? (
                              <p className="text-xs font-medium text-red-500 mt-1">Currently unavailable.</p>
                            ) : isLowStock ? (
                              <p className="text-xs font-medium text-[#bf4800] mt-1">
                                Hurry. Only {stock.availableQuantity} left.
                              </p>
                            ) : (
                              <p className="text-xs text-[#86868b] mt-1">In Stock</p>
                            )}
                          </div>
                        </div>

                        {!isOutOfStock && (
                          <div className="flex items-center justify-between pt-1">
                            {/* Apple-style Stepper */}
                            <div className="flex items-center bg-[#e8e8ed] rounded-full px-1">
                              <button 
                                className="w-8 h-8 flex items-center justify-center text-[#1d1d1f] hover:bg-[#d2d2d7] rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent text-lg"
                                disabled={qty <= 1}
                                onClick={() => updateQty(product.id, stock.warehouseId, -1, stock.availableQuantity)}
                              >
                                −
                              </button>
                              <span className="w-8 text-center text-sm font-semibold text-[#1d1d1f]">{qty}</span>
                              <button 
                                className="w-8 h-8 flex items-center justify-center text-[#1d1d1f] hover:bg-[#d2d2d7] rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent text-lg"
                                disabled={qty >= stock.availableQuantity}
                                onClick={() => updateQty(product.id, stock.warehouseId, 1, stock.availableQuantity)}
                              >
                                +
                              </button>
                            </div>

                            {/* Apple-style Primary Button */}
                            <button 
                              className="bg-[#0071e3] hover:bg-[#0077ed] text-white text-sm font-semibold py-2 px-5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={loadingId === `${product.id}-${stock.warehouseId}`}
                              onClick={() => handleReserve(product.id, stock.warehouseId)}
                            >
                              {loadingId === `${product.id}-${stock.warehouseId}` ? "Processing..." : "Reserve"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
