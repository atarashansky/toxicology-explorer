import React, { useEffect, useMemo, useState, memo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Compound } from "@/types/Compound";
import MoleculeRenderer from "./MoleculeRenderer";
import {
  DescriptorKey,
  DescriptorStats,
  MetadataStats,
} from "@/types/MetadataStats";

interface CompoundRowProps {
  compound: Compound;
  metadataStats?: MetadataStats;
}

interface DescriptorDisplayConfig {
  key: DescriptorKey;
  label: string;
  unit?: string;
  decimals: number;
}

const DESCRIPTORS: DescriptorDisplayConfig[] = [
  { key: "mw", label: "MW", unit: "Da", decimals: 0 },
  { key: "logp", label: "logP", decimals: 2 },
  { key: "logd", label: "logD", decimals: 2 },
  { key: "tpsa", label: "TPSA", unit: "A^2", decimals: 0 },
  { key: "hbd", label: "HBD", decimals: 0 },
  { key: "hba", label: "HBA", decimals: 0 },
  { key: "fcsp3", label: "Fsp3", decimals: 2 },
  { key: "qed_value", label: "QED", decimals: 3 },
  { key: "sas_score", label: "SAS", decimals: 2 },
];

const ENDPOINTS = [
  { key: "bioactivity", label: "Bioactivity", color: "#2563eb" },
  { key: "cell_count", label: "Cell Count", color: "#7c3aed" },
  { key: "cyto_area", label: "Cyto Area", color: "#0ea5e9" },
  { key: "nuclei_size", label: "Nuclei Size", color: "#14b8a6" },
  { key: "vacuoles", label: "Vacuoles", color: "#f97316" },
  { key: "mito_puncta", label: "Mito Puncta", color: "#ef4444" },
  { key: "ros", label: "ROS", color: "#6366f1" },
  { key: "mtt", label: "MTT", color: "#dc2626" },
  { key: "ldh", label: "LDH", color: "#b45309" },
] as const;

type EndpointKey = (typeof ENDPOINTS)[number]["key"];

const LD_SUFFIXES = ["ld20", "ld50", "ld80"] as const;
const LD_COLORS: Record<(typeof LD_SUFFIXES)[number], string> = {
  ld20: "#fbbf24",
  ld50: "#f97316",
  ld80: "#dc2626",
};

const formatDescriptorValue = (value?: number, decimals = 2) => {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  if (Math.abs(value) >= 1000) {
    return value.toExponential(2);
  }

  if (decimals === 0) {
    return Math.round(value).toString();
  }

  return value.toFixed(decimals);
};

const clampPercent = (percent: number) => {
  if (Number.isNaN(percent) || !Number.isFinite(percent)) {
    return 0;
  }
  return Math.min(100, Math.max(0, percent));
};

const DescriptorBar: React.FC<{
  config: DescriptorDisplayConfig;
  value?: number;
  stats?: DescriptorStats;
}> = ({ config, value, stats }) => {
  const { label, unit, decimals } = config;
  const range = stats ? stats.max - stats.min : 0;
  const valuePercent =
    stats && range > 0 && value != null
      ? clampPercent(((value - stats.min) / range) * 100)
      : 0;
  const meanPercent =
    stats && range > 0
      ? clampPercent(((stats.mean - stats.min) / range) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between text-sm text-gray-700">
        <span className="font-medium text-gray-800">{label}</span>
        <span>
          {formatDescriptorValue(value, decimals)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="relative h-2 w-full rounded bg-gray-200">
        {stats && (
          <>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
              style={{ left: `${meanPercent}%` }}
            />
            {value != null && (
              <div
                className="absolute -top-1 h-4 w-1 rounded bg-blue-600"
                style={{ left: `calc(${valuePercent}% - 0.5px)` }}
              />
            )}
          </>
        )}
      </div>
      {stats && (
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>{formatDescriptorValue(stats.min, decimals)}</span>
          <span>{formatDescriptorValue(stats.mean, decimals)}</span>
          <span>{formatDescriptorValue(stats.max, decimals)}</span>
        </div>
      )}
    </div>
  );
};

const parseNumericArrayString = (input?: string): number[] | null => {
  if (!input) {
    return null;
  }

  const cleaned = input.replace(/\[/g, " ").replace(/\]/g, " ");
  const tokens = cleaned.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);

  const values = tokens
    .map((token) => Number(token))
    .filter((value) => !Number.isNaN(value));

  return values.length > 0 ? values : null;
};

