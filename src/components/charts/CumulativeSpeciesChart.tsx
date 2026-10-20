"use client";

import { useState } from "react";
import dayjs from "dayjs";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  SpeciesOverTimeFigure,
  SpeciesOverTimeRow,
} from "@/lib/charts/speciesOverTime";

const AXIS_COLOR = "#c1c2c5";
const GRID_COLOR = "rgba(255, 255, 255, 0.1)";
const SURFACE_COLOR = "#242424";

function TooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: SpeciesOverTimeRow }[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const added = row.deltas.reduce((acc, [, n]) => acc + n, 0);

  return (
    <div
      style={{
        background: "rgba(26, 27, 30, 0.95)",
        border: `1px solid ${GRID_COLOR}`,
        borderRadius: 4,
        padding: "8px 12px",
        color: AXIS_COLOR,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600 }}>
        {dayjs(row.t).format("MMM D, YYYY")}
      </div>
      <div>{row.placeLabel}</div>
      <div style={{ marginBottom: 4 }}>
        +{added} new ({row.total} total)
      </div>
      {row.deltas.map(([label, n]) => (
        <div key={label} style={{ display: "flex", gap: 12 }}>
          <span style={{ flex: 1 }}>{label}</span>
          <span>+{n}</span>
        </div>
      ))}
    </div>
  );
}

export function CumulativeSpeciesChart({
  figure,
}: {
  figure: SpeciesOverTimeFigure;
}) {
  const colors = new Map(figure.groups.map((c) => [c.key, c.color]));
  const [focusedKeys, setFocusedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const isDimmed = (key: string) =>
    focusedKeys.size > 0 && !focusedKeys.has(key);

  const toggleFocus = (key: string) =>
    setFocusedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ResponsiveContainer width="100%" height={550}>
      <LineChart
        data={figure.data}
        margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke={GRID_COLOR} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(t: number) => dayjs(t).format("MMM YYYY")}
          stroke={GRID_COLOR}
          tick={{ fill: AXIS_COLOR }}
          minTickGap={40}
        />
        <YAxis stroke={GRID_COLOR} tick={{ fill: AXIS_COLOR }} />
        <Tooltip
          content={(props) => <TooltipContent {...props} />}
          cursor={{ stroke: AXIS_COLOR, strokeDasharray: "3 3" }}
        />
        <Legend
          wrapperStyle={{ paddingTop: 12 }}
          content={() => (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 16,
                color: AXIS_COLOR,
              }}
            >
              {figure.groups.map((c) => (
                <span
                  key={c.key}
                  onClick={() => toggleFocus(c.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    opacity: isDimmed(c.key) ? 0.5 : 1,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      display: "inline-block",
                      background: c.color,
                    }}
                  />
                  {c.name}
                </span>
              ))}
            </div>
          )}
        />
        <Line
          dataKey="total"
          type="stepAfter"
          stroke={GRID_COLOR}
          strokeWidth={2}
          dot={({ cx, cy, payload, key }) => {
            const { group } = payload as SpeciesOverTimeRow;
            return (
              <circle
                key={key}
                cx={cx}
                cy={cy}
                r={4}
                fill={colors.get(group)}
                opacity={isDimmed(group) ? 0.15 : 1}
                stroke={SURFACE_COLOR}
                strokeWidth={1}
              />
            );
          }}
          activeDot={({ cx, cy, payload }) => (
            <circle
              cx={cx}
              cy={cy}
              r={6}
              fill={colors.get((payload as SpeciesOverTimeRow).group)}
              stroke={AXIS_COLOR}
              strokeWidth={2}
            />
          )}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
