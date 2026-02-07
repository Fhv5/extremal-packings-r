import { Configuration, Point, Contact } from '../types';

/**
 * Wrap a raw point into the fundamental domain [-1/2, 1/2]^2
 */
export function wrapToFundamentalDomain(p: Point): Point {
  const wrap = (x: number) => x - Math.round(x);
  return [wrap(p[0]), wrap(p[1])];
}

/**
 * Compute the minimum-image distance on the flat torus [-1/2, 1/2]^2
 */
export function torusDistance(a: Point, b: Point): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const wx = dx - Math.round(dx);
  const wy = dy - Math.round(dy);
  return Math.sqrt(wx * wx + wy * wy);
}

/**
 * Compute Euclidean distance between two points (non-torus)
 */
export function euclideanDistance(a: Point, b: Point): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Create a Configuration object from centers, edges, and optional parameters.
 */
export function createConfiguration(
  positions: Point[],
  contacts: Contact[],
  radius: number = 1.0,
  latticeContacts: Contact[] = [],
  latticeShifts: Point[] = []
): Configuration {
  const n = positions.length;
  const radii = Array(n).fill(radius);
  return {
    n,
    positions,
    radii,
    contacts,
    latticeContacts,
    latticeShifts,
  };
}

/**
 * Validate that all contacts have distance ≈ 2*radius between centers.
 * Returns list of invalid contacts with their actual distances.
 */
export function validateContacts(
  config: Configuration,
  tolerance: number = 1e-6,
  useTorus: boolean = false
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const distFn = useTorus ? torusDistance : euclideanDistance;

  for (const [i, j] of config.contacts) {
    if (i < 0 || i >= config.n || j < 0 || j >= config.n) {
      errors.push(`Contact (${i},${j}): index out of range [0, ${config.n - 1}]`);
      continue;
    }
    const expectedDist = config.radii[i] + config.radii[j];
    const actualDist = distFn(config.positions[i], config.positions[j]);
    if (Math.abs(actualDist - expectedDist) > tolerance) {
      errors.push(
        `Contact (${i},${j}): expected dist ${expectedDist.toFixed(6)}, got ${actualDist.toFixed(6)}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Compute the degree (number of contacts) for each disk.
 */
export function computeDegrees(config: Configuration): number[] {
  const degrees = Array(config.n).fill(0);
  for (const [i, j] of config.contacts) {
    degrees[i]++;
    degrees[j]++;
  }
  for (const [i, j] of config.latticeContacts) {
    degrees[i]++;
    degrees[j]++;
  }
  return degrees;
}

/**
 * Compute the unit direction vector from disk i to disk j.
 */
export function contactDirection(
  config: Configuration,
  i: number,
  j: number,
  useTorus: boolean = false
): Point {
  let dx = config.positions[j][0] - config.positions[i][0];
  let dy = config.positions[j][1] - config.positions[i][1];

  if (useTorus) {
    dx = dx - Math.round(dx);
    dy = dy - Math.round(dy);
  }

  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1e-15) return [0, 0];
  return [dx / dist, dy / dist];
}
