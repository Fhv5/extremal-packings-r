import { Matrix, SVD, EigenvalueDecomposition } from 'ml-matrix';
import * as math from 'mathjs';
import { Configuration, HessianResult } from '../types';
import { convexHullIndices, isCollinear, perimeterGradient } from './perimeter';
import { buildContactMatrix } from './constraints';

/**
 * Compute the 2x2 block M = (1/dist) * (I - t * t^T)
 */
function computeEdgeBlock(t: [number, number], dist: number): number[][] {
  const tx = t[0], ty = t[1];
  return [
    [(1 - tx * tx) / dist, (-tx * ty) / dist],
    [(-tx * ty) / dist, (1 - ty * ty) / dist],
  ];
}

function addBlock(H: number[][], block: number[][], row: number, col: number, sign: number): void {
  H[2 * row][2 * col] += sign * block[0][0];
  H[2 * row][2 * col + 1] += sign * block[0][1];
  H[2 * row + 1][2 * col] += sign * block[1][0];
  H[2 * row + 1][2 * col + 1] += sign * block[1][1];
}

function buildEuclideanHessian(config: Configuration): number[][] {
  const dim = 2 * config.n;
  const H = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const hull = convexHullIndices(config.positions);

  if (isCollinear(config.positions)) {
    let maxDist = 0, endA = hull[0], endB = hull[1];
    for (let i = 0; i < hull.length; i++) {
      for (let j = i + 1; j < hull.length; j++) {
        const pi = config.positions[hull[i]];
        const pj = config.positions[hull[j]];
        const d = Math.sqrt((pj[0] - pi[0]) ** 2 + (pj[1] - pi[1]) ** 2);
        if (d > maxDist) { maxDist = d; endA = hull[i]; endB = hull[j]; }
      }
    }

    if (maxDist > 1e-15) {
      const dx = config.positions[endB][0] - config.positions[endA][0];
      const dy = config.positions[endB][1] - config.positions[endA][1];
      const t: [number, number] = [dx / maxDist, dy / maxDist];
      const block = computeEdgeBlock(t, maxDist);
      const scaledBlock = block.map(r => r.map(v => 2 * v));
      addBlock(H, scaledBlock, endA, endA, 1);
      addBlock(H, scaledBlock, endB, endB, 1);
      addBlock(H, scaledBlock, endA, endB, -1);
      addBlock(H, scaledBlock, endB, endA, -1);
    }
    return H;
  }

  for (let k = 0; k < hull.length; k++) {
    const u = hull[k];
    const v = hull[(k + 1) % hull.length];
    const dx = config.positions[v][0] - config.positions[u][0];
    const dy = config.positions[v][1] - config.positions[u][1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-15) continue;

    const t: [number, number] = [dx / dist, dy / dist];
    const block = computeEdgeBlock(t, dist);
    addBlock(H, block, u, u, 1);
    addBlock(H, block, v, v, 1);
    addBlock(H, block, u, v, -1);
    addBlock(H, block, v, u, -1);
  }

  return H;
}

/**
 * Solve A^T * lambda = grad via SVD-based least squares.
 * Equivalent to scipy.linalg.lstsq(A.T, grad).
 * 
 * We solve min ||A^T x - grad||_2 using the SVD of A^T.
 */
function solveLagrangeMultipliers(A: number[][], gradient: number[]): number[] {
  if (A.length === 0) return [];

  const At = new Matrix(A).transpose(); // (2n x m)
  const b = Matrix.columnVector(gradient); // (2n x 1)

  // Do NOT use autoTranspose — it swaps U/V
  const svd = new SVD(At);
  const U = svd.leftSingularVectors;
  const S = svd.diagonal;
  const V = svd.rightSingularVectors;

  const Utb = U.transpose().mmul(b);

  const tol = 1e-10 * Math.max(...S);
  const m = A.length;
  const result = new Array(m).fill(0);

  for (let i = 0; i < Math.min(S.length, m); i++) {
    if (S[i] > tol) {
      const coeff = Utb.get(i, 0) / S[i];
      for (let j = 0; j < m; j++) {
        result[j] += V.get(j, i) * coeff;
      }
    }
  }

  return result;
}

function buildGeometricHessian(config: Configuration, lambdas: number[]): number[][] {
  const dim = 2 * config.n;
  const H = Array.from({ length: dim }, () => new Array(dim).fill(0));

  config.contacts.forEach(([i, j], idx) => {
    const dx = config.positions[j][0] - config.positions[i][0];
    const dy = config.positions[j][1] - config.positions[i][1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-15) return;

    const ux = dx / dist;
    const uy = dy / dist;
    const lam = lambdas[idx];

    // K = -(lambda / 2) * (I - u u^T)
    // Using /2 explicitly as in the paper (dist between contacts = 2r = 2 for r=1)
    const factor = -lam / 2.0;
    const block = [
      [factor * (1 - ux * ux), factor * (-ux * uy)],
      [factor * (-ux * uy), factor * (1 - uy * uy)],
    ];

    addBlock(H, block, i, i, 1);
    addBlock(H, block, j, j, 1);
    addBlock(H, block, i, j, -1);
    addBlock(H, block, j, i, -1);
  });

  return H;
}

