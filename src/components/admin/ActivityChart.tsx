"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyActivity } from "@/types/admin";

interface Props {
  data: DailyActivity[];
}

const SERIES = [
  { key: "posts", label: "Posts", color: "#2563eb" },
  { key: "votes", label: "Votes", color: "#16a34a" },
  { key: "comments", label: "Comments", color: "#9333ea" },
] as const;

/** Format an ISO date (YYYY-MM-DD) as a short "Jun 26" label. */
function shortLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function ActivityChart({ data }: Props) {
  // recharts' ResponsiveContainer reads layout from the DOM; render only after
  // mount to avoid the SSR width-0 warning and hydration mismatch (ADR-009).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div>
      <div className="h-64 w-full" aria-hidden="true">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={shortLabel}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} width={32} />
              <Tooltip labelFormatter={(label) => shortLabel(String(label))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SERIES.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  fill={`url(#fill-${s.key})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Accessible equivalent of the chart (ADR-009 Decision 3). */}
      <table className="sr-only">
        <caption>Daily activity over the last {data.length} days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {SERIES.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.posts}</td>
              <td>{d.votes}</td>
              <td>{d.comments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
