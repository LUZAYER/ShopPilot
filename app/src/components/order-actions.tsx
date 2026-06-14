"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Truck, CheckCircle, Loader2 } from "lucide-react";

export function OrderActions({
  orderId,
  status,
  paymentStatus
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");

  async function patch(body: any) {
    const r = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (r.ok) router.refresh();
  }

  return (
    <div className="flex gap-2">
      {paymentStatus === "UNPAID" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy === "pay"}
          onClick={async () => { setBusy("pay"); await patch({ paymentStatus: "PAID" }); setBusy(""); }}
        >
          {busy === "pay" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Mark paid
        </Button>
      )}
      {status === "PENDING" && (
        <Button size="sm" disabled={busy === "confirm"} onClick={async () => { setBusy("confirm"); await patch({ status: "CONFIRMED" }); setBusy(""); }}>
          Confirm
        </Button>
      )}
      {(status === "CONFIRMED" || status === "PACKED") && (
        <Button size="sm" disabled={busy === "dispatch"} onClick={async () => { setBusy("dispatch"); await patch({ status: "SHIPPED", dispatch: true }); setBusy(""); }}>
          {busy === "dispatch" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
          Dispatch
        </Button>
      )}
      {status !== "DELIVERED" && status !== "CANCELLED" && (
        <Button size="sm" variant="outline" disabled={busy === "cancel"} onClick={async () => { setBusy("cancel"); await patch({ status: "CANCELLED" }); setBusy(""); }}>
          Cancel
        </Button>
      )}
    </div>
  );
}
