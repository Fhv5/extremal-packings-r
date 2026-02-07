import React, { useRef, useEffect } from 'react';

declare global {
  interface Window {
    katex: any;
  }
}

interface KaTeXProps {
  math: string;
  displayMode?: boolean;
  className?: string;
}

const KaTeX: React.FC<KaTeXProps> = ({ math, displayMode = false, className }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current && window.katex) {
      try {
        window.katex.render(math, ref.current, {
          displayMode,
          throwOnError: false,
          trust: true,
        });
      } catch (e) {
        if (ref.current) {
          ref.current.textContent = math;
        }
      }
    }
  }, [math, displayMode]);

  return <span ref={ref} className={className} />;
};

export default KaTeX;
