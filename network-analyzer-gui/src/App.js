// src/App.js
import React from 'react';
import './App.css';
import NetworkAnalyzerDashboard from './components/NetworkAnalyzerDashboard';

/**
 * Componente principale dell'applicazione
 * Utilizza il dashboard dell'analizzatore di rete come componente principale
 */
function App() {
  return (
    <div className="App">
      <NetworkAnalyzerDashboard />
    </div>
  );
}

export default App;