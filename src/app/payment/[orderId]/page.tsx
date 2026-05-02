"use client";

import { useEffect, useState, use } from "react";
import { QRCodeSVG } from "qrcode.react";

type OrderData = {
  id: string;
  itemName: string;
  itemPrice: number;
  amountExpected: number;
  amountPaid: number | null;
  status: string;
  qrUrl: string | null;
  expiryAt: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Menunggu Pembayaran", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-300" },
  paid:     { label: "Pembayaran Berhasil",  color: "text-green-700",  bg: "bg-green-50 border-green-300" },
  mismatch: { label: "Nominal Tidak Sesuai", color: "text-orange-700", bg: "bg-orange-50 border-orange-300" },
  refunded: { label: "Sudah Dikembalikan",  color: "text-blue-700",   bg: "bg-blue-50 border-blue-300" },
  expired:  { label: "QR Kadaluarsa",        color: "text-red-700",    bg: "bg-red-50 border-red-300" },
  cancel:   { label: "Dibatalkan",           color: "text-gray-700",   bg: "bg-gray-50 border-gray-300" },
  deny:     { label: "Ditolak",              color: "text-red-700",    bg: "bg-red-50 border-red-300" },
};

export default function PaymentPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/order/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, [orderId]);

  // Countdown timer
  useEffect(() => {
    if (!order?.expiryAt) return;
    const tick = () => {
      const diff = new Date(order.expiryAt!).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("00:00");
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [order?.expiryAt]);

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Memuat data pembayaran...</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-500">Order tidak ditemukan</p>
      </main>
    );
  }

  const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const isPending = order.status === "pending";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Status Badge */}
        <div className={`border rounded-lg px-4 py-2 text-center font-semibold mb-6 ${statusInfo.bg} ${statusInfo.color}`}>
          {statusInfo.label}
        </div>

        {/* Order Info */}
        <div className="space-y-3 mb-6 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Order ID</span>
            <span className="font-mono text-xs">{order.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Barang</span>
            <span className="font-medium">{order.itemName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Harga</span>
            <span>{formatRupiah(order.itemPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Nominal Dibayar</span>
            <span className="font-semibold">{formatRupiah(order.amountExpected)}</span>
          </div>
          {order.amountPaid && (
            <div className="flex justify-between">
              <span className="text-gray-500">Terbayar</span>
              <span>{formatRupiah(order.amountPaid)}</span>
            </div>
          )}
        </div>

        {/* QR Code */}
        {isPending && order.qrUrl && (
          <div className="flex flex-col items-center mb-6">
            <div className="border-2 border-gray-200 rounded-xl p-4 mb-3">
              <QRCodeSVG
                value={order.qrUrl}
                size={220}
                level="M"
                includeMargin
              />
            </div>
            <p className="text-sm text-gray-500 text-center">
              Scan QR code di atas menggunakan aplikasi e-wallet
            </p>
          </div>
        )}

        {/* Countdown */}
        {isPending && countdown && (
          <div className="text-center mb-4">
            <span className="text-xs text-gray-400">Sisa waktu</span>
            <div className="text-3xl font-mono font-bold text-gray-800">
              {countdown}
            </div>
          </div>
        )}

        {/* Actions */}
        {order.status === "paid" && (
          <div className="text-center">
            <a
              href="/"
              className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition"
            >
              Kembali ke Beranda
            </a>
          </div>
        )}
        {(order.status === "expired" || order.status === "cancel" || order.status === "deny") && (
          <div className="text-center">
            <a
              href="/"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Buat Pesanan Baru
            </a>
          </div>
        )}
      </div>
    </main>
  );
}