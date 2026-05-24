"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertCircle, CheckCircle, ShieldCheck } from "lucide-react";

export default function CheckoutPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [reservation, setReservation] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReservation = async () => {
      const res = await fetch(`/api/reservations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setReservation(data);
        const expiresTime = new Date(data.expiresAt).getTime();
        const now = new Date().getTime();
        setTimeLeft(Math.max(Math.floor((expiresTime - now) / 1000), 0));
      } else {
        toast({ variant: "destructive", title: "Reservation not found." });
        router.push("/");
      }
    };
    fetchReservation();
  }, [id, router, toast]);

  useEffect(() => {
    if (!reservation || reservation.status !== "PENDING" || timeLeft <= 0) return;
    const interval = setInterval(() => {
      const expiresTime = new Date(reservation.expiresAt).getTime();
      const now = new Date().getTime();
      const secondsLeft = Math.floor((expiresTime - now) / 1000);
      setTimeLeft(Math.max(secondsLeft, 0));
      if (secondsLeft <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [reservation, timeLeft]);

  const handleAction = async (action: "confirm" | "release") => {
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`/api/reservations/${id}/${action}`, { 
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey }
      });
      const data = await res.json();

      if (res.status === 410) {
        toast({ variant: "destructive", title: "Reservation Expired", description: "Your hold on this item has expired." });
        setReservation({ ...reservation, status: "RELEASED" });
      } else if (res.ok) {
        toast({
          title: action === "confirm" ? "Payment Successful" : "Reservation Cancelled",
          description: action === "confirm" ? "Your order is confirmed." : "Stock has been released.",
        });
        router.push("/");
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!reservation) return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
      <div className="text-[#86868b] font-medium animate-pulse">Loading your secure checkout...</div>
    </div>
  );

  const isExpired = timeLeft <= 0;
  const isPending = reservation.status === "PENDING";
  const totalPrice = (reservation.product?.price * reservation.quantity).toFixed(2);

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans pt-12 pb-24 px-6 selection:bg-[#0071e3] selection:text-white">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight mb-2">Checkout</h1>
          <p className="text-[#86868b] flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Secure encrypted connection
          </p>
        </div>

        {/* Main Content Box */}
        <div className="bg-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
          
          {/* Order Summary */}
          <div className="p-8 md:p-10 border-b border-[#f5f5f7]">
            <h2 className="text-lg font-semibold mb-6">Order Summary</h2>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-xl tracking-tight">{reservation.product?.name}</p>
                <p className="text-[#86868b] mt-1">Quantity: {reservation.quantity}</p>
                <p className="text-[#86868b] text-sm mt-1">Shipping from {reservation.warehouse?.name}</p>
              </div>
              <p className="font-semibold text-xl">${reservation.product?.price.toFixed(2)}</p>
            </div>
          </div>

          {/* Total Row */}
          <div className="p-8 md:p-10 bg-[#fbfbfd]">
            <div className="flex justify-between items-center mb-8">
              <p className="text-2xl font-semibold">Total</p>
              <p className="text-4xl font-bold tracking-tight">${totalPrice}</p>
            </div>

            {/* Timer / Status Banner */}
            {isPending && !isExpired ? (
              <div className="flex items-center justify-between bg-[#fff8e6] text-[#8a6300] p-4 rounded-[16px] mb-8">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 animate-pulse" />
                  <div>
                    <p className="font-semibold text-sm">Items reserved</p>
                    <p className="text-xs opacity-80">Complete checkout soon</p>
                  </div>
                </div>
                <p className="font-mono font-medium text-lg tracking-tight">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                </p>
              </div>
            ) : isPending && isExpired ? (
              <div className="flex items-center gap-3 bg-[#fff0f0] text-[#cc0000] p-4 rounded-[16px] mb-8">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="font-semibold text-sm">Reservation Expired</p>
                  <p className="text-xs opacity-80">Please return to the store.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-[#e8f6ea] text-[#00801c] p-4 rounded-[16px] mb-8">
                <CheckCircle className="w-5 h-5" />
                <div>
                  <p className="font-semibold text-sm">Order {reservation.status.toLowerCase()}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-4">
              <button 
                className="w-full bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-lg py-4 rounded-[14px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handleAction("confirm")}
                disabled={!isPending || isExpired || loading}
              >
                {loading ? "Processing..." : "Pay with Apple Pay"}
              </button>
              
              <button 
                className="w-full bg-transparent text-[#0071e3] font-medium py-3 rounded-[14px] hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                onClick={() => handleAction("release")}
                disabled={!isPending || loading}
              >
                Cancel Order
              </button>
            </div>

          </div>
        </div>
        
        {/* Footer info */}
        <p className="text-center text-[#86868b] text-xs mt-8 px-4">
          Need help? Chat with a Specialist or call 1-800-MY-ALLO.<br/>
          Free delivery and free returns.
        </p>
      </div>
    </div>
  );
}
