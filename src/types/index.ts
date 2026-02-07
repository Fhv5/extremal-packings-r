// =============================================
// Core mathematical types for extremal packings
// =============================================

/** A 2D point [x, y] */
export type Point = [number, number];

/** A contact pair [i, j] where i < j are disk indices */
export type Contact = [number, number];

/** 
 * A packing configuration: positions and radii of disks 
 * on a flat torus with fundamental domain [-1/2, 1/2]^2
 */
export interface Configuration {
  n: number;                  // number of disks
  positions: Point[];         // center positions
  radii: number[];            // disk radii
  contacts: Contact[];        // contact pairs
  latticeContacts: Contact[]; // contacts through lattice translation
  latticeShifts: Point[];     // translation vectors for lattice contacts
}

/** Result of contact graph validation */
export interface GraphValidation {
  isValid: boolean;
  expectedEdges: number;
  actualEdges: number;
  message: string;
}

/** Contact matrix and related constraint data */
export interface ConstraintData {
  contactMatrix: number[][];       // Jacobian of contact constraints
  rollingMatrix: number[][];       // rolling space basis
  dimension: number;               // degrees of freedom
}

/** Perimeter computation result */
export interface PerimeterResult {
  perimeter: number;
  gradient: number[];
}

/** Hessian analysis result */
export interface HessianResult {
  hessian: number[][];
  eigenvalues: number[];
  eigenvectors: number[][];
  isLocalMinimum: boolean;
  indexMorseCritical: number;
}

/** Full analysis result for a configuration */
export interface AnalysisResult {
  configuration: Configuration;
  graphValidation: GraphValidation;
  constraints: ConstraintData;
  perimeter: PerimeterResult;
  hessian: HessianResult;
  summary: string;
}