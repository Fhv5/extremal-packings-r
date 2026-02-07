import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components';
import AnalisisPage from './pages/AnalisisPage';
import VisualizationPage from './pages/VisualizationPage';
import './App.css';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<AnalisisPage />} />
          <Route path="/analysis/:configName" element={<VisualizationPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;