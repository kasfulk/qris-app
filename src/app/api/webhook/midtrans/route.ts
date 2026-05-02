import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySignature, coreApi } from "@/lib/midtrans";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      order_id,
      transaction_status,
      fraud_status,
      status_code,
      gross_amount,
      signature_key,
      payment_type,
    } = body;

    // Verify signature
    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const isValid = verifySignature(
      order_id,
      status_code,
      gross_amount,
      serverKey,
      signature_key
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // Find order
    const order = await db.order.findUnique({ where: { id: order_id } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Idempotent: skip if already processed
    if (order.status !== "pending") {
      return NextResponse.json({ message: "Already processed" });
    }

    // Check if QR expired
    if (order.expiryAt && new Date() > order.expiryAt) {
      await db.order.update({
        where: { id: order_id },
        data: { status: "expired" },
      });
      return NextResponse.json({ message: "QR expired" });
    }

    // Only process settlement/capture for successful payment
    if (
      transaction_status === "settlement" ||
      transaction_status === "capture"
    ) {
      const paidAmount = parseInt(gross_amount, 10);
      const expected = order.amountExpected;

      // Save payment record
      await db.payment.create({
        data: {
          orderId: order_id,
          amount: paidAmount,
          raw: body,
        },
      });

      // Compare with tolerance of Rp 1.000
      if (Math.abs(paidAmount - expected) <= 1000) {
        await db.order.update({
          where: { id: order_id },
          data: { status: "paid", amountPaid: paidAmount },
        });
      } else {
        // Mismatch detected
        await db.order.update({
          where: { id: order_id },
          data: { status: "mismatch", amountPaid: paidAmount },
        });

        // Auto-refund
        try {
          const refundRes = await (coreApi as any).transaction.refund(order_id, {
            amount: paidAmount,
            reason: "Nominal tidak sesuai",
          });
          await db.refund.create({
            data: {
              orderId: order_id,
              amount: paidAmount,
              status:
                refundRes.refund_key || refundRes.status
                  ? "success"
                  : "failed",
            },
          });
          if (refundRes.refund_key || refundRes.status) {
            await db.order.update({
              where: { id: order_id },
              data: { status: "refunded" },
            });
          }
        } catch (refundErr) {
          console.error("Refund failed:", refundErr);
          await db.refund.create({
            data: {
              orderId: order_id,
              amount: paidAmount,
              status: "failed",
            },
          });
        }
      }
    } else if (
      transaction_status === "expire" ||
      transaction_status === "cancel" ||
      transaction_status === "deny"
    ) {
      await db.order.update({
        where: { id: order_id },
        data: { status: transaction_status },
      });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook error" },
      { status: 500 }
    );
  }
}