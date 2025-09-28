import { Compound } from "@/types/Compound";

export const TOXIC_ENDPOINT_PREFIXES = [
  "cell_count",
  "cyto_area",
  "nuclei_size",
  "vacuoles",
  "mito_puncta",
  "ros",
  "mtt",
  "ldh",
] as const;

export type ToxicEndpointPrefix = (typeof TOXIC_ENDPOINT_PREFIXES)[number];

type ToxicEndpointProperty = `${ToxicEndpointPrefix}_ld50`;

const isValidLdValue = (value: unknown): value is number => {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value !== 10000
  );
};

export const getEndpointLd50 = (
  compound: Compound,
  prefix: ToxicEndpointPrefix
): number | null => {
  const property = `${prefix}_ld50` as ToxicEndpointProperty;
  const raw = compound[property];
  if (!isValidLdValue(raw)) {
    return null;
  }
  return raw as number;
};

export const calculateEndpointMargin = (
  compound: Compound,
  prefix: ToxicEndpointPrefix,
  therapeuticDose: number
): number | null => {
  if (!Number.isFinite(therapeuticDose) || therapeuticDose <= 0) {
    return null;
  }
  const ld50 = getEndpointLd50(compound, prefix);

  if (ld50 == null) {
    return null;
  }
  return ld50 / therapeuticDose;
};

export const calculateAggregateMargin = (
  compound: Compound,
  therapeuticDose: number
): number | null => {
  let minMargin: number | null = null;

  TOXIC_ENDPOINT_PREFIXES.forEach((prefix) => {
    const margin = calculateEndpointMargin(compound, prefix, therapeuticDose);
    if (margin == null) {
      return;
    }
    if (minMargin == null || margin < minMargin) {
      minMargin = margin;
    }
  });

  return minMargin;
};

export const calculateSafetyMetric = (
  compound: Compound,
  therapeuticDose: number
): number => {
  const aggregate = calculateAggregateMargin(compound, therapeuticDose);
  if (aggregate == null || !Number.isFinite(aggregate)) {
    return 0;
  }
  return aggregate;
};

export const classifyMarginLevel = (margin: number | null) => {
  if (margin == null || !Number.isFinite(margin)) {
    return "ALERT" as const;
  }
  if (margin >= 10) {
    return "BROAD" as const;
  }
  if (margin >= 3) {
    return "MODERATE" as const;
  }
  if (margin >= 1) {
    return "NARROW" as const;
  }
  return "ALERT" as const;
};

export type EndpointMarginMap = Partial<
  Record<ToxicEndpointPrefix, number | null>
>;

export const getEndpointMargins = (
  compound: Compound,
  therapeuticDose: number
): EndpointMarginMap => {
  const result: EndpointMarginMap = {};
  TOXIC_ENDPOINT_PREFIXES.forEach((prefix) => {
    result[prefix] = calculateEndpointMargin(compound, prefix, therapeuticDose);
  });
  return result;
};
