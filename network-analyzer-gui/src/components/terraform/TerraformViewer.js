// src/components/terraform/TerraformViewer.js
import React, { useState, useEffect } from "react";
import {
  Save,
  RefreshCw,
  Check,
  X,
  FileCode,
  Edit2,
  Download,
  Server,
  Info,
  Cloud,
  AlertCircle,
  FileText,
  Database,
} from "lucide-react";
import apiService from "../../services/apiService";

/**
 * Componente per visualizzare e modificare i file Terraform generati e archiviati su Google Cloud Storage
 *
 * @param {Object} props - Proprietà del componente
 * @param {string} props.sessionId - ID della sessione per identificare i file
 * @param {Function} props.onNotify - Handler per mostrare notifiche
 * @param {boolean} props.isCloudConnected - Indica se la connessione cloud è attiva
 */
const TerraformViewer = ({ sessionId, onNotify, isCloudConnected = true }) => {
  const [fileList, setFileList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFileContentLoading, setIsFileContentLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);

  // Carica la lista dei file Terraform all'avvio quando abbiamo un sessionId
  useEffect(() => {
    if (sessionId && isCloudConnected) {
      fetchTerraformFiles();
    }
  }, [sessionId, isCloudConnected]);

  /**
   * Recupera la lista dei file Terraform da Google Cloud Storage
   */
  const fetchTerraformFiles = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching Terraform files for session: ${sessionId}`);

      const response = await apiService.getTerraformFiles(sessionId);

      if (response.status === "success") {
        setFileList(response.files || []);
        setStorageInfo({
          sessionId: response.session_id,
          totalFiles: response.files?.length || 0,
          storageLocation: `results/${sessionId}/terraform/`,
        });

        onNotify &&
          onNotify(
            `Loaded ${
              response.files?.length || 0
            } Terraform files from cloud storage`,
            "success"
          );
      } else {
        throw new Error(response.message || "Failed to fetch files");
      }
    } catch (error) {
      console.error("Error fetching Terraform files:", error);
      setError(
        "Error fetching Terraform files from cloud storage. Please try again."
      );
      onNotify &&
        onNotify(`Error fetching Terraform files: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Seleziona un file e ne visualizza il contenuto da GCS
   * @param {Object} file - Il file selezionato con proprietà blob_name
   */
  const handleFileSelect = async (file) => {
    if (isEditing && fileContent !== originalContent) {
      if (!window.confirm("You have unsaved changes. Discard them?")) {
        return;
      }
    }

    setSelectedFile(file);
    setIsFileContentLoading(true);
    setError(null);

    try {
      console.log(`Loading content for blob: ${file.blob_name}`);

      const response = await apiService.getTerraformFileContent(file.blob_name);

      if (response.status === "success") {
        setFileContent(response.content || "");
        setOriginalContent(response.content || "");
        setIsEditing(false);

        onNotify &&
          onNotify(`File ${file.name} loaded from cloud storage`, "info");
      } else {
        throw new Error(response.message || "Failed to load file content");
      }
    } catch (error) {
      console.error(`Error loading file content for ${file.name}:`, error);
      setError(`Error loading file content for ${file.name}.`);
      onNotify && onNotify(`Error loading file: ${error.message}`, "error");
    } finally {
      setIsFileContentLoading(false);
    }
  };

  /**
   * Gestisce l'editing del file
   */
  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  /**
   * Gestisce il cambiamento del contenuto del file
   */
  const handleContentChange = (e) => {
    setFileContent(e.target.value);
  };

  /**
   * Salva le modifiche al file su Google Cloud Storage
   */
  const handleSaveChanges = async () => {
    if (!selectedFile) return;

    setIsSaving(true);

    try {
      console.log(`Saving changes to blob: ${selectedFile.blob_name}`);

      const response = await apiService.saveTerraformFile(
        selectedFile.blob_name,
        fileContent
      );

      if (response.status === "success") {
        setOriginalContent(fileContent);
        setIsEditing(false);

        onNotify &&
          onNotify(
            `File ${selectedFile.name} saved to cloud storage successfully`,
            "success"
          );
      } else {
        throw new Error(response.message || "Failed to save file");
      }
    } catch (error) {
      console.error("Error saving file:", error);
      onNotify && onNotify(`Error saving file: ${error.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Annulla le modifiche al file
   */
  const handleCancelEdit = () => {
    setFileContent(originalContent);
    setIsEditing(false);
  };

  /**
   * Scarica il file selezionato direttamente dal browser
   */
  const handleDownloadFile = () => {
    if (!selectedFile) return;

    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onNotify && onNotify(`File ${selectedFile.name} downloaded`, "success");
  };

  /**
   * Scarica tutti i file Terraform come archivio ZIP da GCS
   */
  const handleDownloadAllFiles = async () => {
    if (!sessionId) {
      onNotify && onNotify("Session ID required for download", "error");
      return;
    }

    try {
      onNotify &&
        onNotify("Preparing Terraform archive from cloud storage...", "info");

      // Usa il nuovo endpoint per scaricare l'archivio dei file Terraform
      await apiService.downloadFile("terraform", sessionId);

      onNotify &&
        onNotify("Terraform files downloaded successfully", "success");
    } catch (error) {
      console.error("Error downloading files:", error);
      onNotify &&
        onNotify(`Error downloading files: ${error.message}`, "error");
    }
  };

  /**
   * Ottiene l'icona per un tipo di file Terraform
   */
  const getFileIcon = (fileType) => {
    switch (fileType) {
      case "network":
        return <Server size={16} className="text-blue-500" />;
      case "compute":
        return <Server size={16} className="text-green-500" />;
      case "output":
        return <FileText size={16} className="text-purple-500" />;
      case "variables":
        return <FileText size={16} className="text-amber-500" />;
      case "configuration":
        return <Database size={16} className="text-indigo-500" />;
      default:
        return <FileCode size={16} className="text-gray-500" />;
    }
  };

  /**
   * Verifica se ci sono modifiche non salvate
   */
  const hasUnsavedChanges = () => {
    return isEditing && fileContent !== originalContent;
  };

  /**
   * Formatta la dimensione del file in modo leggibile
   */
  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Se non è connesso al cloud, mostra un messaggio
  if (!isCloudConnected) {
    return (
      <div className="flex flex-col items-center justify-center bg-yellow-50 p-8 rounded-lg shadow-md min-h-[400px] border border-yellow-200">
        <div className="text-center text-yellow-700">
          <AlertCircle size={48} className="mx-auto mb-4 text-yellow-500" />
          <h3 className="text-lg font-semibold mb-2">
            Cloud Storage Not Connected
          </h3>
          <p className="mb-4">
            Cloud storage connection is required to view Terraform files.
          </p>
          <p className="text-sm">
            Please enable cloud integration to access your stored
            configurations.
          </p>
        </div>
      </div>
    );
  }

  // Se non abbiamo un sessionId, mostra un messaggio
  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center bg-white p-8 rounded-lg shadow-md min-h-[400px]">
        <div className="text-center text-gray-500">
          <FileCode size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">No Session Available</h3>
          <p className="mb-4">No Terraform configuration available yet.</p>
          <p>Please run an analysis first to generate Terraform files.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden h-full">
      <div className="flex flex-col md:flex-row h-full">
        {/* Sidebar con lista file */}
        <div className="w-full md:w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center mb-2">
              <Cloud size={20} className="text-blue-500 mr-2" />
              <h3 className="text-lg font-semibold">Terraform Files</h3>
            </div>
            {storageInfo && (
              <div className="text-xs text-gray-500">
                <p>Session: {storageInfo.sessionId}</p>
                <p>Location: {storageInfo.storageLocation}</p>
                <p>Files: {storageInfo.totalFiles}</p>
              </div>
            )}
          </div>

          {/* Azioni globali */}
          <div className="p-3 border-b border-gray-200 bg-gray-100">
            <div className="flex justify-between">
              <button
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center disabled:opacity-50"
                onClick={fetchTerraformFiles}
                disabled={isLoading}
              >
                <RefreshCw
                  size={14}
                  className={`mr-1 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <button
                className="text-green-600 hover:text-green-800 text-sm flex items-center disabled:opacity-50"
                onClick={handleDownloadAllFiles}
                disabled={fileList.length === 0}
              >
                <Download size={14} className="mr-1" />
                Download All
              </button>
            </div>
          </div>

          {/* Lista file */}
          {isLoading && fileList.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin h-5 w-5 border-b-2 border-gray-500 rounded-full mx-auto mb-2"></div>
              <p>Loading files from cloud storage...</p>
            </div>
          ) : error && fileList.length === 0 ? (
            <div className="p-4 text-center text-red-500">
              <AlertCircle size={20} className="mx-auto mb-2" />
              <p className="text-sm">{error}</p>
              <button
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                onClick={fetchTerraformFiles}
              >
                Try Again
              </button>
            </div>
          ) : fileList.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <FileCode size={20} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No Terraform files found</p>
              <p className="text-xs mt-1">
                Generate files through analysis first
              </p>
            </div>
          ) : (
            <div className="p-2">
              {fileList.map((file) => (
                <div
                  key={file.id}
                  className={`p-3 mb-2 rounded cursor-pointer transition-colors ${
                    selectedFile?.id === file.id
                      ? "bg-blue-100 border border-blue-300"
                      : "bg-white hover:bg-gray-100 border border-gray-200"
                  }`}
                  onClick={() => handleFileSelect(file)}
                >
                  <div className="flex items-center">
                    {getFileIcon(file.type)}
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {file.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {file.type} • {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Area principale per visualizzazione/editing */}
        <div className="flex-1 flex flex-col">
          {selectedFile ? (
            <>
              {/* Header del file */}
              <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getFileIcon(selectedFile.type)}
                    <div className="ml-3">
                      <h3 className="text-lg font-semibold">
                        {selectedFile.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {selectedFile.type} •{" "}
                        {formatFileSize(selectedFile.size)} • Cloud Storage
                      </p>
                    </div>
                  </div>

                  {/* Azioni del file */}
                  <div className="flex items-center space-x-2">
                    {hasUnsavedChanges() && (
                      <div className="flex items-center text-amber-600 text-sm">
                        <Info size={14} className="mr-1" />
                        Unsaved changes
                      </div>
                    )}

                    {isEditing ? (
                      <>
                        <button
                          className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
                          onClick={handleSaveChanges}
                          disabled={isSaving || fileContent === originalContent}
                        >
                          {isSaving ? (
                            <RefreshCw
                              size={14}
                              className="mr-1 animate-spin"
                            />
                          ) : (
                            <Save size={14} className="mr-1" />
                          )}
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="flex items-center px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                        >
                          <X size={14} className="mr-1" />
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                          onClick={handleEditToggle}
                        >
                          <Edit2 size={14} className="mr-1" />
                          Edit
                        </button>
                        <button
                          className="flex items-center px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                          onClick={handleDownloadFile}
                        >
                          <Download size={14} className="mr-1" />
                          Download
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Area di contenuto */}
              <div className="flex-1 p-4 overflow-hidden">
                {isFileContentLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full mx-auto mb-4"></div>
                      <p className="text-gray-500">
                        Loading file from cloud storage...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full">
                    {isEditing ? (
                      <textarea
                        className="w-full h-full p-4 border border-gray-300 rounded font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={fileContent}
                        onChange={handleContentChange}
                        placeholder="Terraform configuration content..."
                      />
                    ) : (
                      <pre className="w-full h-full p-4 bg-gray-50 border border-gray-200 rounded overflow-auto font-mono text-sm">
                        {fileContent || "No content available"}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <FileCode size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">Select a File</h3>
                <p>
                  Choose a Terraform file from the sidebar to view or edit it.
                </p>
                {fileList.length > 0 && (
                  <p className="text-sm mt-2">
                    {fileList.length} file{fileList.length !== 1 ? "s" : ""}{" "}
                    available in cloud storage
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TerraformViewer;
