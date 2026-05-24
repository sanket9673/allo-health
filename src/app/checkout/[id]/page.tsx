"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Clock, AlertCircle, CircleCheck } from "lucide-react";

export default function CheckoutPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [reservation, setReservation] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Fetch the reservation on load
  useEffect(() => {
    const fetchReservation = async () => {
      const res = await fetch(`/api/reservations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setReservation(data);
        
        // Calculate initial timeLeft
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

  // Live Timer Countdown
  useEffect(() => {
    if (!reservation || reservation.status !== "PENDING" || timeLeft <= 0) return;

    const interval = setInterval(() => {
      const expiresTime = new Date(reservation.expiresAt).getTime();
      const now = new Date().getTime();
      const secondsLeft = Math.floor((expiresTime - now) / 1000);
      
      setTimeLeft(Math.max(secondsLeft, 0));
      
      if (secondsLeft <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation, timeLeft]);

  // Action Handlers
  const handleAction = async (action: "confirm" | "release") => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (action === "confirm") {
        headers["Idempotency-Key"] = crypto.randomUUID();
      }
      const res = await fetch(`/api/reservations/${id}/${action}`, { method: "POST", headers });
      const data = await res.json();

      if (res.status === 410) {
        toast({
          variant: "destructive",
          title: "Reservation Expired",
          description: "Your hold on this item has expired.",
        });
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

  if (!reservation) return <div className="p-8 text-center">Loading...</div>;

  const isExpired = timeLeft <= 0;
  const isPending = reservation.status === "PENDING";

  return (
    <div className="max-w-md mx-auto mt-12 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Checkout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-slate-100 p-4 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-semibold">{reservation.product?.name}</p>
              <p className="text-sm text-slate-500">Qty: {reservation.quantity}</p>
            </div>
            <p className="font-bold">${reservation.product?.price}</p>
          </div>

          {isPending && !isExpired ? (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
              <Clock className="w-5 h-5 animate-pulse" />
              <p className="font-mono font-bold text-lg">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
              </p>
              <p className="text-sm ml-2">Time remaining to complete payment</p>
            </div>
          ) : isPending && isExpired ? (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">Reservation Expired</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
              <CircleCheck className="w-5 h-5" />
              <p className="font-semibold">Order {reservation.status.toLowerCase()}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-4">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => handleAction("release")}
            disabled={!isPending || loading}
          >
            Cancel
          </Button>
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700" 
            onClick={() => handleAction("confirm")}
            disabled={!isPending || isExpired || loading}
          >
            {loading ? "Processing..." : "Pay Now"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
