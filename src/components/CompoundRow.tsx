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
import {
  CompoundUncertaintyBadges,
  UncertaintyBadgeLevel,
} from "@/types/UncertaintyBadges";

interface CompoundRowProps {
  compound: Compound;
  metadataStats?: MetadataStats;
  uncertaintyBadges?: CompoundUncertaintyBadges;
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
const BADGE_STYLES: Record<UncertaintyBadgeLevel, string> = {
  LOW: "bg-green-100 text-green-700 border border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  HIGH: "bg-red-100 text-red-700 border border-red-200",
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
  uncertaintyBadges,
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
      const uncertainty = uncertaintyBadges?.[row.endpoint.key];
      const sanitized = row.values.map((value) =>
        value != null && value > 0 ? value : undefined
      );
      const numeric = sanitized.filter(
        (value): value is number => value != null
      );
      const min = numeric.length > 0 ? Math.min(...numeric) : undefined;
      const max = numeric.length > 0 ? Math.max(...numeric) : undefined;

      return {
        key: row.endpoint.key,
        label: row.endpoint.label,
        values: sanitized,
        min,
        max,
        badge: uncertainty?.badge,
      };
    });
  }, [toxicityRows, uncertaintyBadges]);

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

  const ladderScale = useMemo(() => {
    if (ladderRows.length === 0) {
      return null;
    }

    const [domainMin, domainMax] = ladderDomain;
    const logMin = Math.log10(domainMin);
    const logMax = Math.log10(domainMax);
    const denominator = logMax - logMin || 1;

    return (value: number) => {
      const clamped = Math.max(domainMin, Math.min(domainMax, value));
      const ratio = (Math.log10(clamped) - logMin) / denominator;
      return Math.min(100, Math.max(0, ratio * 100));
    };
  }, [ladderDomain, ladderRows.length]);

  const ladderTicks = useMemo(() => {
    const [domainMin, domainMax] = ladderDomain;
    const logMin = Math.log10(domainMin);
    const logMax = Math.log10(domainMax);

    const divisions = 4;
    return Array.from({ length: divisions + 1 }, (_, index) =>
      Math.pow(10, logMin + ((logMax - logMin) / divisions) * index)
    );
  }, [ladderDomain]);

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

  const selectedEndpointBadge = uncertaintyBadges?.[selectedEndpoint]?.badge;

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
              <h3 className="text-sm font-semibold text-gray-900">LD Ladder</h3>
            </div>
            {!ladderScale || ladderRows.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-gray-500">
                LD data not available.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                  {LD_SUFFIXES.map((suffix) => (
                    <div
                      key={`legend-${suffix}`}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: LD_COLORS[suffix] }}
                      />
                      <span>{suffix.toUpperCase()}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  {ladderRows.map((row) => (
                    <div key={row.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">
                            {row.label}
                          </span>
                          {row.badge ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                                BADGE_STYLES[row.badge]
                              }`}
                            >
                              {row.badge}
                            </span>
                          ) : null}
                        </div>
                        {row.min != null && row.max != null ? (
                          <span>{`${formatDose(row.min)} - ${formatDose(
                            row.max
                          )}`}</span>
                        ) : (
                          <span className="text-gray-400">No LD range</span>
                        )}
                      </div>
                      <div className="relative h-2 rounded bg-gray-200">
                        {row.min != null && row.max != null ? (
                          <span
                            className="absolute top-0 bottom-0 rounded bg-gray-400/70"
                            style={{
                              left: `${ladderScale(row.min)}%`,
                              width: `${Math.max(
                                ladderScale(row.max) - ladderScale(row.min),
                                2
                              )}%`,
                            }}
                          />
                        ) : null}
                        {row.values.map((value, index) => {
                          if (value == null || value <= 0) {
                            return null;
                          }
                          const position = ladderScale(value);
                          return (
                            <span
                              key={`${row.key}-${LD_SUFFIXES[index]}`}
                              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm"
                              style={{
                                left: `${position}%`,
                                backgroundColor: LD_COLORS[LD_SUFFIXES[index]],
                              }}
                              title={`${row.label} ${LD_SUFFIXES[
                                index
                              ].toUpperCase()}: ${formatDose(value)}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <div className="relative h-px bg-gray-200" />
                  <div className="relative mt-1 h-4">
                    {ladderTicks.map((tick) => {
                      const position = ladderScale(tick);
                      return (
                        <span
                          key={`tick-${tick}`}
                          className="absolute -translate-x-1/2 text-[11px] text-gray-500"
                          style={{ left: `${position}%` }}
                        >
                          {formatDose(tick)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Dose-Response
                </h3>
                {selectedEndpointBadge ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${BADGE_STYLES[selectedEndpointBadge]}`}
                  >
                    {selectedEndpointBadge}
                  </span>
                ) : null}
              </div>
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
