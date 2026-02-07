import * as math from 'mathjs';
import { Configuration, AnalysisResult } from '../types';
import { checkGraphValidity } from './contactGraphs';
import { computeConstraints } from './constraints';
import { computePerimeter } from './perimeter';
import { computeHessian } from './hessian';

/**
 * Check if the projected gradient is (approximately) zero,
 * indicating a critical point of the perimeter on the constraint manifold.
 */
function isCriticalPoint(
  gradient: number[],
  rollingMatrix: number[][],
  tolerance: number = 1e-8
): boolean {
  // Guard: if rolling space is empty, any point is trivially critical
  if (rollingMatrix.length === 0 || rollingMatrix[0].length === 0) {
    return true;
  }

  // Compute projected gradient: projGrad = R^T @ gradient
  const matR = math.matrix(rollingMatrix);
  const Rt = math.transpose(matR);
  const gradVec = math.matrix(gradient);
  const projected = math.multiply(Rt, gradVec);
  const projArray = (projected as math.Matrix).toArray() as number[];

  // Check if all components are near zero
  return projArray.every((v) => Math.abs(v) < tolerance);
}

/**
 * Generate a human-readable summary of the analysis.
 */
function generateSummary(result: Omit<AnalysisResult, 'summary'>): string {
  const { configuration: config, constraints, perimeter, hessian, graphValidation } = result;
  const lines: string[] = [];

  lines.push(`Configuration: ${config.n} disks, ${config.contacts.length} contacts`);
  lines.push(`Graph valid: ${graphValidation.isValid} — ${graphValidation.message}`);
  lines.push(`Rolling space dimension: ${constraints.dimension}`);
  lines.push(`  Rigid: ${constraints.dimension <= 3 ? 'Yes' : 'No'}`);
  lines.push(`Perimeter (disks): ${perimeter.perimeter.toFixed(6)}`);

  const isCritical = isCriticalPoint(perimeter.gradient, constraints.rollingMatrix);
  lines.push(`Critical point: ${isCritical ? 'Yes' : 'No'}`);

  lines.push(`Eigenvalues of intrinsic Hessian:`);
  for (let i = 0; i < hessian.eigenvalues.length; i++) {
    lines.push(`  λ_${i}: ${hessian.eigenvalues[i].toExponential(6)}`);
  }

  lines.push(`Morse index: ${hessian.indexMorseCritical}`);
  lines.push(`Local minimum: ${hessian.isLocalMinimum ? 'Yes' : 'No'}`);

  return lines.join('\n');
}

/**
 * Run the full analysis pipeline for a configuration.
 * 
 * Pipeline:
 *   1. Validate contact graph
 *   2. Build contact matrix and rolling space
 *   3. Compute perimeter and gradient
 *   4. Compute intrinsic Hessian
 *   5. Compute eigenvalues and Morse index
 *   6. Generate summary
 */
export function analyzeConfiguration(config: Configuration): AnalysisResult {
  // Step 1: Validate graph
  const graphValidation = checkGraphValidity(config);

  // Step 2: Constraints
  const constraints = computeConstraints(config);

  // Step 3: Perimeter
  const perimeter = computePerimeter(config);

  // Step 4-5: Hessian
  const hessian = computeHessian(config, constraints.rollingMatrix);

  // Step 6: Summary
  const partialResult = {
    configuration: config,
    graphValidation,
    constraints,
    perimeter,
    hessian,
  };
  const summary = generateSummary(partialResult);

  return { ...partialResult, summary };
}

/**
 * Analyze a configuration by name (loads from catalog).
 */
export { loadConfiguration } from './jsonLoader';