export function projectToRoll(HAmbient: number[][], R: number[][]): number[][] {
  const matH = new Matrix(HAmbient);
  const matR = new Matrix(R);
  const Rt = matR.transpose();
  const result = Rt.mmul(matH).mmul(matR);
  return result.to2DArray();
}

/**
 * Symmetrize a matrix: H = (H + H^T) / 2
 */
function symmetrize(H: number[][]): number[][] {
  const n = H.length;
  const S = Array.from({ length: n }, (_, i) =>
    new Array(n).fill(0).map((_, j) => (H[i][j] + H[j][i]) / 2)
  );
  return S;
}

/**
 * Compute eigenvalues of a symmetric matrix using ml-matrix's EigenvalueDecomposition.
 * This is equivalent to scipy.linalg.eigh.
 */
export function intrinsicSpectrum(
  H: number[][],
  tolerance: number = 1e-10
): { eigenvalues: number[]; eigenvectors: number[][] } {
  // Symmetrize to remove any floating-point asymmetry
  const sym = symmetrize(H);
  const mat = new Matrix(sym);

  const eig = new EigenvalueDecomposition(mat);
  let eigenvalues = eig.realEigenvalues;
  const eigVecMatrix = eig.eigenvectorMatrix;

  // Clean noise
  eigenvalues = eigenvalues.map((v) => (Math.abs(v) < tolerance ? 0 : v));

  // Sort ascending
  const indices = eigenvalues.map((_, i) => i);
  indices.sort((a, b) => eigenvalues[a] - eigenvalues[b]);

  const sortedValues = indices.map((i) => eigenvalues[i]);

  // Extract eigenvectors as columns
  const sortedVectors: number[][] = indices.map((i) => {
    const col: number[] = [];
    for (let row = 0; row < eigVecMatrix.rows; row++) {
      col.push(eigVecMatrix.get(row, i));
    }
    return col;
  });

  return { eigenvalues: sortedValues, eigenvectors: sortedVectors };
}

export function computeHessian(
  config: Configuration,
  R: number[][],
  _epsilon?: number
): HessianResult {
  const rollDim = R.length > 0 ? R[0].length : 0;

  if (rollDim === 0) {
    console.log('[Hessian] Rolling space is empty (fully rigid). Returning trivial result.');
    return {
      hessian: [],
      eigenvalues: [],
      eigenvectors: [],
      isLocalMinimum: true,
      indexMorseCritical: 0,
    };
  }

  const HEucl = buildEuclideanHessian(config);
  const A = buildContactMatrix(config);
  const grad = perimeterGradient(config);

  console.log('[Hessian] Gradient:', grad.map(v => v.toFixed(6)));

  const lambdas = solveLagrangeMultipliers(A, grad);
  console.log('[Hessian] Lagrange multipliers:', lambdas.map(v => v.toFixed(6)));

  // Verify: A^T * lambda should ≈ grad
  const AtLam = new Array(grad.length).fill(0);
  for (let k = 0; k < A.length; k++) {
    for (let i = 0; i < grad.length; i++) {
      AtLam[i] += A[k][i] * lambdas[k];
    }
  }
  const residual = grad.map((g, i) => g - AtLam[i]);
  const maxResidual = Math.max(...residual.map(Math.abs));
  console.log(`[Hessian] Verify A^T*lambda ≈ grad: max|residual| = ${maxResidual.toExponential(4)}`);

  const HGeom = buildGeometricHessian(config, lambdas);

  const dim = 2 * config.n;
  const HTotal = Array.from({ length: dim }, (_, i) =>
    new Array(dim).fill(0).map((_, j) => HEucl[i][j] + HGeom[i][j])
  );

  // Log diagonal of HTotal for quick check
  console.log('[Hessian] HTotal diagonal:', HTotal.map((row, i) => row[i].toFixed(6)));
  const maxHTotal = Math.max(...HTotal.flat().map(Math.abs));
  console.log(`[Hessian] max|HTotal| = ${maxHTotal.toExponential(4)}`);

  const HRoll = projectToRoll(HTotal, R);

  console.log(`[Hessian] HRoll (${HRoll.length}x${HRoll[0]?.length || 0}):`);
  for (let i = 0; i < HRoll.length; i++) {
    console.log(`  HRoll[${i}] = [${HRoll[i].map(v => v.toFixed(8)).join(', ')}]`);
  }

  // Validate HRoll contains only numeric values
  for (let i = 0; i < HRoll.length; i++) {
    for (let j = 0; j < HRoll[i].length; j++) {
      if (!isFinite(HRoll[i][j])) {
        console.error(`[Hessian] Non-finite value at HRoll[${i}][${j}] = ${HRoll[i][j]}`);
        HRoll[i][j] = 0;
      }
    }
  }

  const { eigenvalues, eigenvectors } = intrinsicSpectrum(HRoll);

  console.log('[Hessian] Intrinsic eigenvalues:', eigenvalues);
  console.log('[Hessian] Rolling space dim:', rollDim);

  const negativeTolerance = 1e-6;
  const indexMorseCritical = eigenvalues.filter((v) => v < -negativeTolerance).length;
  const isLocalMinimum = indexMorseCritical === 0;

  return {
    hessian: HRoll,
    eigenvalues,
    eigenvectors,
    isLocalMinimum,
    indexMorseCritical,
  };
}

export { computeHessian as computeIntrinsicHessian };