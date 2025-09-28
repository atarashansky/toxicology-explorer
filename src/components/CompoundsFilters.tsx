import React from "react";
import RangeFilterControl, {
  RangeFilterValue,
  RangeFilterConfig,
} from "./RangeFilterControl";
import DiscreteFilterControl, {
  DiscreteFilterConfig,
} from "./DiscreteFilterControl";
import { DescriptorKey, MetadataStats } from "@/types/MetadataStats";

interface CompoundsFiltersProps {
  rangeFilters: RangeFilterConfig[];
  discreteFilters: DiscreteFilterConfig[];
  filters: {
    range: Partial<Record<DescriptorKey, RangeFilterValue>>;
    discrete: Partial<Record<DescriptorKey, string>>;
  };
  metadataStats: MetadataStats | null;
  histogramData: Partial<Record<DescriptorKey, number[]>> | null;
  onRangeChange: (key: DescriptorKey, value: RangeFilterValue) => void;
  onDiscreteChange: (key: DescriptorKey, value: string) => void;
  onResetFilters: () => void;
}

const CompoundsFilters: React.FC<CompoundsFiltersProps> = ({
  rangeFilters,
  discreteFilters,
  filters,
  metadataStats,
  histogramData,
  onRangeChange,
  onDiscreteChange,
  onResetFilters,
}) => {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Metric Filters</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {rangeFilters.map((config) => {
            const rangeFilter = filters.range[config.key];
            const stats = metadataStats?.[config.key];
            if (!rangeFilter || !stats) {
              return null;
            }
            return (
              <RangeFilterControl
                key={config.key}
                config={config}
                value={rangeFilter}
                stats={stats}
                histogram={histogramData?.[config.key]}
                onChange={(value) => onRangeChange(config.key, value)}
              />
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {discreteFilters.map((config) => (
            <DiscreteFilterControl
              key={config.key}
              config={config}
              value={filters.discrete[config.key]}
              onChange={(value) => onDiscreteChange(config.key, value)}
            />
          ))}
        </div>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Reset filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompoundsFilters;
