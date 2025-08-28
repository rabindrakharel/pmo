import { useEffect, useRef } from 'react';

/**
 * Custom hook to get the previous value of a state or prop
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  });

  return ref.current;
}
