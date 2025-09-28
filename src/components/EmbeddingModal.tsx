import React from "react";
import EmbeddingExplorer, {
  EmbeddingPoint,
  EmbeddingWeightOption,
} from "./EmbeddingExplorer";

interface EmbeddingModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: EmbeddingWeightOption[];
  currentIndex: number;
  onWeightChange: (index: number) => void;
  onSelectionChange: (ids: string[]) => void;
  selectedIds: string[];
  points: EmbeddingPoint[] | null;
  loading: boolean;
  error: string | null;
  totalCompounds: number;
  selectedDoseValue: number;
}

const EmbeddingModal: React.FC<EmbeddingModalProps> = ({
  isOpen,
  onClose,
  options,
  currentIndex,
  onWeightChange,
  onSelectionChange,
  selectedIds,
  points,
  loading,
  error,
  totalCompounds,
  selectedDoseValue,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-gray-900/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scatter & Lasso Explorer"
        className="relative z-10 w-full max-w-6xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Scatter &amp; Lasso Explorer
              </h2>
              <p className="text-sm text-gray-500">
                Blend structure and response embeddings, then lasso to focus the
                table below.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close scatter explorer"
            >
              Close
            </button>
          </div>
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-6">
            <EmbeddingExplorer
              options={options}
              currentIndex={currentIndex}
              onWeightChange={onWeightChange}
              onSelectionChange={onSelectionChange}
              selectedIds={selectedIds}
              points={points}
              loading={loading}
              error={error}
              totalCompounds={totalCompounds}
              selectedDoseValue={selectedDoseValue}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbeddingModal;
