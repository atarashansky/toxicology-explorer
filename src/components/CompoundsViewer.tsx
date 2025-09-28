"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Compound } from "@/types/Compound";
import CompoundRow from "./CompoundRow";
import { RangeFilterValue, RangeFilterConfig } from "./RangeFilterControl";
import CompoundsFilters from "./CompoundsFilters";
import EmbeddingExplorerControl from "./EmbeddingExplorerControl";
import TherapeuticDoseControl from "./TherapeuticDoseControl";
import EmbeddingModal from "./EmbeddingModal";
import { DiscreteFilterConfig } from "./DiscreteFilterControl";
import { DescriptorKey, MetadataStats } from "@/types/MetadataStats";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { EmbeddingPoint, EmbeddingWeightOption } from "./EmbeddingExplorer";
import {
  calculateAggregateMargin,
  calculateEndpointMargin,
  EndpointMarginMap,
  TOXIC_ENDPOINT_PREFIXES,
} from "@/utils/safetyMetrics";
import { parseNumericArrayString } from "@/utils/parsing";
import { useDebounce } from "@/hooks";

interface CompoundsViewerProps {
  dataUrl?: string;
  data?: Compound[];
  metadataStatsUrl?: string;
  metadataStatsData?: MetadataStats;
}

type RangeFilterState = Partial<Record<DescriptorKey, RangeFilterValue>>;
type DiscreteFilterState = Partial<Record<DescriptorKey, string>>;

interface FiltersState {
  range: RangeFilterState;
  discrete: DiscreteFilterState;
}

interface EmbeddingPointBase {
  id: string;
  x: number;
  y: number;
}

const parseEmbeddingCsv = (
  csvText: string,
  ids: string[]
): EmbeddingPointBase[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const body = lines.slice(1);
  const total = Math.min(body.length, ids.length);
  const points: EmbeddingPointBase[] = [];

  for (let index = 0; index < total; index += 1) {
    const row = body[index];
    const segments = row.split(",");
    const rawId = segments[0]?.trim();
    const xValue = Number(segments[1]);
    const yValue = Number(segments[2]);

    if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
      continue;
    }

    const fallbackId = ids[index];
    const identifier = rawId && rawId.length > 0 ? rawId : fallbackId;
    points.push({
      id: identifier,
      x: xValue,
      y: yValue,
    });
  }

  return points;
};

const EMBEDDING_OPTIONS: EmbeddingWeightOption[] = Array.from(
  { length: 11 },
  (_, index) => ({
    index,
    weight: index / 10,
    label: `${(index / 10).toFixed(1)}`,
    url: `/emb_${index}.csv`,
  })
);

const RANGE_FILTERS: RangeFilterConfig[] = [
  { key: "mw", label: "MW", unit: "Da", step: 1, decimals: 0 },
  { key: "logp", label: "logP", step: 0.01, decimals: 2 },
  { key: "tpsa", label: "TPSA", unit: "A^2", step: 1, decimals: 0 },
  { key: "qed_value", label: "QED", step: 0.01, decimals: 2 },
  { key: "sas_score", label: "SAS", step: 0.01, decimals: 2 },
];

