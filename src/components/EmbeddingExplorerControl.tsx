import React from "react";
import { EmbeddingWeightOption } from "./EmbeddingExplorer";

interface EmbeddingExplorerControlProps {
  embeddingWeightIndex: number;
  embeddingSelection: string[];
  embeddingError: string | null;
  embeddingOptions: EmbeddingWeightOption[];
  onOpenModal: () => void;
  onClearSelection: () => void;
}

const EmbeddingExplorerControl: React.FC<EmbeddingExplorerControlProps> = ({
  embeddingWeightIndex,
  embeddingSelection,
  embeddingError,
  embeddingOptions,
  onOpenModal,
  onClearSelection,
}) => {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2 text-sm text-gray-700">
            <div className="text-base font-semibold text-gray-900">
              Scatter &amp; Lasso Explorer
            </div>
            <div>
              Active weight:{" "}
              {embeddingOptions[embeddingWeightIndex]?.label ?? "–"}
            </div>
            <div>Selected compounds: {embeddingSelection.length}</div>
            {embeddingError ? (
              <div className="rounded border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs text-yellow-800">
                {embeddingError}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenModal}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Open Explorer
            </button>
            {embeddingSelection.length > 0 ? (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Clear selection
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbeddingExplorerControl;
