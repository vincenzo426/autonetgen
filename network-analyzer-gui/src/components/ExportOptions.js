// src/components/ExportOptions.js
import { useState } from 'react';
import { 
  Network, 
  Server, 
  Database, 
  Download, 
  Cloud, 
  UploadCloud, 
  Check, 
  Loader2 
} from 'lucide-react';
import apiService from '../services/apiService';

const ExportCard = ({ title, description, icon: Icon, color, onClick, isLoading, isCompleted }) => {
  return (
    <div className={`bg-white p-6 rounded-lg shadow-md border border-${color}-100 hover:shadow-lg transition-shadow`}>
      <div className="text-center">
        <div className={`bg-${color}-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center`}>
          <Icon size={32} className={`text-${color}-700`} />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 mb-4 h-12">{description}</p>
        <button 
          className={`bg-${color}-600 text-white py-2 px-4 rounded hover:bg-${color}-700 w-full flex items-center justify-center`}
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

const ExportOptions = ({ results, onNotify }) => {
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
  
  const [cloudOptions, setCloudOptions] = useState({
    bucket: 'network-analysis-results',
    isConnected: false
  });

  const handleExport = async (type) => {
    // Aggiorna stato di caricamento
    setLoadingStates(prev => ({ ...prev, [type]: true }));
    
    try {
      // Per una implementazione reale, utilizzare il apiService
      // await apiService.downloadFile(type, results.output_paths[type]);
      
      // Simulazione di un ritardo per dimostrare il caricamento
      await new Promise(resolve => setTimeout(resolve, 1500));
      
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
  
  const toggleCloudConnection = () => {
    setCloudOptions(prev => ({ ...prev, isConnected: !prev.isConnected }));
    
    onNotify && onNotify({
      message: cloudOptions.isConnected ? 
        "Disconnected from Google Cloud" : 
        "Connected to Google Cloud",
      type: 'info'
    });
  };
  
  const handleCloudExport = async () => {
    if (!cloudOptions.isConnected) {
      onNotify && onNotify({
        message: "Please connect to Google Cloud first",
        type: 'warning'
      });
      return;
    }
    
    setLoadingStates(prev => ({ ...prev, cloud: true }));
    
    try {
      // Simulazione di un ritardo per dimostrare il caricamento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      onNotify && onNotify({
        message: `All files saved to ${cloudOptions.bucket}`,
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

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Export Results</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <ExportCard 
          title="Network Map" 
          description="Visual representation of network topology"
          icon={Network}
          color="blue"
          onClick={() => handleExport('graph')}
          isLoading={loadingStates.graph}
          isCompleted={completedStates.graph}
        />
        
        <ExportCard 
          title="Terraform" 
          description="Infrastructure as code for GCP deployment"
          icon={Server}
          color="green"
          onClick={() => handleExport('terraform')}
          isLoading={loadingStates.terraform}
          isCompleted={completedStates.terraform}
        />
        
        <ExportCard 
          title="JSON Data" 
          description="Complete analysis results in JSON format"
          icon={Database}
          color="purple"
          onClick={() => handleExport('json')}
          isLoading={loadingStates.json}
          isCompleted={completedStates.json}
        />
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Cloud Storage Options</h3>
        
        <div className="mb-6">
          <div className="mb-4">
            <button 
              className={`flex items-center py-2 px-4 rounded ${
                cloudOptions.isConnected ? 
                  'bg-green-100 text-green-800 hover:bg-green-200' : 
                  'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
              onClick={toggleCloudConnection}
            >
              {cloudOptions.isConnected ? (
                <>
                  <Cloud size={18} className="mr-2 text-green-600" />
                  Connected to Google Cloud
                </>
              ) : (
                <>
                  <Cloud size={18} className="mr-2 text-gray-600" />
                  Connect to Google Cloud
                </>
              )}
            </button>
          </div>
          
          {cloudOptions.isConnected && (
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium">Storage Bucket</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded"
                value={cloudOptions.bucket}
                onChange={(e) => setCloudOptions(prev => ({ ...prev, bucket: e.target.value }))}
              >
                <option value="network-analysis-results">network-analysis-results</option>
                <option value="terraform-exports">terraform-exports</option>
                <option value="visualization-data">visualization-data</option>
              </select>
            </div>
          )}
        </div>
        
        <div className="flex justify-end">
          <button 
            className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            onClick={handleCloudExport}
            disabled={!cloudOptions.isConnected || loadingStates.cloud}
          >
            {loadingStates.cloud ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                Saving to Cloud...
              </>
            ) : completedStates.cloud ? (
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
    </div>
  );
};

export default ExportOptions;