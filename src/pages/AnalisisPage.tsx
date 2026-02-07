import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAllConfigurations } from '../services/jsonLoader';
import { Configuration } from '../types';
import { KaTeX } from '../components';

const AnalisisPage: React.FC = () => {
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const catalog = loadAllConfigurations();
    const groups = new Map<number, string[]>();

    catalog.forEach((config: Configuration, name: string) => {
      const size = config.n;
      if (!groups.has(size)) groups.set(size, []);
      groups.get(size)!.push(name);
    });

    const sorted = new Map<number, string[]>();
    Array.from(groups.keys())
      .sort((a, b) => a - b)
      .forEach((k) => {
        const names = groups.get(k)!;
        names.sort((a, b) => {
          const na = parseInt(a.split('-')[1]);
          const nb = parseInt(b.split('-')[1]);
          return na - nb;
        });
        sorted.set(k, names);
      });

    return sorted;
  }, []);

  return (
    <>
      <section className="py-5" style={{ background: 'linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)' }}>
        <div className="container">
          <div className="row mb-4">
            <div className="col-lg-10 mx-auto text-center">
              <h1 className="display-5 fw-bold mb-3">
                Análisis Variacional de Configuraciones
              </h1>
            </div>
          </div>

          {Array.from(grouped.entries()).map(([nDisks, configs]) => (
            <div className="mb-5" key={nDisks}>
              <div className="group-header">
                <h3>
                  <i className="bi bi-circle me-2"></i>
                  {nDisks} discos
                </h3>
                <span className="badge">{configs.length} configuraciones</span>
              </div>
              <div className="row g-3">
                {configs.map((configName) => (
                  <div className="col-lg-2 col-md-3 col-sm-4 col-6" key={configName}>
                    <div
                      className="card config-card h-100"
                      onClick={() => navigate(`/analysis/${configName}`)}
                    >
                      <div className="card-body text-center d-flex flex-column align-items-center justify-content-center">
                        <div className="config-name fs-4 mb-1">
                          <KaTeX
                            math={(() => {
                              const m = configName.match(/D(\d+)-(\d+)/);
                              return m
                                ? `\\mathcal{D}_{${m[1]}\\text{-}${m[2]}}`
                                : configName;
                            })()}
                          />
                        </div>
                        <div style={{
                          fontSize: '0.7rem',
                          color: '#aaa',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          fontWeight: 500,
                        }}>
                          {nDisks} discos
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

export default AnalisisPage;
