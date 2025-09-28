export const parseNumericArrayString = (input?: string): number[] | null => {
  if (!input) {
    return null;
  }

  const cleaned = input.replace(/\[/g, " ").replace(/\]/g, " ");
  const tokens = cleaned
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const values = tokens
    .map((token) => Number(token))
    .filter((value) => !Number.isNaN(value));

  return values.length > 0 ? values : null;
};
