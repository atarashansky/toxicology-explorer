import React from "react";
import { formatDose } from "@/utils/formatting";

interface TherapeuticDoseControlProps {
  therapeuticDose: number;
  pendingDose: number | null;
  doseRange: { min: number; max: number } | null;
  onDoseChange: (dose: number) => void;
  onScheduleDoseChange: (dose: number) => void;
}

const TherapeuticDoseControl: React.FC<TherapeuticDoseControlProps> = ({
  therapeuticDose,
  pendingDose,
  doseRange,
  onDoseChange,
  onScheduleDoseChange,
}) => {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 text-sm text-gray-700">
            <div className="text-base font-semibold text-gray-900">
              Therapeutic Dose
            </div>
            <p>Adjust to evaluate safety margins (LD50 ÷ dose).</p>
            <div className="text-xs text-gray-500">
              Range:{" "}
              {doseRange
                ? `${formatDose(doseRange.min)} – ${formatDose(doseRange.max)}`
                : "Loading…"}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-2/3">
            <div className="flex items-center justify-between text-sm text-gray-700">
              <span>Selected dose</span>
              <span className="font-semibold text-gray-900">
                {pendingDose != null ? formatDose(pendingDose) : "—"}
              </span>
            </div>
            <input
              type="range"
              min={doseRange?.min ?? 0}
              max={doseRange?.max ?? 1}
              step={
                ((doseRange?.max ?? 1) - (doseRange?.min ?? 0)) / 200 || 0.01
              }
              value={pendingDose ?? doseRange?.min ?? 0}
              onChange={(event) =>
                onScheduleDoseChange(Number(event.target.value))
              }
              className="w-full"
              disabled={!doseRange}
            />
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <input
                type="number"
                value={pendingDose ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw.trim() === "") {
                    return;
                  }
                  const value = Number(raw);
                  if (Number.isNaN(value)) {
                    return;
                  }
                  onScheduleDoseChange(value);
                }}
                className="w-32 rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                min={doseRange?.min}
                max={doseRange?.max}
                step={0.01}
                disabled={!doseRange}
              />
              <span className="text-xs text-gray-500">
                Enter an exact dose to inspect margin sensitivity.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapeuticDoseControl;
