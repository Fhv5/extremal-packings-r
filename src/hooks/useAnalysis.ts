import { useState, useEffect } from 'react';
import { AnalysisResult } from '../types';
import { loadConfiguration, analyzeConfiguration } from '../services';
import { perimeterOfCenters } from '../services/perimeter';
import { buildContactMatrix } from '../services/constraints';

export interface ExtendedAnalysis {
  result: AnalysisResult;
  perimeterCenters: number;
  contactMatrix: number[][];
  projectedGradient: number[];
  isCritical: boolean;
}

export function useAnalysis(configName: string | undefined) {
  const [data, setData] = useState<ExtendedAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configName) {
      setError('No configuration name provided');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    // Defer heavy work to next macrotask so React can paint the loading state
    const id = requestAnimationFrame(() => {
      setTimeout(() => {
        if (cancelled) return;
        try {
          const config = loadConfiguration(configName);
          const result = analyzeConfiguration(config);
          if (cancelled) return;

          const perimCenters = perimeterOfCenters(config);
          const contactMatrix = buildContactMatrix(config);

          const R = result.constraints.rollingMatrix;
          const grad = result.perimeter.gradient;
          const dim = grad.length;
          const d = R.length > 0 ? R[0].length : 0;

          // Compute R^T * grad (projected gradient in rolling space coordinates)
          const projGrad = new Array(d).fill(0);
          for (let k = 0; k < d; k++) {
            for (let i = 0; i < dim; i++) {
              projGrad[k] += R[i][k] * grad[i];
            }
          }

          const isCritical = projGrad.every((v) => Math.abs(v) < 1e-8);

          if (!cancelled) {
            setData({
              result,
              perimeterCenters: perimCenters,
              contactMatrix,
              projectedGradient: projGrad,
              isCritical,
            });
          }
        } catch (e: any) {
          if (!cancelled) setError(e.message || 'Unknown error');
        } finally {
          if (!cancelled) setLoading(false);
        }
      }, 0);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [configName]);

  return { data, loading, error };
}
