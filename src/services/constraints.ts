import { SVD, Matrix, EigenvalueDecomposition } from 'ml-matrix';
import { Configuration, ConstraintData } from '../types';

/**
 * Build the contact constraint Jacobian matrix A(c).
 * 
 * For each contact (i, j), we have one row:
 *   row_k = [..., -u_ij_x, -u_ij_y, ..., u_ij_x, u_ij_y, ...]
 * 
 * where u_ij = (c_j - c_i) / ||c_j - c_i|| is the unit direction vector.
 * 
 * A(c) ∈ R^{m × 2n} where m = number of contacts, n = number of disks.
 */
export function buildContactMatrix(config: Configuration): number[][] {
  const { n, positions, contacts } = config;
  const cols = 2 * n;
  const A: number[][] = [];

  for (const [i, j] of contacts) {
    const row = new Array(cols).fill(0);

    const dx = positions[j][0] - positions[i][0];
    const dy = positions[j][1] - positions[i][1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1e-15) {
      throw new Error(`Disks ${i} and ${j} have coincident centers`);
    }

    const ux = dx / dist;
    const uy = dy / dist;

    // -u_ij at positions for disk i
    row[2 * i] = -ux;
    row[2 * i + 1] = -uy;

    // +u_ij at positions for disk j
    row[2 * j] = ux;
    row[2 * j + 1] = uy;

    A.push(row);
  }

  return A;
}

/**
 * Compute the rolling space basis — ker(A).
 * 
 * We compute the eigendecomposition of A^T A (which is 2n × 2n, symmetric PSD).
 * The eigenvectors with eigenvalue ≈ 0 span the null space of A.
 * This always gives a full (2n × 2n) eigenvector matrix, so we never
 * miss null space columns.
 */
export function rollingSpaceBasis(
  A: number[][],
  tolerance: number = 1e-10
): number[][] {
  if (A.length === 0) {
    return [];
  }

  const rows = A.length;
  const cols = A[0].length;

  const matA = new Matrix(A);
  const AtA = matA.transpose().mmul(matA); // (2n × 2n) symmetric PSD

  const eig = new EigenvalueDecomposition(AtA);
  const eigenvalues = eig.realEigenvalues; // length = 2n
  const V = eig.eigenvectorMatrix; // (2n × 2n)

  console.log(`[Constraints] A is ${rows}x${cols}`);
  console.log(`[Constraints] A^T A eigenvalues: [${eigenvalues.map(s => s.toFixed(8)).join(', ')}]`);

  // Find null space: eigenvectors where eigenvalue ≈ 0
  const nullIndices: number[] = [];
  for (let i = 0; i < eigenvalues.length; i++) {
    if (Math.abs(eigenvalues[i]) < tolerance) {
      nullIndices.push(i);
    }
  }

  console.log(`[Constraints] Null space indices: [${nullIndices.join(', ')}], dim = ${nullIndices.length}`);

  if (nullIndices.length === 0) {
    console.warn('[Constraints] No null space found! All eigenvalues are non-zero.');
    return Array.from({ length: cols }, () => []);
  }

  // Extract columns of V corresponding to null space
  const R: number[][] = [];
  for (let row = 0; row < V.rows; row++) {
    const r: number[] = [];
    for (const colIdx of nullIndices) {
      r.push(V.get(row, colIdx));
    }
    R.push(r);
  }

  console.log(`[Constraints] Rolling space Z (${R.length}x${R[0]?.length || 0}):`);
  for (let i = 0; i < R.length; i++) {
    console.log(`  Z[${i}] = [${R[i].map(v => v.toFixed(6)).join(', ')}]`);
  }

  // Verify: A * Z should be ~0
  const matZ = new Matrix(R);
  const AZ = matA.mmul(matZ);
  const azArr = AZ.to2DArray();
  const maxAZ = Math.max(...azArr.flat().map(Math.abs));
  console.log(`[Constraints] Verification: max|A*Z| = ${maxAZ.toExponential(4)} (should be ~0)`);

  return R;
}

/**
 * Compute the full constraint data for a configuration.
 */
export function computeConstraints(config: Configuration): ConstraintData {
  const contactMatrix = buildContactMatrix(config);
  const rollingMatrix = rollingSpaceBasis(contactMatrix);

  // Dimension = number of columns in the rolling matrix (degrees of freedom)
  const dimension = rollingMatrix.length > 0 ? rollingMatrix[0].length : 0;

  return {
    contactMatrix,
    rollingMatrix,
    dimension,
  };
}
