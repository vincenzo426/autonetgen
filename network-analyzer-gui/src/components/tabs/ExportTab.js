// src/components/tabs/ExportTab.js
import ExportOptions from "../export/ExportOptions";

/**
 * Componente per la scheda di esportazione dei risultati
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.results - Risultati dell'analisi
 * @param {boolean} props.isCloudConnected - Indica se è attiva la connessione al cloud
 * @param {Function} props.onToggleCloud - Handler per attivare/disattivare la connessione al cloud
 * @param {Function} props.onExport - Handler per l'esportazione dei risultati
 * @param {Function} props.onNotify - Handler per mostrare notifiche
 */
const ExportTab = ({ 
  results, 
  isCloudConnected, 
  onToggleCloud, 
  onExport, 
  onNotify 
}) => {
  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center bg-white p-8 rounded-lg shadow-md min-h-[400px]">
        <div className="text-center text-gray-500">
          <p className="mb-4">No analysis results available yet.</p>
          <p>Please upload files and run an analysis to see export options here.</p>
        </div>
      </div>
    );
  }

  return (
    <ExportOptions 
      results={results}
      isCloudConnected={isCloudConnected}
      onToggleCloud={onToggleCloud}
      onExport={onExport}
      onNotify={onNotify}
    />
  );
};

export default ExportTab;