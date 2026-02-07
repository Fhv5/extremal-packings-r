import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const Layout: React.FC = () => {
  const location = useLocation();

  // Determine active page for nav highlighting
  const isAnalisis = location.pathname === '/' || location.pathname.startsWith('/analysis');

  return (
    <>
      {/* Navbar oscuro unificado con footer */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
        <div className="container">
          <NavLink className="navbar-brand fw-bold" to="/">
            <i className="bi bi-disc me-2"></i>
            Perímetros Extremos
          </NavLink>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              {/* <li className="nav-item">
                <a className="nav-link" href="/">
                  <i className="bi bi-house-door me-1"></i>Inicio
                </a>
              </li> */}
              {/* <li className="nav-item">
                <a className="nav-link" href="/">
                  <i className="bi bi-book me-1"></i>Metodología
                </a>
              </li> */}
              <li className="nav-item">
                <NavLink
                  className={`nav-link ${isAnalisis ? 'active' : ''}`}
                  to="/"
                >
                  <i className="bi bi-bar-chart-line me-1"></i>Análisis
                </NavLink>
              </li>
              {/* <li className="nav-item">
                <a className="nav-link" href="/">
                  <i className="bi bi-download me-1"></i>Recursos
                </a>
              </li> */}
            </ul>
          </div>
        </div>
      </nav>

      {/* Contenido de cada página */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-dark text-white py-4 mt-5">
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <h5>
                <i className="bi bi-disc me-2"></i>Perímetros Extremos
              </h5>
              <p className="text-muted small">
                Análisis variacional de configuraciones de discos congruentes
              </p>
            </div>
            <div className="col-md-6 text-md-end">
              <p className="mb-1">
                <strong>Universidad de Tarapacá</strong>
              </p>
              <p className="text-muted small">© 2025 - Fabián Henry Vilaxa</p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Layout;
