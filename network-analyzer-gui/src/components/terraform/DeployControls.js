// src/components/terraform/DeployControls.js
import { useState, useEffect } from "react";
import {
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Terminal,
  RotateCw,
  Loader2,
  Trash2,
  Info,
  Eye,
  Cloud,
  CloudOff,
  UploadCloud,
  Check,
  Download,
  Database,
  RefreshCw,
} from "lucide-react";
import apiService from "../../services/apiService";

/**
 * Componente per controllare il deploy dell'infrastruttura Terraform utilizzando file da GCS
 *
 * @param {Object} props - Proprietà del componente
 * @param {string} props.sessionId - ID della sessione per identificare i file Terraform
 * @param {Function} props.onNotify - Handler per mostrare notifiche
 * @param {boolean} props.isCloudConnected - Se l'app è connessa al cloud
 * @param {Function} props.onToggleCloud - Handler per attivare/disattivare la connessione al cloud
 */
const DeployControls = ({
  sessionId,
  onNotify,
  isCloudConnected,
  onToggleCloud,
}) => {
  const [status, setStatus] = useState({
    isInitialized: false,
    isDeployed: false,
    outputs: {},
    storageLocation: null,
  });

  const [deployStage, setDeployStage] = useState("idle"); // idle, validating, planning, applying, destroying, downloading
  const [deployOutput, setDeployOutput] = useState("");
  const [isOutputVisible, setIsOutputVisible] = useState(false);
  const [planSummary, setPlanSummary] = useState(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [planFile, setPlanFile] = useState(null);
  const [filesAvailable, setFilesAvailable] = useState(false);

  // Stati per il componente CloudStorageOptions
  const [cloudBucket, setCloudBucket] = useState("");
  const [cloudLoadingStates, setCloudLoadingStates] = useState({
    cloud: false,
    refresh: false,
  });
  const [cloudCompletedStates, setCloudCompletedStates] = useState({
    cloud: false,
  });

  // Verifica lo stato dell'infrastruttura all'avvio
  useEffect(() => {
    if (sessionId && isCloudConnected) {
      checkTerraformStatus();
      checkTerraformFiles();
    } else {
      setIsStatusLoading(false);
    }
  }, [sessionId, isCloudConnected]);

  /**
   * Verifica se i file Terraform sono disponibili su GCS
   */
  const checkTerraformFiles = async () => {
    try {
      const response = await apiService.getTerraformFiles(sessionId);
      if (
        response.status === "success" &&
        response.files &&
        response.files.length > 0
      ) {
        setFilesAvailable(true);
        setStatus((prev) => ({
          ...prev,
          storageLocation: `results/${sessionId}/terraform/`,
        }));
      } else {
        setFilesAvailable(false);
      }
    } catch (error) {
      console.error("Error checking Terraform files:", error);
      setFilesAvailable(false);
    }
  };

  /**
   * Verifica lo stato attuale dell'infrastruttura Terraform
   */
  const checkTerraformStatus = async () => {
    setIsStatusLoading(true);

    try {
      const result = await apiService.getTerraformStatus(sessionId);

      if (result.status === "success") {
        setStatus((prev) => ({
          ...prev,
          isInitialized: result.is_initialized || false,
          isDeployed: result.is_deployed || false,
          outputs: result.outputs || {},
        }));
      }
    } catch (error) {
      console.error("Error checking Terraform status:", error);
      onNotify &&
        onNotify(
          `Error checking infrastructure status: ${error.message}`,
          "error"
        );
    } finally {
      setIsStatusLoading(false);
    }
  };

  // Inizializza Terraform scaricando i file da GCS
  const handleInit = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    if (!filesAvailable) {
      onNotify("No Terraform files found in cloud storage", "warning");
      return;
    }

    setDeployStage("downloading");
    setDeployOutput("Downloading Terraform files from cloud storage...\n");
    setIsOutputVisible(true);

    try {
      const result = await apiService.initTerraform(sessionId);

      if (result.status === "success") {
        setDeployOutput(
          (prev) =>
            prev +
            `${result.output}\n\nTerraform initialized successfully from cloud storage.\n`
        );
        setStatus((prev) => ({ ...prev, isInitialized: true }));
        onNotify(
          "Terraform initialized successfully from cloud storage",
          "success"
        );

        // Aggiorna il bucket name dai risultati se disponibile
        if (result.bucket_name) {
          setCloudBucket(result.bucket_name);
        }
      } else {
        setDeployOutput((prev) => prev + `Error: ${result.error}\n`);
        onNotify("Terraform initialization failed", "error");
      }
    } catch (error) {
      setDeployOutput((prev) => prev + `Error: ${error.message}\n`);
      onNotify(`Initialization failed: ${error.message}`, "error");
    } finally {
      setDeployStage("idle");
    }
  };

  // Valida la configurazione Terraform
  const handleValidate = async () => {
    if (!status.isInitialized) {
      onNotify("Please initialize Terraform first", "warning");
      return;
    }

    setDeployStage("validating");
    setDeployOutput("Validating Terraform configuration...\n");
    setIsOutputVisible(true);

    try {
      const result = await apiService.validateTerraform(sessionId);

      if (result.status === "success") {
        setDeployOutput(
          (prev) =>
            prev + `${result.output}\nTerraform configuration is valid.\n`
        );
        onNotify("Terraform configuration is valid", "success");
      } else {
        setDeployOutput((prev) => prev + `Error: ${result.error}\n`);
        onNotify("Terraform configuration is invalid", "error");
      }
    } catch (error) {
      setDeployOutput((prev) => prev + `Error: ${error.message}\n`);
      onNotify(`Validation failed: ${error.message}`, "error");
    } finally {
      setDeployStage("idle");
    }
  };

  // Crea un piano Terraform
  const handlePlan = async () => {
    if (!status.isInitialized) {
      // Se non è stato inizializzato, lo facciamo adesso
      await handleInit();
      if (deployStage === "idle" && !status.isInitialized) {
        return; // Se l'inizializzazione è fallita, fermati
      }
    }

    setDeployStage("planning");
    setDeployOutput((prev) => prev + "Creating Terraform plan...\n");
    setIsOutputVisible(true);

    try {
      const result = await apiService.planTerraform(sessionId);

      if (result.status === "success") {
        setDeployOutput(
          (prev) =>
            prev + `${result.output}\n\nTerraform plan created successfully.\n`
        );
        setPlanFile(result.plan_file);
        setPlanSummary(result.plan_summary);
        onNotify("Terraform plan created successfully", "success");
      } else {
        setDeployOutput((prev) => prev + `Error: ${result.error}\n`);
        onNotify("Failed to create Terraform plan", "error");
      }
    } catch (error) {
      setDeployOutput((prev) => prev + `Error: ${error.message}\n`);
      onNotify(`Planning failed: ${error.message}`, "error");
    } finally {
      setDeployStage("idle");
    }
  };

  // Applica la configurazione Terraform
  const handleApply = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    if (!status.isInitialized) {
      onNotify("Please initialize Terraform first", "warning");
      return;
    }

    // Se non abbiamo un piano, chiedi se creare uno
    if (!planFile) {
      if (
        !window.confirm(
          "No plan file found. Do you want to apply the configuration directly?"
        )
      ) {
        return;
      }
    }

    setDeployStage("applying");
    setDeployOutput((prev) => prev + "Applying Terraform configuration...\n");
    setIsOutputVisible(true);

    try {
      const result = await apiService.applyTerraform(sessionId, planFile, true);

      if (result.status === "success") {
        setDeployOutput(
          (prev) =>
            prev +
            `${result.output}\n\nTerraform infrastructure deployed successfully!\n`
        );
        setStatus((prev) => ({
          ...prev,
          isDeployed: true,
          outputs: result.terraform_outputs,
        }));
        onNotify("Infrastructure deployed successfully", "success");

        // Reset del piano dopo l'applicazione
        setPlanFile(null);
        setPlanSummary(null);
      } else {
        setDeployOutput((prev) => prev + `Error: ${result.error}\n`);
        onNotify("Failed to deploy infrastructure", "error");
      }
    } catch (error) {
      setDeployOutput((prev) => prev + `Error: ${error.message}\n`);
      onNotify(`Apply failed: ${error.message}`, "error");
    } finally {
      setDeployStage("idle");
    }
  };

  // Distruggi l'infrastruttura Terraform
  const handleDestroy = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    if (!status.isInitialized) {
      onNotify("Infrastructure not initialized", "warning");
      return;
    }

    // Richiedi conferma prima di distruggere
    if (
      !window.confirm(
        "Are you sure you want to destroy all the infrastructure? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeployStage("destroying");
    setDeployOutput(
      (prev) => prev + "Destroying Terraform infrastructure...\n"
    );
    setIsOutputVisible(true);

    try {
      const result = await apiService.destroyTerraform(sessionId, true);

      if (result.status === "success") {
        setDeployOutput(
          (prev) =>
            prev +
            `${result.output}\n\nTerraform infrastructure destroyed successfully.\n`
        );
        setStatus((prev) => ({ ...prev, isDeployed: false, outputs: {} }));
        onNotify("Infrastructure destroyed successfully", "success");

        // Reset del piano dopo la distruzione
        setPlanFile(null);
        setPlanSummary(null);
      } else {
        setDeployOutput((prev) => prev + `Error: ${result.error}\n`);
        onNotify("Failed to destroy infrastructure", "error");
      }
    } catch (error) {
      setDeployOutput((prev) => prev + `Error: ${error.message}\n`);
      onNotify(`Destroy failed: ${error.message}`, "error");
    } finally {
      setDeployStage("idle");
    }
  };

  // Toggle visualizzazione output
  const toggleOutputVisibility = () => {
    setIsOutputVisible(!isOutputVisible);
  };

  /**
   * Refresh dello stato dei file e dell'infrastruttura
   */
  const handleRefreshStatus = async () => {
    setCloudLoadingStates((prev) => ({ ...prev, refresh: true }));

    try {
      await checkTerraformFiles();
      await checkTerraformStatus();
      onNotify("Status refreshed successfully", "success");
    } catch (error) {
      onNotify(`Error refreshing status: ${error.message}`, "error");
    } finally {
      setCloudLoadingStates((prev) => ({ ...prev, refresh: false }));
    }
  };

  /**
   * Gestisce l'esportazione/backup dei file Terraform su cloud
   */
  const handleCloudBackup = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    setCloudLoadingStates((prev) => ({ ...prev, cloud: true }));

    try {
      // Questo endpoint dovrebbe salvare una copia di backup dei file correnti
      await apiService.downloadFile("terraform", sessionId);

      onNotify("Terraform files backed up successfully", "success");
      setCloudCompletedStates((prev) => ({ ...prev, cloud: true }));
    } catch (error) {
      onNotify(`Error creating backup: ${error.message}`, "error");
    } finally {
      setCloudLoadingStates((prev) => ({ ...prev, cloud: false }));

      setTimeout(() => {
        setCloudCompletedStates((prev) => ({ ...prev, cloud: false }));
      }, 3000);
    }
  };

  // Elementi UI in base allo stato del deploy
  const renderStatusLabel = () => {
    if (isStatusLoading) {
      return (
        <div className="flex items-center text-gray-600">
          <Loader2 size={16} className="mr-2 animate-spin" />
          <span>Checking status...</span>
        </div>
      );
    }

    if (!isCloudConnected) {
      return (
        <div className="flex items-center text-amber-600">
          <CloudOff size={16} className="mr-2" />
          <span>Cloud disconnected</span>
        </div>
      );
    }

    if (!filesAvailable) {
      return (
        <div className="flex items-center text-amber-600">
          <Database size={16} className="mr-2" />
          <span>No files in storage</span>
        </div>
      );
    }

    if (status.isDeployed) {
      return (
        <div className="flex items-center text-green-600">
          <CheckCircle size={16} className="mr-2" />
          <span>Infrastructure deployed on GCP</span>
        </div>
      );
    }

    if (status.isInitialized) {
      return (
        <div className="flex items-center text-amber-600">
          <AlertTriangle size={16} className="mr-2" />
          <span>Initialized, not deployed</span>
        </div>
      );
    }

    return (
      <div className="flex items-center text-gray-600">
        <Info size={16} className="mr-2" />
        <span>Not initialized</span>
      </div>
    );
  };

  // Renderizza pulsanti di azione in base allo stato
  const renderActionButtons = () => {
    const isLoading = deployStage !== "idle";

    return (
      <div className="flex flex-wrap gap-2">
        {/* Pulsante refresh status */}
        <ActionButton
          icon={<RefreshCw size={16} />}
          label="Refresh"
          onClick={handleRefreshStatus}
          disabled={cloudLoadingStates.refresh}
          isLoading={cloudLoadingStates.refresh}
          color="indigo"
        />

        {/* Pulsante init */}
        <ActionButton
          icon={
            status.isInitialized ? (
              <CheckCircle size={16} />
            ) : (
              <RotateCw size={16} />
            )
          }
          label="Initialize"
          onClick={handleInit}
          disabled={isLoading || !isCloudConnected || !filesAvailable}
          color={status.isInitialized ? "success" : "blue"}
          isLoading={deployStage === "downloading"}
        />

        {/* Pulsante validate */}
        <ActionButton
          icon={<CheckCircle size={16} />}
          label="Validate"
          onClick={handleValidate}
          disabled={isLoading || !status.isInitialized}
          color="indigo"
          isLoading={deployStage === "validating"}
        />

        {/* Pulsante plan */}
        <ActionButton
          icon={planFile ? <CheckCircle size={16} /> : <Eye size={16} />}
          label="Plan"
          onClick={handlePlan}
          disabled={isLoading || !isCloudConnected}
          color={planFile ? "success" : "amber"}
          isLoading={deployStage === "planning"}
        />

        {/* Pulsante apply */}
        <ActionButton
          icon={<Play size={16} />}
          label="Apply"
          onClick={handleApply}
          disabled={isLoading || !status.isInitialized || !isCloudConnected}
          color="green"
          isLoading={deployStage === "applying"}
        />

        {/* Pulsante destroy (solo se è deployato) */}
        {status.isDeployed && (
          <ActionButton
            icon={<Trash2 size={16} />}
            label="Destroy"
            onClick={handleDestroy}
            disabled={isLoading || !isCloudConnected}
            color="red"
            isLoading={deployStage === "destroying"}
          />
        )}
      </div>
    );
  };

  // Mostra il sommario del piano
  const renderPlanSummary = () => {
    if (!planSummary) return null;

    return (
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">Plan Summary</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-green-600 font-semibold">
              {planSummary.to_add || 0}
            </div>
            <div className="text-gray-600">to add</div>
          </div>
          <div className="text-center">
            <div className="text-yellow-600 font-semibold">
              {planSummary.to_change || 0}
            </div>
            <div className="text-gray-600">to change</div>
          </div>
          <div className="text-center">
            <div className="text-red-600 font-semibold">
              {planSummary.to_destroy || 0}
            </div>
            <div className="text-gray-600">to destroy</div>
          </div>
        </div>
      </div>
    );
  };

  // Mostra gli output dell'infrastruttura deployata
  const renderOutputs = () => {
    if (
      !status.isDeployed ||
      !status.outputs ||
      Object.keys(status.outputs).length === 0
    ) {
      return null;
    }

    return (
      <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h4 className="font-semibold text-green-800 mb-2">
          Infrastructure Outputs
        </h4>
        <div className="space-y-2">
          {Object.entries(status.outputs).map(([key, value]) => (
            <div
              key={key}
              className="flex justify-between items-center text-sm"
            >
              <span className="font-medium text-gray-700">{key}:</span>
              <span className="text-green-700 font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Console per visualizzare l'output
  const renderOutputConsole = () => {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium">Terraform Output</h4>
          <button
            onClick={toggleOutputVisibility}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <Terminal size={16} className="mr-1" />
            {isOutputVisible ? "Hide" : "Show"} Console
          </button>
        </div>

        {isOutputVisible && (
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
            {deployOutput || "No output yet..."}
          </div>
        )}
      </div>
    );
  };

  // Avviso quando non si è connessi al cloud
  const renderCloudConnectionWarning = () => {
    if (isCloudConnected) return null;

    return (
      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center">
          <CloudOff className="h-5 w-5 text-amber-600 mr-3" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-amber-800">
              Cloud Connection Required
            </h4>
            <p className="text-sm text-amber-700 mt-1">
              Terraform files are stored in Google Cloud Storage. Connect to GCP
              to deploy infrastructure.
            </p>
          </div>
          <button
            onClick={onToggleCloud}
            className="ml-4 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm"
          >
            Connect to GCP
          </button>
        </div>
      </div>
    );
  };

  // Storage info display
  const renderStorageInfo = () => {
    if (!isCloudConnected || !status.storageLocation) return null;

    return (
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center text-sm text-blue-800">
          <Database size={16} className="mr-2" />
          <span>
            Storage location:{" "}
            <code className="bg-blue-100 px-1 rounded">
              {status.storageLocation}
            </code>
          </span>
          {cloudBucket && (
            <span className="ml-3">
              Bucket:{" "}
              <code className="bg-blue-100 px-1 rounded">{cloudBucket}</code>
            </span>
          )}
        </div>
      </div>
    );
  };

  /**
   * Componente per le opzioni di archiviazione cloud
   */
  const CloudStorageOptions = () => {
    return (
      <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Cloud Storage Options</h3>

        <div className="mb-6">
          <div className="mb-4">
            <button
              className={`flex items-center py-2 px-4 rounded ${
                isCloudConnected
                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
              onClick={onToggleCloud}
            >
              {isCloudConnected ? (
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

          {isCloudConnected && (
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium">
                Files Status
              </label>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    Session:{" "}
                    <code className="bg-gray-200 px-1 rounded">
                      {sessionId || "N/A"}
                    </code>
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      filesAvailable ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {filesAvailable ? "Files Available" : "No Files Found"}
                  </span>
                </div>
                {status.storageLocation && (
                  <div className="mt-2 text-xs text-gray-500">
                    Location: {status.storageLocation}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!isCloudConnected && (
          <div className="mb-6 bg-amber-50 p-4 rounded-lg border border-amber-200">
            <div className="flex items-start">
              <Info
                size={20}
                className="text-amber-500 mr-3 mt-1 flex-shrink-0"
              />
              <p className="text-amber-700 text-sm">
                Connect to Google Cloud Platform to enable cloud deployment of
                Terraform infrastructure.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            onClick={handleCloudBackup}
            disabled={
              !isCloudConnected || cloudLoadingStates.cloud || !filesAvailable
            }
          >
            {cloudLoadingStates.cloud ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                Creating Backup...
              </>
            ) : cloudCompletedStates.cloud ? (
              <>
                <Check size={20} className="mr-2" />
                Backup Created
              </>
            ) : (
              <>
                <Download size={20} className="mr-2" />
                Backup Files
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Renderizza un messaggio se non c'è sessionId
  if (!sessionId) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-500">
          <Database size={48} className="mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">No Session Available</h3>
          <p className="text-center max-w-md">
            A valid session ID is required to deploy infrastructure. Please run
            an analysis first to generate Terraform files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Terraform Deployment</h3>
        {renderStatusLabel()}
      </div>

      {renderCloudConnectionWarning()}
      {renderStorageInfo()}

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-4">
          Deploy the infrastructure to Google Cloud Platform using Terraform
          files stored in cloud storage.
        </p>

        {renderActionButtons()}
      </div>

      {renderPlanSummary()}
      {renderOutputs()}
      {renderOutputConsole()}

      {/* Componente opzioni cloud */}
      <CloudStorageOptions />
    </div>
  );
};

/**
 * Pulsante di azione per le operazioni Terraform
 */
const ActionButton = ({ icon, label, onClick, disabled, color, isLoading }) => {
  // Mappatura dei colori alle classi Tailwind
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    green: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
    amber: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
    red: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    indigo: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
    success:
      "bg-green-100 text-green-800 hover:bg-green-200 focus:ring-green-300",
  };

  const buttonClass =
    color === "success" ? "border border-green-500" : "text-white";

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${
        colorClasses[color] || colorClasses.blue
      } ${buttonClass} px-3 py-1.5 rounded-md flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isLoading ? <Loader2 size={16} className="mr-1 animate-spin" /> : icon}
      <span className="ml-1">{label}</span>
    </button>
  );
};

export default DeployControls;
