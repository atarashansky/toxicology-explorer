"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Compound } from "@/types/Compound";
import { formatDose } from "@/utils/formatting";

export interface EmbeddingPoint {
  id: string;
  x: number;
  y: number;
  compound?: Compound;
  safetyMetric: number | null;
}

export interface EmbeddingWeightOption {
  index: number;
  weight: number;
  label: string;
  url: string;
}

interface EmbeddingExplorerProps {
  options: EmbeddingWeightOption[];
  currentIndex: number;
  onWeightChange: (index: number) => void;
  points: EmbeddingPoint[] | null;
  loading: boolean;
  error: string | null;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  totalCompounds: number;
  selectedDoseValue: number | null;
}

interface ScatterHoverState {
  point: EmbeddingPoint;
  position: { x: number; y: number };
}

const DEFAULT_HEIGHT = 600;
const MAX_SCATTER_DIMENSION = 600;
const MIN_CANVAS_DIMENSION = 100;

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const generateTicks = (min: number, max: number, count: number) => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count <= 0) {
    return [];
  }

  if (min === max) {
    return [min];
  }

  const step = (max - min) / Math.max(count - 1, 1);
  const ticks: number[] = [];

  for (let index = 0; index < count; index += 1) {
    ticks.push(min + step * index);
  }

  return ticks;
};

const interpolateSafetyColor = (
  value: number,
  domain: [number, number]
): string => {
  const [min, max] = domain;
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    return "#9ca3af";
  }

  if (max === min) {
    return "#2563eb";
  }

  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const hue = 10 + (120 - 10) * t; // reddish to green hue sweep
  return `hsl(${hue}, 65%, 48%)`;
};

const isPointInPolygon = (
  polygon: [number, number][],
  target: [number, number]
) => {
  let inside = false;
  const [x, y] = target;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
};

