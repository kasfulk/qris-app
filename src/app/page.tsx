"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState(0);
  const [inputAmount, setInputAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isFixedPrice = itemPrice >= 1000000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: Record<string, unknown> = { itemName, itemPrice };
      if (!isFixedPrice) {
        payload.inputAmount = inputAmount;
      }

      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat pembayaran");
        return;
      }

      router.push(`/payment/${data.orderId}`);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Pembayaran QRIS
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Barang
            </label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Contoh: Laptop"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Harga Barang (Rp)
            </label>
            <input
              type="number"
              required
              min={1}
              value={itemPrice || ""}
              onChange={(e) => setItemPrice(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Contoh: 1500000"
            />
            {itemPrice > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {formatRupiah(itemPrice)} —{" "}
                {isFixedPrice ? (
                  <span className="text-blue-600 font-medium">
                    Nominal FIXED (otomatis)
                  </span>
                ) : (
                  <span className="text-orange-600 font-medium">
                    Nominal FLEXIBLE (input manual)
                  </span>
                )}
              </p>
            )}
          </div>

          {!isFixedPrice && itemPrice > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nominal Pembayaran (Rp)
              </label>
              <input
                type="number"
                required
                min={1}
                value={inputAmount || ""}
                onChange={(e) => setInputAmount(Number(e.target.value))}
                className="w-full border border-orange-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Masukkan nominal yang ingin dibayar"
              />
              {inputAmount > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Akan dibayar: {formatRupiah(inputAmount)}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || itemPrice <= 0}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Memproses..." : "Bayar dengan QRIS"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-400">
          ≥ Rp1.000.000 → nominal fixed &nbsp;|&nbsp; &lt; Rp1.000.000 → input
          nominal
        </div>
      </div>
    </main>
  );
}