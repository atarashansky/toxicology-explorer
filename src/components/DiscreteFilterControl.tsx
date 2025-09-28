import React from "react";
import { DescriptorKey } from "@/types/MetadataStats";

export interface DiscreteOption {
  value: string;
  label: string;
  predicate: (value: number | undefined) => boolean;
}

export interface DiscreteFilterConfig {
  key: DescriptorKey;
  label: string;
  options: DiscreteOption[];
}

interface DiscreteFilterControlProps {
  config: DiscreteFilterConfig;
  value?: string;
  onChange: (value: string) => void;
}

const DiscreteFilterControl: React.FC<DiscreteFilterControlProps> = ({
  config,
  value,
  onChange,
}) => {
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

export default DiscreteFilterControl;
