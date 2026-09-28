"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { fmtMes, fmtMoney, fmtMoneyCompact } from "@/lib/format";

const config = {
  total: { label: "Gasto", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function GastoMensual({ datos }: { datos: { mes: string; total: number }[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
      <BarChart data={datos} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="mes"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={fmtMes}
          interval="equidistantPreserveStart"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) => (v === 0 ? "$0" : fmtMoneyCompact(v))}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            const d = active && payload?.[0]?.payload;
            if (!d) return null;
            return (
              <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                <div className="font-medium capitalize">{fmtMes(d.mes)}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="size-2 rounded-[2px] bg-(--color-total)" />
                  <span className="font-mono font-semibold tabular">{fmtMoney(d.total)}</span>
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
