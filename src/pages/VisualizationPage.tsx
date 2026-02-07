import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAnalysis } from '../hooks/useAnalysis';
import { DiskPlot, CollapsibleBox, MatrixDisplay, KaTeX } from '../components';
import { euclideanDistance } from '../services/configurations';

/**
 * Convert a float to a nice LaTeX fraction if possible.
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
  if (Math.abs(val - 1.5) < tol) return '\\frac{3}{2}';
  if (Math.abs(val + 1.5) < tol) return '-\\frac{3}{2}';
  // Decimal fallback
  return val.toFixed(4).replace(/\.?0+$/, '');
}

const VisualizationPage: React.FC = () => {
  const { configName } = useParams<{ configName: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useAnalysis(configName);

  // Format config name as LaTeX: "D3-1" → "\mathcal{D}_{3-1}"
  const titleLatex = useMemo(() => {
    if (!configName) return '';
    const match = configName.match(/D(\d+)-(\d+)/);
    if (match) {
      return `\\mathcal{D}_{${match[1]}-${match[2]}}`;
    }
    return configName;
  }, [configName]);

  // LaTeX for gradient vector
  const gradientLatex = useMemo(() => {
    if (!data) return '';
    const entries = data.result.perimeter.gradient.map((v) => toLatexFraction(v));
    return `\\nabla P = \\left(${entries.join(',\\,')}\\right)`;
  }, [data]);

  // LaTeX for projected gradient
  const projLatex = useMemo(() => {
    if (!data) return '';
    const entries = data.projectedGradient;
    if (entries.length === 0) {
      return 'Z^\\top \\nabla P = \\emptyset \\quad \\text{(espacio trivial)}';
    }
    return `Z^\\top \\nabla P = (${entries.map((v) => toLatexFraction(v)).join(',\\,')})`;
  }, [data]);

  // LaTeX for eigenvalues
  const eigenLatex = useMemo(() => {
    if (!data) return '';
    const entries = data.result.hessian.eigenvalues;
    if (entries.length === 0) {
      return '\\lambda = \\emptyset \\quad \\text{(espacio trivial)}';
    }
    return `\\lambda = (${entries.map((v) => toLatexFraction(v)).join(',\\,')})`;
  }, [data]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <span className="ms-3">Analizando {configName}...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">
          <h4>Error</h4>
          <p>{error || 'No se pudo cargar la configuración'}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </button>
        </div>
      </div>
    );
  }

  const { result, perimeterCenters, contactMatrix, isCritical } = data;
  const config = result.configuration;
  const constraints = result.constraints;
  const perimeter = result.perimeter;
  const hessian = result.hessian;

  return (
    <div className="container-fluid py-4" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="row mb-3">
        <div className="col d-flex align-items-center">
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            <i className="bi bi-arrow-left me-2"></i>Volver a Análisis
          </button>
          <h1 className="d-inline ms-3 mb-0" id="config-title">
            <KaTeX math={titleLatex} displayMode={false} />
          </h1>
        </div>
      </div>

      <div className="row">
        {/* Left column: plot + contact matrix */}
        <div className="col-md-8">
          <div className="plot-container">
            <DiskPlot config={config} showHull showContacts />
          </div>

          {/* Matriz de Contacto A */}
          <CollapsibleBox title="Matriz de Contacto A" defaultOpen={true}>
            <div className="math-content">
              <MatrixDisplay matrix={contactMatrix} />
            </div>
          </CollapsibleBox>
        </div>

        {/* Right column: info panels */}
        <div className="col-md-4">
          {/* Información General */}
          <CollapsibleBox title="Información General" defaultOpen={true}>
            <table className="table table-sm mb-0">
              <tbody>
                <tr>
                  <td className="text-muted">Número de discos:</td>
                  <td className="text-end fw-normal">{config.n}</td>
                </tr>
                <tr>
                  <td className="text-muted">Número de contactos:</td>
                  <td className="text-end fw-normal">{config.contacts.length}</td>
                </tr>
                <tr>
                  <td className="text-muted">Dim. rolling space:</td>
                  <td className="text-end fw-normal">{constraints.dimension}</td>
                </tr>
                <tr>
                  <td className="text-muted">Perímetro (centros):</td>
                  <td className="text-end coord-value">{perimeterCenters.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="text-muted">Perímetro (discos):</td>
                  <td className="text-end coord-value">{perimeter.perimeter.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </CollapsibleBox>

          {/* Coordenadas de Discos */}
          <CollapsibleBox title="Coordenadas de Discos" defaultOpen={false}>
            <div className="disk-coord-table">
              <table className="table table-sm table-striped">
                <thead>
                  <tr>
                    <th>Disco</th>
                    <th>x</th>
                    <th>y</th>
                  </tr>
                </thead>
                <tbody>
                  {config.positions.map((p, i) => (
                    <tr key={i}>
                      <td>{i}</td>
                      <td className="coord-value">{p[0].toFixed(6)}</td>
                      <td className="coord-value">{p[1].toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleBox>

          {/* Contactos entre Discos */}
          <CollapsibleBox title="Contactos entre Discos" defaultOpen={false}>
            <div className="contact-table">
              <table className="table table-sm table-striped">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Discos</th>
                    <th>Distancia</th>
                  </tr>
                </thead>
                <tbody>
                  {config.contacts.map(([i, j], idx) => (
                    <tr key={idx}>
                      <td>{idx}</td>
                      <td>({i}, {j})</td>
                      <td className="coord-value">
                        {euclideanDistance(
                          config.positions[i],
                          config.positions[j]
                        ).toFixed(6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleBox>

          {/* Gradiente del Perímetro */}
          <CollapsibleBox title="Gradiente del Perímetro" defaultOpen={true}>
            <div className="math-content text-center">
              <KaTeX math={gradientLatex} displayMode={true} />
            </div>
          </CollapsibleBox>

          {/* Proyección en ker(A) */}
          <CollapsibleBox title="Restricción a ker(A)" defaultOpen={true}>
            <div className="math-content text-center">
              <KaTeX math={projLatex} displayMode={true} />
            </div>
          </CollapsibleBox>

          {/* Autovalores del Hessiano */}
          <CollapsibleBox title="Autovalores del Hessiano" defaultOpen={true}>
            <div className="math-content text-center">
              <KaTeX math={eigenLatex} displayMode={true} />
            </div>
          </CollapsibleBox>
        </div>
      </div>
    </div>
  );
};

export default VisualizationPage;
