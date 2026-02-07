import React, { useMemo } from 'react';
import KaTeX from './KaTeX';

interface MatrixDisplayProps {
  matrix: number[][];
  label?: string;
  precision?: number;
}

/**
 * Attempt to express a float as a simple fraction or sqrt expression for LaTeX.
 * Recognizes: 0, ±1, ±1/2, ±√3/2, ±√2/2, and their negatives.
 */
function toLatexFraction(val: number): string {
  const tol = 1e-6;

  if (Math.abs(val) < tol) return '0';
  if (Math.abs(val - 1) < tol) return '1';
  if (Math.abs(val + 1) < tol) return '-1';
  if (Math.abs(val - 0.5) < tol) return '\\frac{1}{2}';
  if (Math.abs(val + 0.5) < tol) return '-\\frac{1}{2}';
  if (Math.abs(val - Math.sqrt(3) / 2) < tol) return '\\frac{\\sqrt{3}}{2}';
  if (Math.abs(val + Math.sqrt(3) / 2) < tol) return '-\\frac{\\sqrt{3}}{2}';
  if (Math.abs(val - Math.sqrt(2) / 2) < tol) return '\\frac{\\sqrt{2}}{2}';
  if (Math.abs(val + Math.sqrt(2) / 2) < tol) return '-\\frac{\\sqrt{2}}{2}';
  if (Math.abs(val - Math.sqrt(3)) < tol) return '\\sqrt{3}';
  if (Math.abs(val + Math.sqrt(3)) < tol) return '-\\sqrt{3}';
  if (Math.abs(val - 1 / 3) < tol) return '\\frac{1}{3}';
  if (Math.abs(val + 1 / 3) < tol) return '-\\frac{1}{3}';
  if (Math.abs(val - 2 / 3) < tol) return '\\frac{2}{3}';
  if (Math.abs(val + 2 / 3) < tol) return '-\\frac{2}{3}';
  if (Math.abs(val - 1.5) < tol) return '\\frac{3}{2}';
  if (Math.abs(val + 1.5) < tol) return '-\\frac{3}{2}';

  // Fall back to decimal
  // Remove trailing zeros
  const s = val.toFixed(4).replace(/\.?0+$/, '');
  return s;
}

const MatrixDisplay: React.FC<MatrixDisplayProps> = ({
  matrix,
  label,
}) => {
  const latex = useMemo(() => {
    if (!matrix || matrix.length === 0) return '';
    const rows = matrix.map((row) =>
      row.map((val) => toLatexFraction(val)).join(' & ')
    );
    const matBody = rows.join(' \\\\ ');
    return `A = \\begin{pmatrix} ${matBody} \\end{pmatrix}`;
  }, [matrix]);

  if (!matrix || matrix.length === 0) return <p>Matriz vacía</p>;

  return (
    <div className="matrix-display">
      <KaTeX math={latex} displayMode={true} />
      <p className="text-muted" style={{ fontSize: '0.85em', marginTop: 8 }}>
        Dimensión: {matrix.length} × {matrix[0]?.length || 0}
      </p>
    </div>
  );
};

export default MatrixDisplay;
