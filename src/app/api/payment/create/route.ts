import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { snap } from "@/lib/midtrans";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemName, itemPrice, inputAmount } = body;

    if (!itemName || !itemPrice || itemPrice <= 0) {
      return NextResponse.json(
        { error: "itemName dan itemPrice wajib diisi" },
        { status: 400 }
      );
    }

    // Core business logic: ≥1jt locked, <1jt flexible
    let amountExpected: number;
    if (itemPrice >= 1000000) {
      amountExpected = itemPrice;
    } else {
      if (!inputAmount || inputAmount <= 0) {
        return NextResponse.json(
          { error: "Nominal wajib diisi untuk barang di bawah 1 juta" },
          { status: 400 }
        );
      }
      amountExpected = inputAmount;
    }

    const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expiryMinutes = 15;
    const expiryAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Create Midtrans transaction
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amountExpected,
      },
      payment_type: "qris",
    };

    const midtransRes = await snap.createTransaction(parameter);
    const qrUrl = midtransRes.redirect_url;

    // Save order to DB
    const order = await db.order.create({
      data: {
        id: orderId,
        itemName,
        itemPrice,
        amountExpected,
        status: "pending",
        qrUrl,
        expiryAt,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amountExpected,
      qrUrl,
      expiryAt,
    });
  } catch (error: any) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membuat pembayaran" },
      { status: 500 }
    );
  }
}