// src/components/tabs/TerraformTab.js
import React, { useState, useEffect } from "react";
import {
  Cloud,
  CloudOff,
  Database,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import TerraformViewer from "../terraform/TerraformViewer";
import DeployControls from "../terraform/DeployControls";

/**
 * Componente per la scheda che mostra e permette di modificare i file Terraform
 * e di deployare l'infrastruttura utilizzando Google Cloud Storage
 *
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.results - Risultati dell'analisi contenenti session_id
 * @param {boolean} props.isCloudConnected - Indica se è attiva la connessione al cloud
 * @param {Function} props.onNotify - Handler per mostrare notifiche
 * @param {Function} props.onToggleCloud - Handler per attivare/disattivare la connessione al cloud
 */
const TerraformTab = ({
  results,
  isCloudConnected,
  onNotify,
  onToggleCloud,
}) => {
  const [selectedSection, setSelectedSection] = useState("files"); // files, deploy
  const [sessionId, setSessionId] = useState(null);
  const [storageStatus, setStorageStatus] = useState("checking"); // checking, available, unavailable

  // Estrai sessionId dai risultati
  useEffect(() => {
    if (results && results.session_id) {
      setSessionId(results.session_id);
      setStorageStatus("available");
    } else if (
      results &&
      results.output_paths &&
      results.output_paths.terraform
    ) {
      // Fallback per compatibilità con versioni precedenti
      const path = results.output_paths.terraform;
      const sessionMatch = path.match(/session_([^/]+)/);
      if (sessionMatch) {
        setSessionId(sessionMatch[1]);
        setStorageStatus("available");
      } else {
        setStorageStatus("unavailable");
      }
    } else {
      setStorageStatus("unavailable");
    }
  }, [results]);

  /**
   * Verifica se i file Terraform sono disponibili
   */
  const hasTerraformFiles = () => {
    return sessionId && isCloudConnected && storageStatus === "available";
  };

  /**
   * Render dello stato di connessione cloud
   */
  const renderCloudStatus = () => {
    if (!isCloudConnected) {
      return (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center">
            <CloudOff className="h-5 w-5 text-amber-600 mr-3" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-800">
                Cloud Storage Disconnected
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Terraform files are stored in cloud storage. Please enable cloud
                integration to access your configurations.
              </p>
            </div>
            <button
              onClick={onToggleCloud}
              className="ml-4 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm"
            >
              Connect Cloud
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center">
          <Cloud className="h-4 w-4 text-green-600 mr-2" />
          <span className="text-sm text-green-800 font-medium">
            Connected to Google Cloud Storage
          </span>
          {sessionId && (
            <span className="ml-3 text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
              Session: {sessionId.substring(0, 8)}...
            </span>
          )}
        </div>
      </div>
    );
  };

  /**
   * Render del messaggio quando non ci sono file Terraform
   */
  const renderNoFiles = () => {
    const reasons = [];

    if (!results) {
      reasons.push("No analysis results available");
    }
    if (!sessionId) {
      reasons.push("No session ID found in results");
    }
    if (!isCloudConnected) {
      reasons.push("Cloud storage is not connected");
    }

    return (
      <div className="flex flex-col items-center justify-center bg-white p-8 rounded-lg shadow-md min-h-[400px]">
        <div className="text-center text-gray-500 max-w-md">
          <Database size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-3">
            No Terraform Configuration Available
          </h3>

          {reasons.length > 0 && (
            <div className="mb-4">
              <p className="text-sm mb-2">Possible reasons:</p>
              <ul className="text-xs text-left bg-gray-50 p-3 rounded border">
                {reasons.map((reason, index) => (
                  <li key={index} className="flex items-center mb-1">
                    <AlertTriangle
                      size={12}
                      className="text-amber-500 mr-2 flex-shrink-0"
                    />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-sm">
            <p className="mb-2">To access Terraform files:</p>
            <ol className="text-left bg-blue-50 p-3 rounded border text-blue-800">
              <li>1. Run a network analysis to generate Terraform files</li>
              <li>2. Ensure cloud storage integration is enabled</li>
              <li>
                3. Wait for the analysis to complete and upload files to storage
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render della sezione Files
   */
  const renderFilesSection = () => {
    if (!hasTerraformFiles()) {
      return renderNoFiles();
    }

    return (
      <div className="h-full">
        <TerraformViewer
          sessionId={sessionId}
          onNotify={onNotify}
          isCloudConnected={isCloudConnected}
        />
      </div>
    );
  };

  /**
   * Render della sezione Deploy
   */
  const renderDeploySection = () => {
    if (!hasTerraformFiles()) {
      return renderNoFiles();
    }

    return (
      <div className="h-full">
        <DeployControls
          sessionId={sessionId}
          isCloudConnected={isCloudConnected}
          onNotify={onNotify}
          onToggleCloud={onToggleCloud}
        />
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-16rem)]">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">Terraform Configuration</h2>
        <p className="text-gray-600">
          View, edit, and deploy your generated Terraform infrastructure stored
          on Google Cloud Platform.
        </p>
      </div>

      {/* Cloud Status */}
      {renderCloudStatus()}

      {/* Tabs per selezionare la sezione */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex">
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none transition-colors ${
              selectedSection === "files"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setSelectedSection("files")}
          >
            <div className="flex items-center">
              <Database size={16} className="mr-2" />
              Configuration Files
              {hasTerraformFiles() && (
                <CheckCircle size={14} className="ml-2 text-green-500" />
              )}
            </div>
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none transition-colors ${
              selectedSection === "deploy"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setSelectedSection("deploy")}
          >
            <div className="flex items-center">
              <Cloud size={16} className="mr-2" />
              Deploy Infrastructure
              {!hasTerraformFiles() && (
                <AlertTriangle size={14} className="ml-2 text-amber-500" />
              )}
            </div>
          </button>
        </nav>
      </div>

      {/* Info sulla sessione */}
      {sessionId && isCloudConnected && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center text-sm text-blue-800">
            <Info size={16} className="mr-2" />
            <span>
              Terraform files are stored in cloud storage at:{" "}
              <code className="bg-blue-100 px-1 rounded">
                results/{sessionId}/terraform/
              </code>
            </span>
          </div>
        </div>
      )}

      {/* Contenuto in base alla sezione selezionata */}
      <div className="flex-1 overflow-hidden">
        {selectedSection === "files"
          ? renderFilesSection()
          : renderDeploySection()}
      </div>
    </div>
  );
};

export default TerraformTab;
