"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Compound } from "@/types/Compound";
import CompoundRow from "./CompoundRow";
import {
  DescriptorKey,
  DescriptorStats,
  MetadataStats,
} from "@/types/MetadataStats";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

function useDebounce<T>(value: T, delay: number, onChange: (value: T) => void) {
  const [pendingValue, setPendingValue] = useState<T>(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setPendingValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const scheduleChange = (nextValue: T) => {
    if (nextValue === pendingValue) {
      return;
    }

    setPendingValue(nextValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(nextValue);
      debounceRef.current = null;
    }, delay);
  };

  return { pendingValue, scheduleChange };
}

interface CompoundsViewerProps {
  dataUrl?: string;
  data?: Compound[];
  metadataStatsUrl?: string;
  metadataStatsData?: MetadataStats;
}

interface RangeFilterValue {
  min: number;
  max: number;
}

interface RangeFilterConfig {
  key: DescriptorKey;
  label: string;
  unit?: string;
  step: number;
  decimals: number;
}

interface DiscreteOption {
  value: string;
  label: string;
  predicate: (value: number | undefined) => boolean;
}

interface DiscreteFilterConfig {
  key: DescriptorKey;
  label: string;
  options: DiscreteOption[];
}

type RangeFilterState = Partial<Record<DescriptorKey, RangeFilterValue>>;
type DiscreteFilterState = Partial<Record<DescriptorKey, string>>;

interface FiltersState {
  range: RangeFilterState;
  discrete: DiscreteFilterState;
}

const RANGE_FILTERS: RangeFilterConfig[] = [
  { key: "mw", label: "MW", unit: "Da", step: 1, decimals: 0 },
  { key: "logp", label: "logP", step: 0.01, decimals: 2 },
  { key: "tpsa", label: "TPSA", unit: "A^2", step: 1, decimals: 0 },
  { key: "qed_value", label: "QED", step: 0.01, decimals: 2 },
  { key: "sas_score", label: "SAS", step: 0.01, decimals: 2 },
];

const DISCRETE_FILTERS: DiscreteFilterConfig[] = [
  {
    key: "logd",
    label: "logD",
    options: [
      {
        value: "any",
        label: "All logD",
        predicate: () => true,
      },
      {
        value: "lt0",
        label: "< 0",
        predicate: (value) => (value ?? 0) < 0,
      },
      {
        value: "0to1",
        label: "0 - 1",
        predicate: (value) => {
          if (value == null) {
            return false;
          }
          return value >= 0 && value <= 1;
        },
      },
      {
        value: "1to2",
        label: "1 - 2",
        predicate: (value) => {
          if (value == null) {
            return false;
          }
          return value > 1 && value <= 2;
        },
      },
      {
        value: "gt2",
        label: "> 2",
        predicate: (value) => (value ?? 0) > 2,
      },
    ],
  },
  {
    key: "hbd",
    label: "HBD",
    options: [
      { value: "any", label: "All", predicate: () => true },
      { value: "2", label: "2", predicate: (value) => value === 2 },
      { value: "3", label: "3", predicate: (value) => value === 3 },
    ],
  },
  {
    key: "hba",
    label: "HBA",
    options: [
      { value: "any", label: "All", predicate: () => true },
      { value: "6", label: "6", predicate: (value) => value === 6 },
      { value: "7", label: "7", predicate: (value) => value === 7 },
      { value: "8", label: "8", predicate: (value) => value === 8 },
      { value: "9", label: "9", predicate: (value) => value === 9 },
      { value: "10", label: "10", predicate: (value) => value === 10 },
      { value: "11", label: "11", predicate: (value) => value === 11 },
    ],
  },
  {
    key: "fcsp3",
    label: "Fsp3",
    options: [
      { value: "any", label: "All", predicate: () => true },
      {
        value: "lt0.2",
        label: "< 0.20",
        predicate: (value) => (value ?? 0) < 0.2,
      },
      {
        value: "0.2-0.35",
        label: "0.20 - 0.35",
        predicate: (value) => {
          if (value == null) {
            return false;
          }
          return value >= 0.2 && value <= 0.35;
        },
      },
      {
        value: "gt0.35",
        label: "> 0.35",
        predicate: (value) => (value ?? 0) > 0.35,
      },
    ],
  },
];

const formatNumber = (value: number, decimals: number) => {
  if (Number.isNaN(value)) {
    return "N/A";
  }

  if (Math.abs(value) >= 1000) {
    return value.toExponential(2);
  }

  return value.toFixed(decimals);
};

const RangeFilterControl: React.FC<{
  config: RangeFilterConfig;
  value?: RangeFilterValue;
  stats?: DescriptorStats;
  onChange: (value: RangeFilterValue) => void;
}> = ({ config, value, stats, onChange }) => {
  const { pendingValue, scheduleChange } = useDebounce(
    value ?? { min: 0, max: 0 },
    200,
    onChange
  );

  if (!stats || !value) {
    return null;
  }

  const { label, unit, step, decimals } = config;

  const clampMin = (nextValue: number) => {
    const lowerBound = Math.max(stats.min, Math.min(nextValue, stats.max));
    return Math.min(lowerBound, pendingValue.max);
  };

  const clampMax = (nextValue: number) => {
    const upperBound = Math.min(stats.max, Math.max(nextValue, stats.min));
    return Math.max(upperBound, pendingValue.min);
  };

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

      <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
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
};