const EmbeddingScatter: React.FC<{
  points: EmbeddingPoint[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: string[]) => void;
  domainX: [number, number];
  domainY: [number, number];
  metricDomain: [number, number] | null;
  loading: boolean;
}> = ({
  points,
  selectedIds,
  onSelectionChange,
  domainX,
  domainY,
  metricDomain,
  loading,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>(() => ({
    width: 0,
    height: DEFAULT_HEIGHT,
  }));
  const [hover, setHover] = useState<ScatterHoverState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lassoPath, setLassoPath] = useState<[number, number][]>([]);
  const lassoPathRef = useRef<[number, number][]>([]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateSize = (width: number) => {
      const constrainedWidth = Math.max(width, MIN_CANVAS_DIMENSION);
      const dimension = Math.min(constrainedWidth, MAX_SCATTER_DIMENSION);
      setSize({ width: dimension, height: dimension });
    };

    if (typeof ResizeObserver === "undefined") {
      updateSize(element.clientWidth);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      updateSize(entry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const margin = { top: 24, right: 24, bottom: 48, left: 60 };
  const plotWidth = Math.max(size.width - margin.left - margin.right, 10);
  const plotHeight = Math.max(size.height - margin.top - margin.bottom, 10);

  const projectX = useCallback(
    (value: number) => {
      const [min, max] = domainX;
      const span = max - min || 1;
      return margin.left + ((value - min) / span) * plotWidth;
    },
    [domainX, margin.left, plotWidth]
  );

  const projectY = useCallback(
    (value: number) => {
      const [min, max] = domainY;
      const span = max - min || 1;
      return margin.top + plotHeight - ((value - min) / span) * plotHeight;
    },
    [domainY, margin.top, plotHeight]
  );

  const handlePointerCoordinate = (
    event: React.PointerEvent<SVGSVGElement>
  ) => {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top] as [
      number,
      number
    ];
  };

  const applyLassoSelection = useCallback(
    (path: [number, number][]) => {
      if (path.length < 3) {
        if (path.length === 0) {
          onSelectionChange([]);
          return;
        }

        const [latestX, latestY] = path[path.length - 1];
        const tolerance = 12;
        let closestId: string | null = null;
        let bestDistance = Infinity;

        points.forEach((point) => {
          const px = projectX(point.x);
          const py = projectY(point.y);
          const distance = Math.hypot(px - latestX, py - latestY);
          if (distance < tolerance && distance < bestDistance) {
            closestId = point.id;
            bestDistance = distance;
          }
        });

        onSelectionChange(closestId ? [closestId] : []);
        return;
      }

      const polygon = path;
      const selected: string[] = [];

      points.forEach((point) => {
        const px = projectX(point.x);
        const py = projectY(point.y);
        if (isPointInPolygon(polygon, [px, py])) {
          selected.push(point.id);
        }
      });

      onSelectionChange(selected);
    },
    [onSelectionChange, points, projectX, projectY]
  );

  const finalizeLasso = useCallback(() => {
    const path = lassoPathRef.current;
    applyLassoSelection(path);
    lassoPathRef.current = [];
    setLassoPath([]);
    setIsDragging(false);
  }, [applyLassoSelection]);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (loading) {
      return;
    }

    const coords = handlePointerCoordinate(event);
    if (!coords) {
      return;
    }

    const svg = svgRef.current;
    if (svg) {
      svg.setPointerCapture(event.pointerId);
    }

    setIsDragging(true);
    lassoPathRef.current = [coords];
    setLassoPath([coords]);
    setHover(null);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) {
      return;
    }

    const coords = handlePointerCoordinate(event);
    if (!coords) {
      return;
    }

    lassoPathRef.current = [...lassoPathRef.current, coords];
    setLassoPath((previous) => [...previous, coords]);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) {
      return;
    }

    const svg = svgRef.current;
    if (svg) {
      svg.releasePointerCapture(event.pointerId);
    }

    finalizeLasso();
  };

  const handlePointerLeave = () => {
    if (isDragging) {
      finalizeLasso();
    }
  };

  const handlePointEnter = (
    event: React.PointerEvent<SVGCircleElement>,
    point: EmbeddingPoint
  ) => {
    if (isDragging) {
      return;
    }

    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    setHover({
      point,
      position: {
        x: event.clientX - rect.left + 8,
        y: event.clientY - rect.top + 8,
      },
    });
  };

  const handlePointLeave = () => {
    setHover(null);
  };

  const xTicks = useMemo(
    () => generateTicks(domainX[0], domainX[1], 5),
    [domainX]
  );
  const yTicks = useMemo(
    () => generateTicks(domainY[0], domainY[1], 5),
    [domainY]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: size.height }}
    >
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="overflow-visible"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <rect
          x={margin.left}
          y={margin.top}
          width={plotWidth}
          height={plotHeight}
          fill="#f9fafb"
          stroke="#e5e7eb"
          strokeWidth={1}
          rx={6}
        />

        {xTicks.map((tick) => {
          const x = projectX(tick);
          return (
            <g key={`x-tick-${tick}`} transform={`translate(${x}, 0)`}>
              <line
                x1={0}
                x2={0}
                y1={margin.top + plotHeight}
                y2={margin.top + plotHeight + 6}
                stroke="#9ca3af"
              />
              <text
                x={0}
                y={margin.top + plotHeight + 22}
                textAnchor="middle"
                className="fill-gray-500 text-[11px]"
              >
                {numberFormatter.format(tick)}
              </text>
            </g>
          );
        })}

        {yTicks.map((tick) => {
          const y = projectY(tick);
          return (
            <g key={`y-tick-${tick}`} transform={`translate(0, ${y})`}>
              <line
                x1={margin.left - 6}
                x2={margin.left}
                y1={0}
                y2={0}
                stroke="#9ca3af"
              />
              <text
                x={margin.left - 10}
                y={4}
                textAnchor="end"
                className="fill-gray-500 text-[11px]"
              >
                {numberFormatter.format(tick)}
              </text>
            </g>
          );
        })}

        {points.map((point) => {
          const x = projectX(point.x);
          const y = projectY(point.y);
          const isSelected = selectedIds.has(point.id);
          const fillColor =
            point.safetyMetric != null && metricDomain
              ? interpolateSafetyColor(point.safetyMetric, metricDomain)
              : "#3b82f6";

          return (
            <g key={point.id}>
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 6 : 4}
                fill={fillColor}
                stroke={isSelected ? "#111827" : "white"}
                strokeWidth={isSelected ? 1.5 : 1}
                onPointerEnter={(event) => handlePointEnter(event, point)}
                onPointerLeave={handlePointLeave}
              />
            </g>
          );
        })}

        {lassoPath.length > 1 && (
          <path
            d={`M ${lassoPath.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="#1d4ed8"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60">
          <div className="flex flex-col items-center gap-2 text-sm text-gray-600">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-b-transparent" />
            Loading embedding…
          </div>
        </div>
      ) : null}

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-lg"
          style={{
            left: Math.min(size.width - 160, Math.max(0, hover.position.x)),
            top: Math.min(size.height - 80, Math.max(0, hover.position.y)),
          }}
        >
          <div className="font-semibold text-gray-900">{hover.point.id}</div>
          {hover.point.safetyMetric != null ? (
            <div>
              Therapeutic Window:{" "}
              {numberFormatter.format(hover.point.safetyMetric)}
            </div>
          ) : (
            <div>Safety metric unavailable</div>
          )}
          {hover.point.compound?.split ? (
            <div>Split: {hover.point.compound.split}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const EmbeddingExplorer: React.FC<EmbeddingExplorerProps> = ({
  options,
  currentIndex,
  onWeightChange,
  points,
  loading,
  error,
  selectedIds,
  onSelectionChange,
  totalCompounds,
  selectedDoseValue,
}) => {
  const activeOption = useMemo(
    () => options.find((option) => option.index === currentIndex) ?? options[0],
    [currentIndex, options]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectionCount = selectedIds.length;
  const totalPoints = points?.length ?? 0;

  const safetyBasisText = useMemo(() => {
    if (selectedDoseValue != null) {
      return `Dose ${formatDose(selectedDoseValue)}`;
    }
    return "LD50 baseline";
  }, [selectedDoseValue]);

  const metricDomain = useMemo(() => {
    if (!points || points.length === 0) {
      return null;
    }

    const values = points
      .map((point) => point.safetyMetric)
      .filter((value): value is number => Number.isFinite(value ?? NaN));

    if (values.length === 0) {
      return null;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return null;
    }

    return [min, max] as [number, number];
  }, [points]);

  const xDomain = useMemo(() => {
    if (!points || points.length === 0) {
      return [0, 1] as [number, number];
    }
    const xs = points.map((point) => point.x);
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    if (min === max) {
      return [min - 0.5, max + 0.5];
    }
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding] as [number, number];
  }, [points]);

  const yDomain = useMemo(() => {
    if (!points || points.length === 0) {
      return [0, 1] as [number, number];
    }
    const ys = points.map((point) => point.y);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    if (min === max) {
      return [min - 0.5, max + 0.5];
    }
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding] as [number, number];
  }, [points]);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextIndex = Number(event.target.value);
    if (!Number.isInteger(nextIndex)) {
      return;
    }
    onWeightChange(nextIndex);
  };

  const handleClearSelection = () => {
    onSelectionChange([]);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-60 flex-shrink-0 space-y-4 rounded-lg border border-gray-200 p-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Structure vs Response Weight
            </div>
            <div className="text-xs text-gray-500">
              Adjust blend between response (0.0) and structure (1.0).
            </div>
          </div>
          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={options.length - 1}
              step={1}
              value={currentIndex}
              onChange={handleSliderChange}
              className="w-full"
            />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>0.0</span>
              <span>0.5</span>
              <span>1.0</span>
            </div>
            <div className="text-sm text-gray-700">
              Active weight:{" "}
              <span className="font-medium">{activeOption.label}</span>
            </div>
          </div>

          <div className="space-y-1 text-xs text-gray-600">
            <div>Total points: {totalPoints}</div>
            <div>Compounds loaded: {totalCompounds}</div>
            <div>
              Selected points: {selectionCount}
              {selectionCount > 0 ? (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="ml-2 text-blue-600 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div>Safety basis: {safetyBasisText}</div>
          </div>

          {metricDomain ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">
                Therapeutic Window scale
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>{numberFormatter.format(metricDomain[0])}</span>
                <span>{numberFormatter.format(metricDomain[1])}</span>
              </div>
              <div
                className="h-2 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, hsl(10,65%,48%) 0%, hsl(120,65%,48%) 100%)",
                }}
              />
              <div className="text-[11px] text-gray-500">
                Green indicates higher (safer) LD50; red flags lower values.
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-gray-500">
              Safety coloring unavailable for this view.
            </div>
          )}

          {error ? (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex-1">
          {points && points.length > 0 ? (
            <EmbeddingScatter
              points={points}
              selectedIds={selectedSet}
              onSelectionChange={onSelectionChange}
              domainX={xDomain as [number, number]}
              domainY={yDomain as [number, number]}
              metricDomain={metricDomain}
              loading={loading}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500"
              style={{ height: DEFAULT_HEIGHT }}
            >
              {loading ? "Loading embedding…" : "Embedding data unavailable."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbeddingExplorer;
