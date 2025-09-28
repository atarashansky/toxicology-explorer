import { useEffect, useRef, useState } from "react";

/**
 * Custom hook that debounces a value with a specified delay.
 * Useful for preventing excessive API calls or state updates during rapid user input.
 *
 * @param value - The current value to debounce
 * @param delay - The delay in milliseconds before calling onChange
 * @param onChange - The callback function to call after the delay
 * @returns Object with pendingValue (current debounced value) and scheduleChange (function to update the value)
 */
export function useDebounce<T>(
  value: T,
  delay: number,
  onChange: (value: T) => void
) {
  const [pendingValue, setPendingValue] = useState<T>(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setPendingValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const scheduleChange = (nextValue: T) => {
    if (nextValue === pendingValue) {
      return;
    }

    setPendingValue(nextValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(nextValue);
      debounceRef.current = null;
    }, delay);
  };

  return { pendingValue, scheduleChange };
}
