import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: number;
  /** Signed change vs the prior period; when provided, a trend indicator is shown. */
  delta?: number;
  /** Caption next to the delta, e.g. "vs prior 30d". */
  deltaLabel?: string;
}

export function StatsCard({ label, value, delta, deltaLabel }: StatsCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
        {value.toLocaleString()}
      </p>
      {delta !== undefined && <DeltaIndicator delta={delta} label={deltaLabel} />}
    </div>
  );
}

function DeltaIndicator({ delta, label }: { delta: number; label?: string }) {
  const up = delta > 0;
  const down = delta < 0;
  const color = up ? "text-green-600" : down ? "text-red-600" : "text-gray-400";
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
  const sign = up ? "+" : "";

  return (
    <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>
        {sign}
        {delta.toLocaleString()}
      </span>
      {label && <span className="text-gray-400">{label}</span>}
    </p>
  );
}
