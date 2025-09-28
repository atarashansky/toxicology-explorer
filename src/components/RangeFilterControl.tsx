import React, { useCallback } from "react";
import { DescriptorKey, DescriptorStats } from "@/types/MetadataStats";
import { useDebounce } from "@/hooks";

interface RangeFilterValue {
  min: number;
  max: number;
}

interface RangeFilterConfig<K extends string = DescriptorKey> {
  key: K;
  label: string;
  unit?: string;
  step: number;
  decimals: number;
}

const formatNumber = (value: number, decimals: number) => {
  if (Number.isNaN(value)) {
    return "N/A";
  }

  if (Math.abs(value) >= 1000) {
    return value.toExponential(2);
  }

  return value.toFixed(decimals);
};

interface RangeFilterControlProps<K extends string = DescriptorKey> {
  config: RangeFilterConfig<K>;
  value: RangeFilterValue;
  stats: DescriptorStats;
  histogram?: number[];
  onChange: (value: RangeFilterValue) => void;
}

function RangeFilterControl<K extends string = DescriptorKey>({
  config,
  value,
  stats,
  histogram,
  onChange,
}: RangeFilterControlProps<K>) {
  const { pendingValue, scheduleChange } = useDebounce(
    value ?? { min: 0, max: 0 },
    200,
    onChange
  );

  const { label, unit, step, decimals } = config;

  const clampMin = useCallback(
    (nextValue: number) => {
      const lowerBound = Math.max(stats.min, Math.min(nextValue, stats.max));
      return Math.min(lowerBound, pendingValue.max);
    },
    [stats.min, stats.max, pendingValue.max]
  );

  const clampMax = useCallback(
    (nextValue: number) => {
      const upperBound = Math.min(stats.max, Math.max(nextValue, stats.min));
      return Math.max(upperBound, pendingValue.min);
    },
    [stats.min, stats.max, pendingValue.min]
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span className="font-medium text-gray-800">{label}</span>
        <span>
          {formatNumber(pendingValue.min, decimals)} -{" "}
          {formatNumber(pendingValue.max, decimals)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>

      {histogram && histogram.length > 0 && (
        <div className="mt-2">
          <div className="relative h-14 overflow-hidden rounded bg-gray-100">
            <div className="absolute inset-0 flex items-end gap-[1px] px-1">
              {histogram.map((height, index) => (
                <span
                  key={`${config.key}-hist-${index}`}
                  className="flex-1 rounded-t bg-blue-200/70"
                  style={{ height: `${Math.max(height, 0.05) * 100}%` }}
                />
              ))}
            </div>
            <div className="absolute inset-0 rounded border border-blue-200/40" />
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-600">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">
            Min
          </span>
          <input
            type="range"
            min={stats.min}
            max={stats.max}
            step={step}
            value={pendingValue.min}
            onChange={(event) => {
              const clamped = clampMin(Number(event.target.value));
              scheduleChange({ min: clamped, max: pendingValue.max });
            }}
            className="w-full"
          />
          <input
            type="number"
            min={stats.min}
            max={pendingValue.max}
            step={step}
            value={pendingValue.min}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              if (Number.isNaN(nextValue)) {
                return;
              }
              const clamped = clampMin(nextValue);
              scheduleChange({ min: clamped, max: pendingValue.max });
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">
            Max
          </span>
          <input
            type="range"
            min={stats.min}
            max={stats.max}
            step={step}
            value={pendingValue.max}
            onChange={(event) => {
              const clamped = clampMax(Number(event.target.value));
              scheduleChange({ min: pendingValue.min, max: clamped });
            }}
            className="w-full"
          />
          <input
            type="number"
            min={pendingValue.min}
            max={stats.max}
            step={step}
            value={pendingValue.max}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              if (Number.isNaN(nextValue)) {
                return;
              }
              const clamped = clampMax(nextValue);
              scheduleChange({ min: pendingValue.min, max: clamped });
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 text-xs text-gray-400">
        <span>{formatNumber(stats.min, decimals)}</span>
        <span className="text-center">
          avg {formatNumber(stats.mean, decimals)}
        </span>
        <span className="text-right">{formatNumber(stats.max, decimals)}</span>
      </div>
    </div>
  );
}

export default RangeFilterControl;
export type { RangeFilterValue, RangeFilterConfig };
