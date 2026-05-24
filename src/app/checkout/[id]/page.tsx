"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Clock, AlertCircle, CircleCheck, CreditCard, ShieldCheck } from "lucide-react";

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
          title: action === "confirm" ? "Payment Successful!" : "Reservation Cancelled",
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

  if (!reservation) return <div className="p-12 text-center text-slate-500 animate-pulse">Loading secure checkout...</div>;

  const isExpired = timeLeft <= 0;
  const isPending = reservation.status === "PENDING";
  // Calculate total price!
  const totalPrice = (reservation.product?.price * reservation.quantity).toFixed(2);

  return (
    <div className="max-w-md mx-auto mt-12 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <ShieldCheck className="w-6 h-6 text-green-600" /> Secure Checkout
        </h1>
        <p className="text-slate-500 text-sm">Review your order details and complete payment.</p>
      </div>

      <Card className="border-slate-200 shadow-md">
        <CardContent className="space-y-6 pt-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800 text-lg">{reservation.product?.name}</p>
              <p className="text-sm text-slate-500 mt-1">
                Qty: {reservation.quantity} × ${reservation.product?.price.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                Shipping from: {reservation.warehouse?.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500 mb-1">Total</p>
              <p className="font-black text-2xl text-blue-600">${totalPrice}</p>
            </div>
          </div>

          {isPending && !isExpired ? (
            <div className="flex items-center justify-between bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 animate-pulse text-amber-600" />
                <div>
                  <p className="font-semibold text-sm">Items are reserved</p>
                  <p className="text-xs opacity-80">Complete payment before timer ends</p>
                </div>
              </div>
              <p className="font-mono font-bold text-xl bg-white px-3 py-1 rounded-lg border border-amber-100 shadow-sm">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
              </p>
            </div>
          ) : isPending && isExpired ? (
            <div className="flex items-center gap-3 text-red-700 bg-red-50 p-4 rounded-xl border border-red-200">
              <AlertCircle className="w-6 h-6" />
              <div>
                <p className="font-bold">Reservation Expired</p>
                <p className="text-sm opacity-90">Please return to store to try again.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-green-700 bg-green-50 p-4 rounded-xl border border-green-200">
              <CircleCheck className="w-6 h-6" />
              <div>
                <p className="font-bold">Order {reservation.status.toLowerCase()}</p>
                <p className="text-sm opacity-90">Redirecting to store...</p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-3 pb-6 px-6">
          <Button 
            variant="outline" 
            className="w-1/3 border-slate-300 text-slate-700 hover:bg-slate-50" 
            onClick={() => handleAction("release")}
            disabled={!isPending || loading}
          >
            Cancel
          </Button>
          <Button 
            className="w-2/3 bg-blue-600 hover:bg-blue-700 shadow-md font-semibold text-white flex gap-2" 
            onClick={() => handleAction("confirm")}
            disabled={!isPending || isExpired || loading}
          >
            <CreditCard className="w-4 h-4" />
            {loading ? "Processing..." : `Pay $${totalPrice}`}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
