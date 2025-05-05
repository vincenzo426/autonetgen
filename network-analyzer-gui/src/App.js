// src/App.js
import { useState, useEffect } from 'react';
import './App.css';
import FileUploader from './components/FileUploader';
import ResultsVisualizer from './components/ResultsVisualizer';
import ExportOptions from './components/ExportOptions';
import apiService from './services/apiService';
import { 
  Upload, 
  Play, 
  Activity, 
  Download, 
  Network, 
  Settings, 
  Cloud, 
  CloudOff,
  AlertCircle,
  CheckCircle,
  Info,
  X,
  Loader2
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [selectedParser, setSelectedParser] = useState("auto");
  const [outputFormats, setOutputFormats] = useState({
    graphviz: true,
    terraform: true,
    json: true
  });
  const [outputPaths, setOutputPaths] = useState({
    output_dir: "output",
    output_graph: "output/network_graph.pdf",
    output_analysis: "output/network_analysis.json",
    output_terraform: "output/terraform"
  });
  const [isConnectedToCloud, setIsConnectedToCloud] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isServerAvailable, setIsServerAvailable] = useState(false);
  const [isCheckingServer, setIsCheckingServer] = useState(true);

  // Verifica la disponibilità del server all'avvio
  useEffect(() => {
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    setIsCheckingServer(true);
    try {
      // await apiService.checkServerStatus();
      // Simula un ritardo per la connessione
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsServerAvailable(true);
    } catch (error) {
      setIsServerAvailable(false);
      addNotification("Backend server is not available. Some features might not work properly.", "error");
    } finally {
      setIsCheckingServer(false);
    }
  };

  // Gestisce l'upload dei file
  const handleFilesUploaded = (files) => {
    setUploadedFiles(files);
    if (files.length > 0) {
      addNotification(`${files.length} file(s) uploaded successfully`, "success");
    }
  };

  // Avvia l'analisi
  const startAnalysis = async () => {
    if (uploadedFiles.length === 0) {
      addNotification("Please upload at least one file to analyze", "error");
      return;
    }

    setIsAnalyzing(true);

    try {
      if (isServerAvailable) {
        // In una implementazione reale, questa sarebbe chiamata al backend
        // const response = await apiService.analyzeFiles(uploadedFiles, {
        //   type: selectedParser,
        //   output_dir: outputPaths.output_dir,
        //   output_graph: outputPaths.output_graph,
        //   output_analysis: outputPaths.output_analysis,
        //   output_terraform: outputPaths.output_terraform
        // });
        // setAnalysisResults(response.results);
      }

      // Simulazione dei risultati per dimostrazione
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const mockResults = {
        hosts: uploadedFiles.length * 5 + Math.floor(Math.random() * 10),
        connections: uploadedFiles.length * 12 + Math.floor(Math.random() * 20),
        protocols: ['TCP', 'UDP', 'HTTP', 'MODBUS', 'S7COMM'],
        anomalies: Math.floor(Math.random() * 5),
        subnets: ['192.168.1.0/24', '10.0.0.0/24'],
        roles: {
          'CLIENT': Math.floor(Math.random() * 10) + 5,
          'SERVER': Math.floor(Math.random() * 5) + 2,
          'PLC_MODBUS': Math.floor(Math.random() * 3) + 1,
          'GATEWAY': Math.floor(Math.random() * 2) + 1
        },
        output_paths: {
          graph: outputPaths.output_graph,
          analysis: outputPaths.output_analysis,
          terraform: outputPaths.output_terraform
        }
      };
      
      setAnalysisResults(mockResults);
      addNotification("Analysis completed successfully", "success");
      setActiveTab("results");
    } catch (error) {
      addNotification(`Analysis failed: ${error.message}`, "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Gestisce le esportazioni
  const handleExport = (type) => {
    addNotification(`Preparing ${type} export...`, "info");
    
    // In una implementazione reale, questa chiamerebbe apiService.downloadFile
    setTimeout(() => {
      addNotification(`${type} exported successfully`, "success");
    }, 1500);
  };

  // Aggiunge una notifica
  const addNotification = (message, type) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Rimuove automaticamente la notifica dopo 5 secondi
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Rimuove una notifica
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Verifica se una tab dovrebbe essere disabilitata
  const isTabDisabled = (tabName) => {
    if (tabName === "upload") return false;
    if (tabName === "analyze") return uploadedFiles.length === 0;
    if (tabName === "results" || tabName === "export") return !analysisResults;
    return false;
  };

  // Alterna la connessione al cloud
  const toggleCloudConnection = () => {
    setIsConnectedToCloud(!isConnectedToCloud);
    addNotification(
      isConnectedToCloud ? 
        "Disconnected from Google Cloud" : 
        "Connected to Google Cloud", 
      "info"
    );
  };

  // Renderizza il contenuto attivo
  const renderContent = () => {
    switch (activeTab) {
      case "upload":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6">Upload Network Data</h2>
            <div className="bg-white p-8 rounded-lg shadow-md">
              <FileUploader onFilesUploaded={handleFilesUploaded} />
            </div>
            
            {uploadedFiles.length > 0 && (
              <div className="mt-6 flex justify-end">
                <button 
                  className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700"
                  onClick={() => setActiveTab("analyze")}
                >
                  <Play size={18} className="mr-2" />
                  Continue to Analysis
                </button>
              </div>
            )}
          </div>
        );
        
      case "analyze":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6">Configure Analysis</h2>
            
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-4">Parser Selection</h3>
              <div className="mb-4">
                <label className="block mb-2 text-sm font-medium">Select Parser Type</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded"
                  value={selectedParser}
                  onChange={(e) => setSelectedParser(e.target.value)}
                >
                  <option value="auto">Auto-detect (recommended)</option>
                  <option value="pcap">PCAP Parser</option>
                  <option value="csv">CSV Parser</option>
                  <option value="netflow">NetFlow Parser</option>
                </select>
                <p className="mt-2 text-sm text-gray-500">Auto-detect will determine the parser based on file extension</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-4">Output Generation</h3>
              <div className="mb-4">
                <label className="flex items-center mb-3">
                  <input 
                    type="checkbox" 
                    checked={outputFormats.graphviz}
                    onChange={() => setOutputFormats({...outputFormats, graphviz: !outputFormats.graphviz})}
                    className="mr-2"
                  />
                  <span>Graphviz Network Visualization</span>
                </label>
                <label className="flex items-center mb-3">
                  <input 
                    type="checkbox" 
                    checked={outputFormats.terraform}
                    onChange={() => setOutputFormats({...outputFormats, terraform: !outputFormats.terraform})}
                    className="mr-2"
                  />
                  <span>Terraform Configuration</span>
                </label>
                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={outputFormats.json}
                    onChange={() => setOutputFormats({...outputFormats, json: !outputFormats.json})}
                    className="mr-2"
                  />
                  <span>JSON Export</span>
                </label>
              </div>
              
              <h3 className="text-lg font-semibold mb-4 mt-8">Output Paths</h3>
              <div className="space-y-3">
                <div>
                  <label className="block mb-1 text-sm font-medium">Output Directory</label>
                  <input 
                    type="text" 
                    value={outputPaths.output_dir}
                    onChange={(e) => setOutputPaths({...outputPaths, output_dir: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                {outputFormats.graphviz && (
                  <div>
                    <label className="block mb-1 text-sm font-medium">Graph Output Path</label>
                    <input 
                      type="text" 
                      value={outputPaths.output_graph}
                      onChange={(e) => setOutputPaths({...outputPaths, output_graph: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  </div>
                )}
                {outputFormats.json && (
                  <div>
                    <label className="block mb-1 text-sm font-medium">JSON Analysis Path</label>
                    <input 
                      type="text" 
                      value={outputPaths.output_analysis}
                      onChange={(e) => setOutputPaths({...outputPaths, output_analysis: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  </div>
                )}
                {outputFormats.terraform && (
                  <div>
                    <label className="block mb-1 text-sm font-medium">Terraform Files Path</label>
                    <input 
                      type="text" 
                      value={outputPaths.output_terraform}
                      onChange={(e) => setOutputPaths({...outputPaths, output_terraform: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700 disabled:bg-gray-400"
                onClick={startAnalysis}
                disabled={isAnalyzing || uploadedFiles.length === 0}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play size={20} className="mr-2" />
                    Start Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        );
        
      case "results":
        return (
          <ResultsVisualizer 
            results={analysisResults} 
            onExportClick={handleExport}
          />
        );
        
      case "export":
        return (
          <ExportOptions 
            results={analysisResults} 
            onNotify={addNotification}
          />
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Network size={28} />
            <h1 className="text-xl font-bold">Network Traffic Analyzer</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              {isCheckingServer ? (
                <div className="flex items-center text-blue-200">
                  <Loader2 size={16} className="animate-spin mr-1" />
                  <span className="text-sm">Checking connection...</span>
                </div>
              ) : isServerAvailable ? (
                <div className="flex items-center text-green-200">
                  <span className="h-2 w-2 rounded-full bg-green-400 mr-1"></span>
                  <span className="text-sm">Server connected</span>
                </div>
              ) : (
                <div className="flex items-center text-red-200">
                  <span className="h-2 w-2 rounded-full bg-red-400 mr-1"></span>
                  <span className="text-sm">Server unavailable</span>
                </div>
              )}
            </div>
            <button 
              onClick={toggleCloudConnection}
              className={`flex items-center p-2 rounded ${isConnectedToCloud ? 'hover:bg-blue-700' : 'hover:bg-blue-700'}`}
            >
              {isConnectedToCloud ? <Cloud size={20} /> : <CloudOff size={20} />}
              <span className="ml-2">GCP {isConnectedToCloud ? "Connected" : "Disconnected"}</span>
            </button>
            <button className="flex items-center p-2 rounded hover:bg-blue-700">
              <Settings size={20} />
              <span className="ml-2">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="w-64 bg-gray-800 text-white">
          <div className="p-4">
            <button 
              className={`flex items-center w-full p-3 rounded mb-2 ${activeTab === "upload" ? "bg-blue-600" : "hover:bg-gray-700"}`}
              onClick={() => setActiveTab("upload")}
            >
              <Upload size={20} className="mr-3" />
              Upload Data
            </button>
            <button 
              className={`flex items-center w-full p-3 rounded mb-2 ${activeTab === "analyze" ? "bg-blue-600" : "hover:bg-gray-700"}`}
              onClick={() => setActiveTab("analyze")}
              disabled={isTabDisabled("analyze")}
              style={{ opacity: isTabDisabled("analyze") ? 0.5 : 1 }}
            >
              <Play size={20} className="mr-3" />
              Analyze
            </button>
            <button 
              className={`flex items-center w-full p-3 rounded mb-2 ${activeTab === "results" ? "bg-blue-600" : "hover:bg-gray-700"}`}
              onClick={() => setActiveTab("results")}
              disabled={isTabDisabled("results")}
              style={{ opacity: isTabDisabled("results") ? 0.5 : 1 }}
            >
              <Activity size={20} className="mr-3" />
              Results
            </button>
            <button 
              className={`flex items-center w-full p-3 rounded mb-2 ${activeTab === "export" ? "bg-blue-600" : "hover:bg-gray-700"}`}
              onClick={() => setActiveTab("export")}
              disabled={isTabDisabled("export")}
              style={{ opacity: isTabDisabled("export") ? 0.5 : 1 }}
            >
              <Download size={20} className="mr-3" />
              Export
            </button>
          </div>
          
          {/* Status indicators */}
          <div className="mt-auto p-4 border-t border-gray-700">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">System Status</h3>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">Cloud Storage</span>
                <span className={`h-3 w-3 rounded-full ${isConnectedToCloud ? "bg-green-500" : "bg-red-500"}`}></span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">Parser Service</span>
                <span className={`h-3 w-3 rounded-full ${isServerAvailable ? "bg-green-500" : "bg-red-500"}`}></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Analysis Engine</span>
                <span className={`h-3 w-3 rounded-full ${isServerAvailable ? "bg-green-500" : "bg-red-500"}`}></span>
              </div>
            </div>
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {renderContent()}
        </main>
      </div>

      {/* Notifications */}
      <div className="fixed bottom-4 right-4 z-50 w-80">
        {notifications.map(notification => (
          <div 
            key={notification.id}
            className={`mb-2 p-3 rounded-lg shadow-lg flex justify-between items-center ${
              notification.type === 'success' ? 'bg-green-500 text-white' :
              notification.type === 'error' ? 'bg-red-500 text-white' :
              notification.type === 'warning' ? 'bg-amber-500 text-white' :
              'bg-blue-500 text-white'
            }`}
          >
            <div className="flex items-center">
              {notification.type === 'success' && <CheckCircle size={18} className="mr-2" />}
              {notification.type === 'error' && <AlertCircle size={18} className="mr-2" />}
              {notification.type === 'warning' && <AlertCircle size={18} className="mr-2" />}
              {notification.type === 'info' && <Info size={18} className="mr-2" />}
              <p>{notification.message}</p>
            </div>
            <button 
              onClick={() => removeNotification(notification.id)}
              className="ml-2 text-white hover:text-gray-200"
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;