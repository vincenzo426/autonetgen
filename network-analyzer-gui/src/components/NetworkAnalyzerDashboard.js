// src/components/NetworkAnalyzerDashboard.js
import { useState, useEffect } from "react";
import Header from "./layout/Header";
import Sidebar from "./layout/SideBar";
import NotificationSystem from "./layout/NotificationSystem";
import UploadTab from "./tabs/UploadTab";
import AnalyzeTab from "./tabs/AnalyzeTab";
import ResultsTab from "./tabs/ResultsTab";
import ExportTab from "./tabs/ExportTab";
import TerraformTab from "./tabs/TerraformTab";
import apiService from "../services/apiService";

/**
 * Componente principale che organizza il dashboard dell'applicazione
 * Aggiornato per supportare Google Cloud Storage con Signed URLs
 */
export default function NetworkAnalyzerDashboard() {
  // Stati per la gestione delle schede e dei file
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Stati per l'analisi e i risultati
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [analysisConfig, setAnalysisConfig] = useState({
    parserType: "auto",
    outputFormats: {
      graphviz: true,
      terraform: true,
      json: true,
    },
    outputPaths: {
      output_dir: "output",
      output_graph: "output/network_graph.pdf",
      output_analysis: "output/network_analysis.json",
      output_terraform: "output/terraform",
    },
  });

  // Stati per l'upload su GCS
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [sessionId, setSessionId] = useState(null);

  // Stati per le connessioni e le notifiche
  const [isConnectedToCloud, setIsConnectedToCloud] = useState(false);
  const [isServerAvailable, setIsServerAvailable] = useState(false);
  const [isCheckingServer, setIsCheckingServer] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Verifica lo stato del server all'avvio dell'applicazione
  useEffect(() => {
    checkServerStatus();
  }, []);

  // Cleanup della sessione quando l'utente lascia la pagina
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (sessionId && isServerAvailable) {
        try {
          // Prova a pulire la sessione, ma non bloccare la chiusura della pagina
          navigator.sendBeacon(
            `${apiService.API_URL}/cleanup/session`,
            JSON.stringify({ session_id: sessionId })
          );
        } catch (error) {
          console.warn("Failed to cleanup session on page unload:", error);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sessionId, isServerAvailable]);

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
      addNotification(
        "Backend server is not available. Some features will be limited.",
        "error"
      );
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
    const sizeInBytes = files[0].size;

    setUploadedFiles(files);
    if (files.length > 0) {
      // Convert to MB
      const sizeInMB = sizeInBytes / (1024 * 1024);
      setFileSize(sizeInMB);
      console.log(`File size: ${sizeInMB.toFixed(2)} MB `);
      addNotification(`${files.length} file(s) selected for upload`, "success");
    }
  };

  /**
   * Aggiorna la configurazione dell'analisi
   * @param {Object} config - Nuova configurazione
   */
  const updateAnalysisConfig = (config) => {
    setAnalysisConfig((prevConfig) => ({
      ...prevConfig,
      ...config,
    }));
  };

  /**
   * Callback per il progresso dell'upload totale
   * @param {number} progress - Progresso in percentuale (0-100)
   */
  const handleUploadProgress = (progress) => {
    setUploadProgress(Math.round(progress));
  };

  /**
   * Callback per il progresso dell'upload di singoli file
   * @param {string} filename - Nome del file
   * @param {number} progress - Progresso in percentuale (0-100)
   */
  const handleFileProgress = (filename, progress) => {
    setUploadingFiles((prev) => ({
      ...prev,
      [filename]: Math.round(progress),
    }));
  };

  /**
   * Resetta gli stati dell'upload
   */
  const resetUploadStates = () => {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadingFiles({});
  };

  /**
   * Pulisce la sessione corrente
   */
  const cleanupCurrentSession = async () => {
    if (sessionId && isServerAvailable) {
      try {
        await apiService.cleanupSession(sessionId);
        console.log("Session cleaned up successfully");
      } catch (error) {
        console.warn("Failed to cleanup session:", error);
      }
    }
  };

  /**
   * Avvia l'analisi dei file caricati usando il nuovo flusso GCS
   */
  const startAnalysis = async () => {
    if (uploadedFiles.length === 0) {
      addNotification("Please upload at least one file to analyze", "error");
      return;
    }

    if (!isServerAvailable) {
      addNotification("Backend server is not available", "error");
      return;
    }

    // Reset degli stati
    setIsAnalyzing(true);
    setIsUploading(true);
    resetUploadStates();

    let currentSessionId = null;

    try {
      addNotification("Starting file upload to cloud storage...", "info");

      // Prepara le opzioni per l'analisi
      const analysisOptions = {
        type: analysisConfig.parserType,
        output_dir: analysisConfig.outputPaths.output_dir,
        output_graph: analysisConfig.outputPaths.output_graph,
        output_analysis: analysisConfig.outputPaths.output_analysis,
        output_terraform: analysisConfig.outputPaths.output_terraform,
      };

      // Esegui il processo completo di upload e analisi
      const result = await apiService.uploadAndAnalyzeFiles(
        uploadedFiles,
        analysisOptions,
        handleUploadProgress,
        handleFileProgress
      );

      currentSessionId = result.session_id;
      setSessionId(currentSessionId);

      // Upload completato, inizia l'analisi
      setIsUploading(false);
      addNotification(
        "Files uploaded successfully, starting analysis...",
        "success"
      );

      // Controlla se l'analisi è riuscita
      if (
        result.analysis_result &&
        result.analysis_result.status === "success"
      ) {
        setAnalysisResults(result.analysis_result.results);
        console.log("Analysis results:", result.analysis_result.results);
        addNotification("Analysis completed successfully", "success");
        setActiveTab("results");
      } else {
        throw new Error(result.analysis_result?.message || "Analysis failed");
      }
    } catch (error) {
      console.error("Upload and analysis error:", error);

      // Gestione specifica degli errori
      if (error.message.includes("signed URL")) {
        addNotification(
          "Failed to get upload permission. Please try again.",
          "error"
        );
      } else if (error.message.includes("Upload verification failed")) {
        addNotification(
          "File upload verification failed. Some files may not have been uploaded correctly.",
          "error"
        );
      } else if (error.message.includes("All file uploads failed")) {
        addNotification(
          "All file uploads failed. Please check your internet connection and try again.",
          "error"
        );
      } else if (error.message.includes("Analysis failed")) {
        addNotification(
          "File analysis failed. Please check if the files are in the correct format.",
          "error"
        );
      } else {
        addNotification(`Process failed: ${error.message}`, "error");
      }

      // In caso di errore, prova a pulire la sessione
      if (currentSessionId) {
        try {
          await apiService.cleanupSession(currentSessionId);
          console.log("Cleaned up session after error");
        } catch (cleanupError) {
          console.warn("Failed to cleanup session after error:", cleanupError);
        }
      }
    } finally {
      setIsAnalyzing(false);
      setIsUploading(false);
      resetUploadStates();
    }
  };

  /**
   * Gestisce l'esportazione dei risultati
   * @param {string} type - Tipo di esportazione (graph, analysis, terraform)
   */
  const handleExport = async (type) => {
    addNotification(`Preparing ${type} export...`, "info");

    try {
      if (
        isServerAvailable &&
        analysisResults &&
        analysisResults.output_paths
      ) {
        // Se il server è disponibile, scarica il file
        await apiService.downloadFile(type, sessionId);
        addNotification(`${type} exported successfully`, "success");
      } else {
        throw new Error(
          "Export not available - server not connected or no analysis results"
        );
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
      isConnectedToCloud
        ? "Disconnected from Google Cloud"
        : "Connected to Google Cloud",
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
    setNotifications((prev) => [...prev, { id, message, type }]);

    // Rimuove automaticamente la notifica dopo 5 secondi
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  /**
   * Rimuove una notifica dal sistema
   * @param {number} id - ID della notifica da rimuovere
   */
  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  /**
   * Verifica se una scheda dovrebbe essere disabilitata
   * @param {string} tabName - Nome della scheda
   * @returns {boolean} True se la scheda dovrebbe essere disabilitata
   */
  const isTabDisabled = (tabName) => {
    if (tabName === "upload") return false;
    if (tabName === "analyze") return uploadedFiles.length === 0;
    if (["results", "export", "terraform"].includes(tabName))
      return !analysisResults;
    return false;
  };

  /**
   * Gestisce la pulizia manuale dei file
   */
  const handleCleanupFiles = async () => {
    if (sessionId) {
      try {
        await cleanupCurrentSession();
        addNotification("Files cleaned up successfully", "success");
        setSessionId(null);
      } catch (error) {
        addNotification("Failed to cleanup files", "error");
      }
    }
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
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            uploadingFiles={uploadingFiles}
          />
        );

      case "analyze":
        return (
          <AnalyzeTab
            config={analysisConfig}
            onConfigChange={updateAnalysisConfig}
            onStartAnalysis={startAnalysis}
            isAnalyzing={isAnalyzing}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            uploadingFiles={uploadingFiles}
            sessionId={sessionId}
            onCleanupFiles={handleCleanupFiles}
          />
        );

      case "results":
        return (
          <ResultsTab
            results={analysisResults}
            onExport={handleExport}
            sessionId={sessionId}
            onCleanupFiles={handleCleanupFiles}
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
            sessionId={sessionId}
          />
        );

      case "terraform":
        return (
          <TerraformTab
            results={analysisResults}
            isCloudConnected={isConnectedToCloud}
            onToggleCloud={toggleCloudConnection}
            onNotify={addNotification}
            sessionId={sessionId}
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
        isUploading={isUploading}
        uploadProgress={uploadProgress}
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
          isProcessing={isAnalyzing || isUploading}
          // Aggiungi la nuova tab Terraform alla navigazione
          additionalTabs={[
            { id: "terraform", name: "Terraform", icon: "Server" },
          ]}
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

      {/* Modal di progresso per upload di file grandi */}
      {isUploading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Uploading Files</h3>

            {/* Progresso totale */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Overall Progress</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Progresso per singoli file */}
            {Object.entries(uploadingFiles).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">
                  File Progress:
                </h4>
                {Object.entries(uploadingFiles).map(([filename, progress]) => (
                  <div key={filename} className="text-xs">
                    <div className="flex justify-between text-gray-600 mb-1">
                      <span className="truncate" title={filename}>
                        {filename.length > 30
                          ? `${filename.substring(0, 27)}...`
                          : filename}
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-green-600 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-sm text-gray-600 mt-4">
              Please don't close this window while files are being uploaded to
              cloud storage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