const DiscreteFilterControl: React.FC<{
  config: DiscreteFilterConfig;
  value?: string;
  onChange: (value: string) => void;
}> = ({ config, value, onChange }) => {
  const { label, options } = config;
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      <span className="font-medium text-gray-800">{label}</span>
      <select
        value={value ?? options[0]?.value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={`${config.key}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

const CompoundsViewer: React.FC<CompoundsViewerProps> = ({
  dataUrl = "/compounds_biology.json",
  data,
  metadataStatsUrl = "/metadata_stats.json",
  metadataStatsData,
}) => {
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [metadataStats, setMetadataStats] = useState<MetadataStats | null>(
    null
  );
  const [filters, setFilters] = useState<FiltersState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const datasetPromise = data
          ? Promise.resolve(data)
          : fetch(dataUrl).then((response) => {
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch data: ${response.status} ${response.statusText}`
                );
              }
              return response.json();
            });

        const statsPromise = metadataStatsData
          ? Promise.resolve(metadataStatsData)
          : fetch(metadataStatsUrl).then((response) => {
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch metadata stats: ${response.status} ${response.statusText}`
                );
              }
              return response.json();
            });

        const [dataset, stats] = await Promise.all([
          datasetPromise,
          statsPromise,
        ]);

        if (!Array.isArray(dataset)) {
          throw new Error("Compounds data is not an array");
        }

        setCompounds(dataset);
        setMetadataStats(stats);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load compounds"
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [data, dataUrl, metadataStatsData, metadataStatsUrl]);

  useEffect(() => {
    if (!metadataStats) {
      return;
    }

    setFilters((previous) => {
      if (previous) {
        return previous;
      }

      const initialRange: RangeFilterState = {};
      RANGE_FILTERS.forEach(({ key }) => {
        const stats = metadataStats[key];
        if (!stats) {
          return;
        }
        initialRange[key] = { min: stats.min, max: stats.max };
      });

      const initialDiscrete: DiscreteFilterState = {};
      DISCRETE_FILTERS.forEach(({ key, options }) => {
        if (options.length > 0) {
          initialDiscrete[key] = options[0].value;
        }
      });

      return { range: initialRange, discrete: initialDiscrete };
    });
  }, [metadataStats]);

  const filteredCompounds = useMemo(() => {
    if (!filters) {
      return compounds;
    }

    return compounds.filter((compound) => {
      for (const config of RANGE_FILTERS) {
        const stats = metadataStats?.[config.key];
        const rangeFilter = filters.range[config.key];
        if (!stats || !rangeFilter) {
          continue;
        }

        const value = compound[config.key];
        if (value == null) {
          return false;
        }

        if (value < rangeFilter.min || value > rangeFilter.max) {
          return false;
        }
      }

      for (const config of DISCRETE_FILTERS) {
        const value = compound[config.key];
        const selectedValue = filters.discrete[config.key];
        const option = config.options.find(
          (item) => item.value === selectedValue
        );
        if (!option) {
          continue;
        }

        if (!option.predicate(value)) {
          return false;
        }
      }

      return true;
    });
  }, [compounds, filters, metadataStats]);

  const estimateRowHeight = useCallback(() => 480, []);

  const rowVirtualizer = useWindowVirtualizer({
    count: filteredCompounds.length,
    estimateSize: estimateRowHeight,
    overscan: 8,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    rowVirtualizer.scrollToOffset(0, { behavior: "auto" });
  }, [rowVirtualizer, filteredCompounds.length, filters]);

  const handleRangeChange = (key: DescriptorKey, value: RangeFilterValue) => {
    setFilters((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        range: {
          ...previous.range,
          [key]: value,
        },
      };
    });
  };

  const handleDiscreteChange = (key: DescriptorKey, value: string) => {
    setFilters((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        discrete: {
          ...previous.discrete,
          [key]: value,
        },
      };
    });
  };

  const handleResetFilters = () => {
    if (!metadataStats) {
      return;
    }

    setFilters(() => {
      const rangeState: RangeFilterState = {};
      RANGE_FILTERS.forEach(({ key }) => {
        const stats = metadataStats[key];
        if (stats) {
          rangeState[key] = { min: stats.min, max: stats.max };
        }
      });

      const discreteState: DiscreteFilterState = {};
      DISCRETE_FILTERS.forEach(({ key, options }) => {
        if (options.length > 0) {
          discreteState[key] = options[0].value;
        }
      });

      return { range: rangeState, discrete: discreteState };
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !filters || !metadataStats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading compounds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Toxicity Explorer
          </h1>
          <p className="text-gray-600 mt-2">
            Showing {filteredCompounds.length} of {compounds.length} compounds
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {RANGE_FILTERS.map((config) => (
              <RangeFilterControl
                key={config.key}
                config={config}
                value={filters.range[config.key]}
                stats={metadataStats[config.key]}
                onChange={(value) => handleRangeChange(config.key, value)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {DISCRETE_FILTERS.map((config) => (
              <DiscreteFilterControl
                key={config.key}
                config={config}
                value={filters.discrete[config.key]}
                onChange={(value) => handleDiscreteChange(config.key, value)}
              />
            ))}
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Reset filters
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredCompounds.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No compounds match the selected filters.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div
              style={{ height: rowVirtualizer.getTotalSize() }}
              className="relative w-full"
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const compound = filteredCompounds[virtualRow.index];
                if (!compound) {
                  return null;
                }

                return (
                  <div
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    className="absolute left-0 right-0"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                    data-index={virtualRow.index}
                  >
                    <div className="pb-6">
                      <CompoundRow
                        compound={compound}
                        metadataStats={metadataStats}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompoundsViewer;
