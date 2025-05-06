// src/components/export/ExportOptions.js
import { useState } from "react";
import { 
  Network, 
  Server, 
  Database, 
  Download, 
  Cloud, 
  CloudOff, 
  UploadCloud, 
  Check, 
  Loader2, 
  Info 
} from "lucide-react";

/**
 * Componente per le opzioni di esportazione
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.results - Risultati dell'analisi
 * @param {boolean} props.isCloudConnected - Stato della connessione al cloud
 * @param {Function} props.onToggleCloud - Handler per attivare/disattivare la connessione al cloud
 * @param {Function} props.onExport - Handler per l'esportazione dei risultati
 * @param {Function} props.onNotify - Handler per mostrare notifiche
 */
const ExportOptions = ({ 
  results, 
  isCloudConnected, 
  onToggleCloud, 
  onExport, 
  onNotify 
}) => {
  const [loadingStates, setLoadingStates] = useState({
    graph: false,
    terraform: false,
    json: false,
    cloud: false
  });
  
  const [completedStates, setCompletedStates] = useState({
    graph: false,
    terraform: false,
    json: false,
    cloud: false
  });
  
  const [cloudBucket, setCloudBucket] = useState("network-analysis-results");

  /**
   * Gestisce l'esportazione di un elemento
   * @param {string} type - Tipo di esportazione
   */
  const handleExport = async (type) => {
    // Aggiorna stato di caricamento
    setLoadingStates(prev => ({ ...prev, [type]: true }));
    
    try {
      // Esporta il file
      await onExport(type);
      
      // Notifica il successo
      onNotify && onNotify({
        message: `${type} exported successfully!`,
        type: 'success'
      });
      
      // Aggiorna stato completato
      setCompletedStates(prev => ({ ...prev, [type]: true }));
    } catch (error) {
      // Notifica errore
      onNotify && onNotify({
        message: `Error exporting ${type}: ${error.message}`,
        type: 'error'
      });
    } finally {
      // Rimuovi stato di caricamento
      setLoadingStates(prev => ({ ...prev, [type]: false }));
      
      // Reset dello stato completato dopo un po'
      setTimeout(() => {
        setCompletedStates(prev => ({ ...prev, [type]: false }));
      }, 3000);
    }
  };
  
  /**
   * Gestisce l'esportazione al cloud
   */
  const handleCloudExport = async () => {
    if (!isCloudConnected) {
      onNotify && onNotify({
        message: "Please connect to Google Cloud first",
        type: 'warning'
      });
      return;
    }
    
    setLoadingStates(prev => ({ ...prev, cloud: true }));
    
    try {
      // Simula l'esportazione al cloud
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      onNotify && onNotify({
        message: `All files saved to ${cloudBucket}`,
        type: 'success'
      });
      
      setCompletedStates(prev => ({ ...prev, cloud: true }));
    } catch (error) {
      onNotify && onNotify({
        message: `Error saving to cloud: ${error.message}`,
        type: 'error'
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, cloud: false }));
      
      setTimeout(() => {
        setCompletedStates(prev => ({ ...prev, cloud: false }));
      }, 3000);
    }
  };

  // Definizione delle opzioni di esportazione
  const exportOptions = [
    {
      id: "graph",
      title: "Network Map",
      description: "Visual representation of network topology",
      icon: Network,
      color: "blue"
    },
    {
      id: "terraform",
      title: "Terraform",
      description: "Infrastructure as code for GCP deployment",
      icon: Server,
      color: "green"
    },
    {
      id: "json",
      title: "JSON Data",
      description: "Complete analysis results in JSON format",
      icon: Database,
      color: "purple"
    }
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Export Results</h2>
      
      {/* Opzioni di esportazione */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {exportOptions.map(option => (
          <ExportCard 
            key={option.id}
            title={option.title}
            description={option.description}
            icon={option.icon}
            color={option.color}
            onClick={() => handleExport(option.id)}
            isLoading={loadingStates[option.id]}
            isCompleted={completedStates[option.id]}
          />
        ))}
      </div>
      
      {/* Opzioni cloud */}
      <CloudStorageOptions 
        isConnected={isCloudConnected}
        bucket={cloudBucket}
        onToggleConnection={onToggleCloud}
        onBucketChange={setCloudBucket}
        onExport={handleCloudExport}
        isLoading={loadingStates.cloud}
        isCompleted={completedStates.cloud}
      />
    </div>
  );
};

