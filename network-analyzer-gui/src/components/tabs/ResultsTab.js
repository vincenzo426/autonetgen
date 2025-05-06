// src/components/tabs/ResultsTab.js
import ResultsVisualizer from "../visualizations/ResultsVisualizer";

/**
 * Componente per la scheda di visualizzazione dei risultati
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.results - Risultati dell'analisi
 * @param {Function} props.onExport - Handler per l'esportazione dei risultati
 */
const ResultsTab = ({ results, onExport }) => {
  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center bg-white p-8 rounded-lg shadow-md min-h-[400px]">
        <div className="text-center text-gray-500">
          <p className="mb-4">No analysis results available yet.</p>
          <p>Please upload files and run an analysis to see results here.</p>
        </div>
      </div>
    );
  }

  return <ResultsVisualizer results={results} onExportClick={onExport} />;
};

export default ResultsTab;