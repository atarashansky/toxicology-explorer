export const formatDose = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

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

export const formatResponse = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  if (value >= 1) {
    return value.toFixed(2);
  }
  return value.toPrecision(2);
};
