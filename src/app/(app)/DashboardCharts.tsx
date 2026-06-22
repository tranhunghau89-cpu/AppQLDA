"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  CHO: "#94a3b8",
  SHOP: "#a855f7",
  GIA_CONG: "#f59e0b",
  LAP_DUNG: "#3b82f6",
  HOAN_THANH: "#22c55e",
};

export function StatusChart({
  data,
}: {
  data: { status: string; label: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(v) => [`${v} dự án`, "Số lượng"]}
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "#64748b"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function compactVND(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)} tỷ`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)} tr`;
  return String(v);
}

export function CostSaleChart({
  data,
}: {
  data: { code: string; cost: number; sale: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="code" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={compactVND} tick={{ fontSize: 11 }} width={56} />
        <Tooltip
          formatter={(v, n) => [
            new Intl.NumberFormat("vi-VN").format(Number(v)) + " ₫",
            n === "cost" ? "Chi phí" : "Giá bán",
          ]}
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        <Legend
          formatter={(v) => (v === "cost" ? "Chi phí" : "Giá bán")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="sale" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