const formatDose = (value: number) => {
  if (value >= 10000 || value <= 0.01) {
    return value.toExponential(1);
  }

  if (value >= 100) {
    return value.toFixed(0);
  }

  if (value >= 1) {
    return value.toFixed(1);
  }

  return value.toPrecision(2);
};

const formatResponse = (value: number) => {
  if (value >= 1) {
    return value.toFixed(2);
  }
  return value.toPrecision(2);
};

const CompoundRowComponent: React.FC<CompoundRowProps> = ({
  compound,
  metadataStats,
}) => {
  const availableEndpoints = useMemo(
    () =>
      ENDPOINTS.filter((endpoint) => {
        const key = `${endpoint.key}_mean_preds` as keyof Compound;
        const raw = compound[key];
        return typeof raw === "string" && raw.trim().length > 0;
      }),
    [compound]
  );

  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointKey>(
    availableEndpoints[0]?.key ?? ENDPOINTS[0].key
  );

  useEffect(() => {
    if (availableEndpoints.length === 0) {
      return;
    }

    if (
      !availableEndpoints.some((endpoint) => endpoint.key === selectedEndpoint)
    ) {
      setSelectedEndpoint(availableEndpoints[0].key);
    }
  }, [availableEndpoints, selectedEndpoint]);

  const chartData = useMemo(() => {
    const doses = parseNumericArrayString(compound.doses);
    const mean = parseNumericArrayString(
      compound[`${selectedEndpoint}_mean_preds` as keyof Compound] as
        | string
        | undefined
    );

    if (!doses || !mean || doses.length === 0 || mean.length === 0) {
      return null;
    }

    const lower = parseNumericArrayString(
      compound[`${selectedEndpoint}_lower_bound` as keyof Compound] as
        | string
        | undefined
    );
    const upper = parseNumericArrayString(
      compound[`${selectedEndpoint}_upper_bound` as keyof Compound] as
        | string
        | undefined
    );
    const std = parseNumericArrayString(
      compound[`${selectedEndpoint}_std_preds` as keyof Compound] as
        | string
        | undefined
    );

    const seriesLength = Math.min(
      doses.length,
      mean.length,
      lower ? lower.length : mean.length,
      upper ? upper.length : mean.length,
      std ? std.length : mean.length
    );

    if (seriesLength === 0) {
      return null;
    }

    return Array.from({ length: seriesLength }, (_, index) => {
      const dose = doses[index];
      const meanValue = mean[index];
      const lowerValue =
        lower?.[index] ?? Math.max(meanValue - (std?.[index] ?? 0), 0);
      const upperValue = upper?.[index] ?? meanValue + (std?.[index] ?? 0);

      return {
        dose,
        mean: meanValue,
        lower: lowerValue,
        range: Math.max(upperValue - lowerValue, 0),
      };
    });
  }, [compound, selectedEndpoint]);

  const ldValues = useMemo(() => {
    return LD_SUFFIXES.map((suffix) => {
      const property = `${selectedEndpoint}_${suffix}` as keyof Compound;
      const value = compound[property];
      return typeof value === "number" ? value : undefined;
    });
  }, [compound, selectedEndpoint]);

  const toxicityRows = useMemo(() => {
    return ENDPOINTS.map((endpoint) => {
      const values = LD_SUFFIXES.map((suffix) => {
        const property = `${endpoint.key}_${suffix}` as keyof Compound;
        const rawValue = compound[property];
        return typeof rawValue === "number" ? rawValue : undefined;
      });

      return {
        endpoint,
        values,
      };
    }).filter((row) => row.values.some((value) => value != null));
  }, [compound]);

  const ladderRows = useMemo(() => {
    return toxicityRows.map((row) => {
      const sanitized = row.values.map((value) =>
        value != null && value > 0 ? value : undefined
      );
      const numeric = sanitized.filter((value): value is number => value != null);
      const min = numeric.length > 0 ? Math.min(...numeric) : undefined;
      const max = numeric.length > 0 ? Math.max(...numeric) : undefined;

      return {
        key: row.endpoint.key,
        label: row.endpoint.label,
        values: sanitized,
        min,
        max,
      };
    });
  }, [toxicityRows]);

  const ladderDomain = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = 0;

    ladderRows.forEach((row) => {
      row.values.forEach((value) => {
        if (value != null && value > 0) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    if (!Number.isFinite(min) || min <= 0) {
      min = 0.1;
    }
    if (max <= 0) {
      max = 10;
    }
    if (min === max) {
      min *= 0.5;
      max *= 1.5;
    }

    const paddedMin = Math.max(min * 0.85, min * 0.5);
    const paddedMax = max * 1.15;

    return [paddedMin, paddedMax] as const;
  }, [ladderRows]);

  const ladderRangeSegments = useMemo(
    () =>
      ladderRows
        .filter(
          (row) =>
            row.min != null &&
            row.max != null &&
            row.min > 0 &&
            row.max > 0 &&
            row.min !== row.max
        )
        .map((row) => ({
          key: row.key,
          data: [
            { x: row.min as number, y: row.label },
            { x: row.max as number, y: row.label },
          ],
        })),
    [ladderRows]
  );

  const ldScatterSeries = useMemo(
    () =>
      LD_SUFFIXES.map((suffix, index) => ({
        suffix,
        label: suffix.toUpperCase(),
        color: LD_COLORS[suffix],
        data: ladderRows.flatMap((row) => {
          const value = row.values[index];
          if (value == null || value <= 0) {
            return [];
          }
          return [
            {
              x: value,
              y: row.label,
              endpointKey: row.key,
              endpointLabel: row.label,
              ldLabel: suffix.toUpperCase(),
            },
          ];
        }),
      })),
    [ladderRows]
  );

  const doseDomain = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return null;
    }

    const doses = chartData
      .map((point) => point.dose)
      .filter((dose) => dose > 0);
    if (doses.length === 0) {
      return null;
    }

    const minDose = Math.min(...doses);
    const maxDose = Math.max(...doses);

    return [minDose, maxDose] as const;
  }, [chartData]);

  const selectedEndpointConfig = useMemo(
    () => ENDPOINTS.find((endpoint) => endpoint.key === selectedEndpoint),
    [selectedEndpoint]
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex w-full flex-col gap-4 lg:w-1/4">
          <MoleculeRenderer
            smiles={compound.smiles}
            inchi={compound.inchi}
            width={220}
            height={180}
            className="w-full"
          />
          <div className="space-y-1 text-sm text-gray-700">
            <div className="text-lg font-semibold text-gray-900">
              {compound.name}
            </div>
            <div>ID: {compound.id}</div>
            {compound.split && <div>Split: {compound.split}</div>}
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:w-7/12">
          {DESCRIPTORS.map((descriptor) => (
            <DescriptorBar
              key={descriptor.key}
              config={descriptor}
              value={compound[descriptor.key] as number | undefined}
              stats={metadataStats?.[descriptor.key]}
            />
          ))}
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-1/3">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                LD Ladder
              </h3>
            </div>
            {ladderRows.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-gray-500">
                LD data not available.
              </div>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={ladderRows}
                    margin={{ top: 16, right: 24, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      scale="log"
                      domain={ladderDomain}
                      tickFormatter={formatDose}
                      stroke="#4b5563"
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      stroke="#4b5563"
                      width={90}
                    />
                    <Tooltip
                      cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
                      formatter={(value: number | string, _name: string, item) => {
                        const payload = item?.payload as
                          | { ldLabel?: string; endpointLabel?: string; x?: number }
                          | undefined;
                        const label = payload?.ldLabel ?? "LD";
                        const numericValue =
                          typeof value === "number" ? value : Number(value);
                        return [formatDose(numericValue), label];
                      }}
                      labelFormatter={(label) =>
                        typeof label === "string"
                          ? `Endpoint: ${label}`
                          : undefined
                      }
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: 12 }}
                    />
                    {ladderRangeSegments.map((segment) => (
                      <Scatter
                        key={`range-${segment.key}`}
                        data={segment.data}
                        line={{ stroke: "#d1d5db", strokeWidth: 4, strokeLinecap: "round" }}
                        shape={() => null}
                      />
                    ))}
                    {ldScatterSeries.map((series) => (
                      <Scatter
                        key={series.suffix}
                        name={series.label}
                        data={series.data}
                        fill={series.color}
                        shape="circle"
                        legendType="circle"
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Dose-Response
              </h3>
              <select
                value={selectedEndpoint}
                onChange={(event) =>
                  setSelectedEndpoint(event.target.value as EndpointKey)
                }
                className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {availableEndpoints.map((endpoint) => (
                  <option key={endpoint.key} value={endpoint.key}>
                    {endpoint.label}
                  </option>
                ))}
              </select>
            </div>
            {chartData && doseDomain ? (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="dose"
                      type="number"
                      scale="log"
                      domain={doseDomain}
                      tickFormatter={formatDose}
                      stroke="#4b5563"
                    />
                    <YAxis
                      tickFormatter={formatResponse}
                      stroke="#4b5563"
                      width={45}
                    />
                    <Tooltip
                      formatter={(value: number, key: string) => {
                        if (key === "mean") {
                          return [formatResponse(value), "Mean"];
                        }
                        if (key === "lower") {
                          return [formatResponse(value), "Lower"];
                        }
                        if (key === "range") {
                          return [formatResponse(value), "Range"];
                        }
                        return [formatResponse(value), key];
                      }}
                      labelFormatter={(label: number) =>
                        `Dose ${formatDose(label)}`
                      }
                    />
                    <Area
                      dataKey="lower"
                      stackId="confidence"
                      stroke="none"
                      fill="transparent"
                    />
                    <Area
                      dataKey="range"
                      stackId="confidence"
                      stroke="none"
                      fill={selectedEndpointConfig?.color ?? "#2563eb"}
                      fillOpacity={0.2}
                    />
                    <Line
                      type="monotone"
                      dataKey="mean"
                      stroke={selectedEndpointConfig?.color ?? "#2563eb"}
                      strokeWidth={2}
                      dot={{ r: 1.5 }}
                    />
                    {ldValues.map((value, index) =>
                      value != null ? (
                        <ReferenceLine
                          key={`ld-${index}`}
                          x={value}
                          stroke="#f59e0b"
                          strokeDasharray="4 2"
                          label={{
                            value: LD_SUFFIXES[index].toUpperCase(),
                            position: "insideTop",
                            offset: 10,
                            fill: "#92400e",
                            fontSize: 10,
                          }}
                        />
                      ) : null
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-60 flex items-center justify-center text-sm text-gray-500">
                Dose-response data not available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CompoundRow = memo(CompoundRowComponent, (prevProps, nextProps) => {
  return (
    prevProps.compound.id === nextProps.compound.id &&
    prevProps.metadataStats === nextProps.metadataStats
  );
});

export default CompoundRow;
