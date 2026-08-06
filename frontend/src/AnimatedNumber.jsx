import { useEffect, useRef, useState } from 'react';

// Smoothly tweens the displayed number whenever `value` changes, instead of
// snapping straight to the new figure. Gives balances a satisfying "count up
// or down" feel after a deposit, withdrawal, or transfer.
export default function AnimatedNumber({
  value,
  prefix = '',
  decimals = 2,
  duration = 700,
  className = '',
}) {
  const numericValue = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(numericValue);
  const fromRef = useRef(numericValue);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = numericValue;

    if (from === to) {
      setDisplay(to);
      return undefined;
    }

    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericValue, duration]);

  return (
    <span className={className}>
      {prefix}
      {display.toFixed(decimals)}
    </span>
  );
}
