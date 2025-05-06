// src/components/NetworkAnalyzerDashboard.js
import { useState, useEffect } from "react";
import Header from "./layout/Header";
import Sidebar from "./layout/SideBar";
import NotificationSystem from "./layout/NotificationSystem";
import UploadTab from "./tabs/UploadTab";
import AnalyzeTab from "./tabs/AnalyzeTab";
import ResultsTab from "./tabs/ResultsTab";
import ExportTab from "./tabs/ExportTab";
import apiService from "../services/apiService";

/**
 * Componente principale che organizza il dashboard dell'applicazione
 */
export default function NetworkAnalyzerDashboard() {
  // Stati per la gestione delle schede e dei file
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
  // Stati per l'analisi e i risultati
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [analysisConfig, setAnalysisConfig] = useState({
    parserType: "auto",
    outputFormats: {
      graphviz: true,
      terraform: true,
      json: true
    },
    outputPaths: {
      output_dir: "output",
      output_graph: "output/network_graph.pdf",
      output_analysis: "output/network_analysis.json", 
      output_terraform: "output/terraform"
    }
  });
  
  // Stati per le connessioni e le notifiche
  const [isConnectedToCloud, setIsConnectedToCloud] = useState(false);
  const [isServerAvailable, setIsServerAvailable] = useState(false);
  const [isCheckingServer, setIsCheckingServer] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Verifica lo stato del server all'avvio dell'applicazione
  useEffect(() => {
    checkServerStatus();
  }, []);

  /**
   * Verifica lo stato di connessione con il server backend
   */
  const checkServerStatus = async () => {
    setIsCheckingServer(true);
    try {
      await apiService.checkServerStatus();
      setIsServerAvailable(true);
      addNotification("Connected to backend server", "success");
    } catch (error) {
      setIsServerAvailable(false);
      addNotification("Backend server is not available. Some features will be simulated.", "error");
      console.error("Server connection error:", error);
    } finally {
      setIsCheckingServer(false);
    }
  };

  /**
   * Gestisce l'upload dei file
   * @param {File[]} files - Array di file caricati
   */
  const handleFilesUploaded = (files) => {
    setUploadedFiles(files);
    if (files.length > 0) {
      addNotification(`${files.length} file(s) uploaded successfully`, "success");
    }
  };

  /**
   * Aggiorna la configurazione dell'analisi
   * @param {Object} config - Nuova configurazione
   */
  const updateAnalysisConfig = (config) => {
    setAnalysisConfig(prevConfig => ({
      ...prevConfig,
      ...config
    }));
  };

  /**
   * Avvia l'analisi dei file caricati
   */
  const startAnalysis = async () => {
    if (uploadedFiles.length === 0) {
      addNotification("Please upload at least one file to analyze", "error");
      return;
    }

    setIsAnalyzing(true);

    try {
      if (isServerAvailable) {
        // Se il server è disponibile, invia i file all'API
        const response = await apiService.analyzeFiles(uploadedFiles, {
          type: analysisConfig.parserType,
          output_dir: analysisConfig.outputPaths.output_dir,
          output_graph: analysisConfig.outputPaths.output_graph,
          output_analysis: analysisConfig.outputPaths.output_analysis,
          output_terraform: analysisConfig.outputPaths.output_terraform
        });
        
        if (response.status === 'success') {
          setAnalysisResults(response.results);
          addNotification("Analysis completed successfully", "success");
          setActiveTab("results");
        } else {
          throw new Error(response.message || "Analysis failed");
        }
      } else {
        // Se il server non è disponibile, simula l'analisi
        await simulateAnalysis();
      }
    } catch (error) {
      addNotification(`Analysis failed: ${error.message}`, "error");
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Simula un'analisi quando il server non è disponibile
   */
  const simulateAnalysis = async () => {
    // Simula un ritardo per l'analisi
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Genera risultati simulati
    const mockResults = {
      hosts: uploadedFiles.length * 5 + Math.floor(Math.random() * 10),
      hosts_list: Array.from({ length: uploadedFiles.length * 5 }, (_, i) => `192.168.1.${i + 1}`),
      connections: uploadedFiles.length * 12 + Math.floor(Math.random() * 20),
      protocols: [
        { name: 'TCP', count: Math.floor(Math.random() * 100) + 50 },
        { name: 'UDP', count: Math.floor(Math.random() * 50) + 10 },
        { name: 'HTTP', count: Math.floor(Math.random() * 40) + 5 },
        { name: 'MODBUS', count: Math.floor(Math.random() * 20) + 1 },
        { name: 'S7COMM', count: Math.floor(Math.random() * 10) + 1 }
      ],
      anomalies: Math.floor(Math.random() * 5),
      subnets: ['192.168.1.0/24', '10.0.0.0/24'],
      roles: {
        'CLIENT': Math.floor(Math.random() * 10) + 5,
        'SERVER': Math.floor(Math.random() * 5) + 2,
        'PLC_MODBUS': Math.floor(Math.random() * 3) + 1,
        'GATEWAY': Math.floor(Math.random() * 2) + 1
      },
      output_paths: {
        graph: analysisConfig.outputPaths.output_graph,
        analysis: analysisConfig.outputPaths.output_analysis,
        terraform: analysisConfig.outputPaths.output_terraform
      }
    };
    
    setAnalysisResults(mockResults);
    addNotification("Analysis completed successfully (simulated)", "success");
    setActiveTab("results");
  };

  /**
   * Gestisce l'esportazione dei risultati
   * @param {string} type - Tipo di esportazione (graph, analysis, terraform)
   */
  const handleExport = async (type) => {
    addNotification(`Preparing ${type} export...`, "info");
    
    try {
      if (isServerAvailable && analysisResults && analysisResults.output_paths) {
        // Se il server è disponibile, scarica il file
        await apiService.downloadFile(type, analysisResults.output_paths[type]);
        addNotification(`${type} exported successfully`, "success");
      } else {
        // Simula un'esportazione
        await new Promise(resolve => setTimeout(resolve, 1500));
        addNotification(`${type} exported successfully (simulated)`, "success");
      }
    } catch (error) {
      addNotification(`Export failed: ${error.message}`, "error");
      console.error("Export error:", error);
    }
  };

  /**
   * Alterna lo stato della connessione cloud
   */
  const toggleCloudConnection = () => {
    setIsConnectedToCloud(!isConnectedToCloud);
    addNotification(
      isConnectedToCloud ? 
        "Disconnected from Google Cloud" : 
        "Connected to Google Cloud", 
      "info"
    );
  };

  /**
   * Aggiunge una notifica al sistema
   * @param {string} message - Messaggio della notifica
   * @param {string} type - Tipo di notifica (success, error, warning, info)
   */
  const addNotification = (message, type) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Rimuove automaticamente la notifica dopo 5 secondi
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  /**
   * Rimuove una notifica dal sistema
   * @param {number} id - ID della notifica da rimuovere
   */
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  /**
   * Verifica se una scheda dovrebbe essere disabilitata
   * @param {string} tabName - Nome della scheda
   * @returns {boolean} True se la scheda dovrebbe essere disabilitata
   */
  const isTabDisabled = (tabName) => {
    if (tabName === "upload") return false;
    if (tabName === "analyze") return uploadedFiles.length === 0;
    if (tabName === "results" || tabName === "export") return !analysisResults;
    return false;
  };

  /**
   * Renderizza il contenuto attivo
   */
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case "upload":
        return (
          <UploadTab 
            uploadedFiles={uploadedFiles}
            onFilesUploaded={handleFilesUploaded}
            onContinue={() => setActiveTab("analyze")}
          />
        );
        
      case "analyze":
        return (
          <AnalyzeTab 
            config={analysisConfig}
            onConfigChange={updateAnalysisConfig}
            onStartAnalysis={startAnalysis}
            isAnalyzing={isAnalyzing}
          />
        );
        
      case "results":
        return (
          <ResultsTab 
            results={analysisResults}
            onExport={handleExport}
          />
        );
        
      case "export":
        return (
          <ExportTab 
            results={analysisResults}
            isCloudConnected={isConnectedToCloud}
            onToggleCloud={toggleCloudConnection}
            onExport={handleExport}
            onNotify={addNotification}
          />
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header dell'applicazione */}
      <Header 
        isCheckingServer={isCheckingServer} 
        isServerAvailable={isServerAvailable}
        isConnectedToCloud={isConnectedToCloud}
        onToggleCloud={toggleCloudConnection}
      />

      {/* Contenuto principale */}
      <div className="flex flex-1 overflow-hidden">
        {/* Barra laterale */}
        <Sidebar 
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isTabDisabled={isTabDisabled}
          isServerAvailable={isServerAvailable}
          isConnectedToCloud={isConnectedToCloud}
        />

        {/* Area contenuto */}
        <main className="flex-1 overflow-auto p-6">
          {renderActiveTabContent()}
        </main>
      </div>

      {/* Sistema di notifiche */}
      <NotificationSystem 
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  );
}