const HISTOGRAM_KEYS: DescriptorKey[] = [
  "mw",
  "logp",
  "tpsa",
  "qed_value",
  "sas_score",
  "logd",
  "hbd",
  "hba",
  "fcsp3",
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
  const [embeddingIds, setEmbeddingIds] = useState<string[] | null>(null);
  const [embeddingPoints, setEmbeddingPoints] = useState<
    EmbeddingPoint[] | null
  >(null);
  const [embeddingBasePoints, setEmbeddingBasePoints] = useState<
    EmbeddingPointBase[] | null
  >(null);
  const embeddingCache = useRef<Map<number, EmbeddingPointBase[]>>(new Map());
  const [embeddingSelection, setEmbeddingSelection] = useState<string[]>([]);
  const [embeddingWeightIndex, setEmbeddingWeightIndex] = useState<number>(5);
  const [embeddingLoading, setEmbeddingLoading] = useState<boolean>(false);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState<boolean>(false);
  const [therapeuticDose, setTherapeuticDose] = useState<number>(1.0);
  const [doseRange, setDoseRange] = useState<{
    min: number;
    max: number;
  } | null>(null);

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

        if (Array.isArray(dataset) && dataset.length > 0) {
          const doseValues = parseNumericArrayString(dataset[0]?.doses);
          if (doseValues && doseValues.length > 0) {
            const min = Math.min(...doseValues);
            const max = Math.max(...doseValues);
            setDoseRange({ min, max });
            setTherapeuticDose((previous) => {
              return Math.min(Math.max(previous, min), max);
            });
          }
        }
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
    if (!embeddingModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEmbeddingModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [embeddingModalOpen]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const originalOverflow = document.body.style.overflow;

    if (embeddingModalOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [embeddingModalOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadIds = async () => {
      try {
        const response = await fetch("/ids.txt");
        if (!response.ok) {
          throw new Error(
            `Failed to fetch embedding ids: ${response.status} ${response.statusText}`
          );
        }

        const text = await response.text();
        if (cancelled) {
          return;
        }

        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        setEmbeddingIds(lines);
      } catch (err) {
        if (!cancelled) {
          setEmbeddingError(
            err instanceof Error
              ? err.message
              : "Failed to load embedding identifiers"
          );
        }
      }
    };

    loadIds();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const compoundMargins = useMemo(() => {
    const map = new Map<
      string,
      { aggregate: number | null; endpoints: EndpointMarginMap }
    >();

    if (therapeuticDose <= 0) {
      return map;
    }

    compounds.forEach((compound) => {
      const aggregate = calculateAggregateMargin(compound, therapeuticDose);
      const endpoints: EndpointMarginMap = {};
      TOXIC_ENDPOINT_PREFIXES.forEach((prefix) => {
        endpoints[prefix] = calculateEndpointMargin(
          compound,
          prefix,
          therapeuticDose
        );
      });
      map.set(compound.name, { aggregate, endpoints });
    });

    return map;
  }, [compounds, therapeuticDose]);

  const compoundByName = useMemo(() => {
    return new Map(compounds.map((compound) => [compound.name, compound]));
  }, [compounds]);

  const decorateEmbeddingPoints = useCallback(
    (basePoints: EmbeddingPointBase[]): EmbeddingPoint[] => {
      return basePoints.map((basePoint) => {
        const compound = compoundByName.get(basePoint.id);
        const marginData = compound
          ? compoundMargins.get(compound.name)
          : undefined;

        return {
          ...basePoint,
          compound,
          safetyMetric: marginData?.aggregate ?? null,
        };
      });
    },
    [compoundByName, compoundMargins]
  );

  useEffect(() => {
    if (!embeddingIds || embeddingIds.length === 0) {
      return;
    }

    if (compounds.length === 0) {
      return;
    }

    let cancelled = false;

    const loadEmbedding = async () => {
      const option = EMBEDDING_OPTIONS[embeddingWeightIndex];
      if (!option) {
        return;
      }

      const cachedBase = embeddingCache.current.get(option.index);
      if (cachedBase) {
        if (!cancelled) {
          setEmbeddingBasePoints(cachedBase);
          setEmbeddingSelection((previous) =>
            previous.filter((id) => cachedBase.some((point) => point.id === id))
          );
        }
        return;
      }

      setEmbeddingLoading(true);
      setEmbeddingError(null);

      try {
        const response = await fetch(option.url);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch embedding: ${response.status} ${response.statusText}`
          );
        }

        const csvText = await response.text();
        if (cancelled) {
          return;
        }

        const parsedBase = parseEmbeddingCsv(csvText, embeddingIds);
        embeddingCache.current.set(option.index, parsedBase);

        if (!cancelled) {
          setEmbeddingBasePoints(parsedBase);
          setEmbeddingSelection((previous) =>
            previous.filter((id) => parsedBase.some((point) => point.id === id))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setEmbeddingError(
            err instanceof Error ? err.message : "Failed to load embedding"
          );
        }
      } finally {
        if (!cancelled) {
          setEmbeddingLoading(false);
        }
      }
    };

    loadEmbedding();

    return () => {
      cancelled = true;
    };
  }, [compounds.length, embeddingIds, embeddingWeightIndex]);

  useEffect(() => {
    if (!embeddingBasePoints) {
      setEmbeddingPoints(null);
      return;
    }

    const decorated = decorateEmbeddingPoints(embeddingBasePoints);
    setEmbeddingPoints(decorated);
  }, [decorateEmbeddingPoints, embeddingBasePoints]);

  const embeddingSelectionSet = useMemo(() => {
    return new Set(embeddingSelection);
  }, [embeddingSelection]);

  const filteredCompounds = useMemo(() => {
    const appliesEmbeddingFilter = embeddingSelection.length > 0;

    return compounds.filter((compound) => {
      if (appliesEmbeddingFilter && !embeddingSelectionSet.has(compound.name)) {
        return false;
      }

      if (!filters) {
        return true;
      }

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
  }, [
    compounds,
    embeddingSelection.length,
    embeddingSelectionSet,
    filters,
    metadataStats,
  ]);

  const histogramData = useMemo(() => {
    if (compounds.length === 0 || !metadataStats) {
      return null;
    }

    const BIN_COUNT = 24;
    const result: Partial<Record<DescriptorKey, number[]>> = {};

    HISTOGRAM_KEYS.forEach((key) => {
      const stats = metadataStats[key];
      if (!stats) {
        return;
      }

      const min = stats.min;
      const max = stats.max;
      if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
        return;
      }

      const range = max - min;
      const bins = new Array(BIN_COUNT).fill(0);

      compounds.forEach((compound) => {
        const rawValue = compound[key as keyof Compound];
        if (typeof rawValue !== "number") {
          return;
        }

        const normalized = (rawValue - min) / range;
        if (Number.isNaN(normalized) || !Number.isFinite(normalized)) {
          return;
        }

        const clamped = Math.min(
          BIN_COUNT - 1,
          Math.max(0, Math.floor(normalized * BIN_COUNT))
        );
        bins[clamped] += 1;
      });

      const maxCount = Math.max(...bins);
      result[key] = maxCount > 0 ? bins.map((value) => value / maxCount) : bins;
    });

    return result;
  }, [compounds, metadataStats]);

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
  }, [
    rowVirtualizer,
    filteredCompounds.length,
    filters,
    embeddingSelection.length,
  ]);

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

  const handleEmbeddingSelectionChange = useCallback((ids: string[]) => {
    setEmbeddingSelection(ids);
  }, []);

  const handleEmbeddingWeightChange = useCallback((index: number) => {
    setEmbeddingWeightIndex(index);
  }, []);

  const closeEmbeddingModal = useCallback(() => {
    setEmbeddingModalOpen(false);
  }, []);

  const handleTherapeuticDoseChange = useCallback(
    (dose: number) => {
      if (!doseRange) {
        setTherapeuticDose(dose);
        return;
      }

      const clamped = Math.min(Math.max(dose, doseRange.min), doseRange.max);
      setTherapeuticDose(clamped);
    },
    [doseRange]
  );

  // Debounced version of the dose change handler for the slider
  const { pendingValue: pendingDose, scheduleChange: scheduleDoseChange } =
    useDebounce(therapeuticDose, 200, handleTherapeuticDoseChange);

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

      <CompoundsFilters
        rangeFilters={RANGE_FILTERS}
        discreteFilters={DISCRETE_FILTERS}
        filters={filters}
        metadataStats={metadataStats}
        histogramData={histogramData}
        onRangeChange={handleRangeChange}
        onDiscreteChange={handleDiscreteChange}
        onResetFilters={handleResetFilters}
      />
      <div className="flex gap-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex-1">
          <EmbeddingExplorerControl
            embeddingWeightIndex={embeddingWeightIndex}
            embeddingSelection={embeddingSelection}
            embeddingError={embeddingError}
            embeddingOptions={EMBEDDING_OPTIONS}
            onOpenModal={() => setEmbeddingModalOpen(true)}
            onClearSelection={() => handleEmbeddingSelectionChange([])}
          />
        </div>
        <div className="flex-1">
          <TherapeuticDoseControl
            therapeuticDose={therapeuticDose}
            pendingDose={pendingDose}
            doseRange={doseRange}
            onDoseChange={handleTherapeuticDoseChange}
            onScheduleDoseChange={scheduleDoseChange}
          />
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
                const marginData = compoundMargins.get(compound.name);

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
                        therapeuticDose={therapeuticDose}
                        aggregateMargin={marginData?.aggregate ?? null}
                        endpointMargins={marginData?.endpoints}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <EmbeddingModal
        isOpen={embeddingModalOpen}
        onClose={closeEmbeddingModal}
        options={EMBEDDING_OPTIONS}
        currentIndex={embeddingWeightIndex}
        onWeightChange={handleEmbeddingWeightChange}
        onSelectionChange={handleEmbeddingSelectionChange}
        selectedIds={embeddingSelection}
        points={embeddingPoints}
        loading={embeddingLoading}
        error={embeddingError}
        totalCompounds={compounds.length}
        selectedDoseValue={therapeuticDose}
      />
    </div>
  );
};

export default CompoundsViewer;