/**
 * Componente per una card di esportazione
 */
const ExportCard = ({ 
  title, 
  description, 
  icon: Icon, 
  color, 
  onClick, 
  isLoading, 
  isCompleted 
}) => {
  // Mappatura dei colori alle classi Tailwind
  const colorClasses = {
    blue: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      button: "bg-blue-600 hover:bg-blue-700"
    },
    green: {
      bg: "bg-green-100",
      text: "text-green-700",
      button: "bg-green-600 hover:bg-green-700"
    },
    purple: {
      bg: "bg-purple-100",
      text: "text-purple-700",
      button: "bg-purple-600 hover:bg-purple-700"
    }
  };

  const classes = colorClasses[color] || colorClasses.blue;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border hover:shadow-lg transition-shadow">
      <div className="text-center">
        <div className={`${classes.bg} p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center`}>
          <Icon size={32} className={classes.text} />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 mb-4 h-12">{description}</p>
        <button 
          className={`${classes.button} text-white py-2 px-4 rounded w-full flex items-center justify-center`}
          onClick={onClick}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="mr-2 animate-spin" />
              Exporting...
            </>
          ) : isCompleted ? (
            <>
              <Check size={18} className="mr-2" />
              Downloaded
            </>
          ) : (
            <>
              <Download size={18} className="mr-2" />
              Export {title}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

/**
 * Componente per le opzioni di archiviazione cloud
 */
const CloudStorageOptions = ({ 
  isConnected, 
  bucket, 
  onToggleConnection, 
  onBucketChange, 
  onExport,
  isLoading,
  isCompleted
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Cloud Storage Options</h3>
      
      <div className="mb-6">
        <div className="mb-4">
          <button 
            className={`flex items-center py-2 px-4 rounded ${
              isConnected ? 
                'bg-green-100 text-green-800 hover:bg-green-200' : 
                'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
            onClick={onToggleConnection}
          >
            {isConnected ? (
              <>
                <Cloud size={18} className="mr-2 text-green-600" />
                Connected to Google Cloud
              </>
            ) : (
              <>
                <CloudOff size={18} className="mr-2 text-gray-600" />
                Connect to Google Cloud
              </>
            )}
          </button>
        </div>
        
        {isConnected && (
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium">Storage Bucket</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded"
              value={bucket}
              onChange={(e) => onBucketChange(e.target.value)}
            >
              <option value="network-analysis-results">network-analysis-results</option>
              <option value="terraform-exports">terraform-exports</option>
              <option value="visualization-data">visualization-data</option>
            </select>
          </div>
        )}
      </div>
      
      {!isConnected && (
        <div className="mb-6 bg-amber-50 p-4 rounded-lg border border-amber-200">
          <div className="flex items-start">
            <Info size={20} className="text-amber-500 mr-3 mt-1 flex-shrink-0" />
            <p className="text-amber-700 text-sm">
              Connect to Google Cloud Platform to enable cloud storage of analysis results.
            </p>
          </div>
        </div>
      )}
      
      <div className="flex justify-end">
        <button 
          className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          onClick={onExport}
          disabled={!isConnected || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 size={20} className="mr-2 animate-spin" />
              Saving to Cloud...
            </>
          ) : isCompleted ? (
            <>
              <Check size={20} className="mr-2" />
              Saved to Cloud
            </>
          ) : (
            <>
              <UploadCloud size={20} className="mr-2" />
              Save All to Cloud
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ExportOptions;