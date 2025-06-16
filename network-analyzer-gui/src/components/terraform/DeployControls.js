import React, { useState, useEffect } from "react";
import {
  Play,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle,
  RotateCw,
  Loader2,
  Terminal,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

const DeployControls = ({
  terraformPath,
  sessionId,
  onNotify,
  isCloudConnected,
  apiService,
}) => {
  // Stati per il deployment
  const [status, setStatus] = useState({
    isInitialized: false,
    isDeployed: false,
    outputs: {},
  });
  const [deployStage, setDeployStage] = useState("idle");
  const [deployOutput, setDeployOutput] = useState("");
  const [isOutputVisible, setIsOutputVisible] = useState(false);
  const [planFile, setPlanFile] = useState(null);
  const [planSummary, setPlanSummary] = useState(null);

  // Check dello stato Terraform all'avvio
  useEffect(() => {
    if (isCloudConnected && sessionId) {
      checkTerraformStatus();
    }
  }, [isCloudConnected, sessionId]);

  // Verifica stato Terraform
  const checkTerraformStatus = async () => {
    try {
      const result = await apiService.getTerraformStatus(sessionId);
      setStatus(result);
    } catch (error) {
      console.warn("Could not check Terraform status:", error);
    }
  };

  // Inizializza Terraform
  const handleInit = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    setDeployStage("initializing");
    setDeployOutput((prev) => prev + "Initializing Terraform...\n");
    setIsOutputVisible(true);

    try {
      const result = await apiService.initTerraform(sessionId, true);

      if (result.status === "success") {
        setDeployOutput(
          (prev) =>
            prev + `${result.output}\n\nTerraform initialized successfully.\n`
        );
        setStatus((prev) => ({ ...prev, isInitialized: true }));
        onNotify("Terraform initialized successfully", "success");
      } else {
        setDeployOutput((prev) => prev + `Error: ${result.error}\n`);
        onNotify("Failed to initialize Terraform", "error");
      }
    } catch (error) {
      setDeployOutput((prev) => prev + `Error: ${error.message}\n`);
      onNotify(`Initialization failed: ${error.message}`, "error");
    } finally {
      setDeployStage("idle");
    }
  };

  // Valida configurazione Terraform
  const handleValidate = async () => {
    if (!status.isInitialized) {
      onNotify("Please initialize Terraform first", "warning");
      return;
    }

    setDeployStage("validating");
    setDeployOutput((prev) => prev + "Validating Terraform configuration...\n");
    setIsOutputVisible(true);

    try {
      const result = await apiService.validateTerraform(sessionId, true);

      if (result.status === "success") {
        setDeployOutput(
          (prev) => prev + `${result.output}\n\nConfiguration is valid.\n`
        );
        onNotify("Configuration validated successfully", "success");
      } else {
        setDeployOutput((prev) => prev + `Error: ${result.error}\n`);
        onNotify("Configuration validation failed", "error");
      }
    } catch (error) {
      setDeployOutput((prev) => prev + `Error: ${error.message}\n`);
      onNotify(`Validation failed: ${error.message}`, "error");
    } finally {
      setDeployStage("idle");
    }
  };

  // Crea piano Terraform
  const handlePlan = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    setDeployStage("planning");
    setDeployOutput((prev) => prev + "Creating Terraform plan...\n");
    setIsOutputVisible(true);

    try {
      const result = await apiService.planTerraform(sessionId, true);

      if (result.status === "success") {
        setDeployOutput(
          (prev) => prev + `${result.output}\n\nPlan created successfully.\n`
        );
        setPlanFile(result.plan_file);
        setPlanSummary(result.plan_summary);
        onNotify("Plan created successfully", "success");
      } else {
        setDeployOutput((prev) => prev + `Error: ${result.error}\n`);
        onNotify("Failed to create plan", "error");
      }
    } catch (error) {
      setDeployOutput((prev) => prev + `Error: ${error.message}\n`);
      onNotify(`Plan failed: ${error.message}`, "error");
    } finally {
      setDeployStage("idle");
    }
  };

  // Applica configurazione Terraform
  const handleApply = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    // Conferma se non c'è un piano
    if (
      !planFile &&
      !window.confirm(
        "No plan file found. Do you want to apply the configuration directly?"
      )
    ) {
      return;
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
      onNotify(
        "Terraform not initialized. Cannot destroy infrastructure.",
        "warning"
      );
      return;
    }

    // Messaggio di conferma personalizzato basato sullo stato
    const confirmMessage = status.isDeployed
      ? "Are you sure you want to destroy all the deployed infrastructure? This action cannot be undone."
      : "Are you sure you want to run terraform destroy? This will attempt to destroy any existing infrastructure.";

    if (!window.confirm(confirmMessage)) {
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

  // Refresh stato
  const handleRefreshStatus = async () => {
    if (!isCloudConnected || !sessionId) return;

    try {
      await checkTerraformStatus();
      onNotify("Status refreshed successfully", "success");
    } catch (error) {
      onNotify("Failed to refresh status", "error");
    }
  };

  // Determina se un'operazione è in corso
  const isLoading = deployStage !== "idle";

  // Renderizza etichetta di stato
  const renderStatusLabel = () => {
    const getStatusInfo = () => {
      if (status.isDeployed) {
        return {
          text: "Deployed",
          color: "bg-green-100 text-green-800",
          icon: <CheckCircle size={14} />,
        };
      } else if (status.isInitialized) {
        return {
          text: "Initialized",
          color: "bg-blue-100 text-blue-800",
          icon: <CheckCircle size={14} />,
        };
      } else {
        return {
          text: "Not Initialized",
          color: "bg-gray-100 text-gray-800",
          icon: <AlertTriangle size={14} />,
        };
      }
    };

    const statusInfo = getStatusInfo();

    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}
        >
          {statusInfo.icon}
          <span className="ml-1">{statusInfo.text}</span>
        </span>
        <button
          onClick={handleRefreshStatus}
          disabled={isLoading || !isCloudConnected}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
          title="Refresh status"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    );
  };

  // Warning se non connesso al cloud
  const renderCloudConnectionWarning = () => {
    if (isCloudConnected) return null;

    return (
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
          <p className="text-sm text-yellow-700">
            Not connected to Google Cloud. Please configure your cloud
            connection first.
          </p>
        </div>
      </div>
    );
  };

  // Renderizza i pulsanti di azione
  const renderActionButtons = () => {
    return (
      <div className="flex flex-wrap gap-2">
        {/* Pulsante initialize */}
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
          disabled={isLoading || !isCloudConnected}
          color={status.isInitialized ? "success" : "blue"}
          isLoading={deployStage === "initializing"}
        />

        {/* Pulsante validate */}
        <ActionButton
          icon={<AlertTriangle size={16} />}
          label="Validate"
          onClick={handleValidate}
          disabled={isLoading || !status.isInitialized}
          color="amber"
          isLoading={deployStage === "validating"}
        />

        {/* Pulsante plan */}
        <ActionButton
          icon={planFile ? <CheckCircle size={16} /> : <Eye size={16} />}
          label="Plan"
          onClick={handlePlan}
          disabled={isLoading || !isCloudConnected}
          color={planFile ? "success" : "indigo"}
          isLoading={deployStage === "planning"}
        />

        {/* Pulsante apply */}
        <ActionButton
          icon={<Play size={16} />}
          label="Deploy"
          onClick={handleApply}
          disabled={isLoading || !isCloudConnected}
          color="green"
          isLoading={deployStage === "applying"}
        />

        {/* Pulsante destroy - SEMPRE VISIBILE */}
        <ActionButton
          icon={<Trash2 size={16} />}
          label="Destroy"
          onClick={handleDestroy}
          disabled={isLoading || !isCloudConnected || !status.isInitialized}
          color="red"
          isLoading={deployStage === "destroying"}
          tooltip={getDestroyTooltip()}
        />
      </div>
    );
  };

  // Tooltip per il pulsante destroy
  const getDestroyTooltip = () => {
    if (!isCloudConnected) return "Connect to Google Cloud first";
    if (!status.isInitialized) return "Initialize Terraform first";
    if (status.isDeployed) return "Destroy deployed infrastructure";
    return "Run terraform destroy command";
  };

  // Renderizza riepilogo del piano
  const renderPlanSummary = () => {
    if (!planSummary) return null;

    return (
      <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <h4 className="font-semibold text-indigo-800 mb-2">Plan Summary</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-green-600 font-semibold text-lg">
              {planSummary.add || 0}
            </div>
            <div className="text-gray-600">to add</div>
          </div>
          <div className="text-center">
            <div className="text-yellow-600 font-semibold text-lg">
              {planSummary.change || 0}
            </div>
            <div className="text-gray-600">to change</div>
          </div>
          <div className="text-center">
            <div className="text-red-600 font-semibold text-lg">
              {planSummary.destroy || 0}
            </div>
            <div className="text-gray-600">to destroy</div>
          </div>
        </div>
      </div>
    );
  };

  // Renderizza output deployati
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
            <div key={key} className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">{key}:</span>
              <span className="text-sm text-gray-600 break-all">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Renderizza console di output
  const renderOutputConsole = () => {
    if (!deployOutput) return null;

    return (
      <div className="mb-4">
        <button
          onClick={toggleOutputVisibility}
          className="flex items-center justify-between w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-t-md border border-gray-200"
        >
          <div className="flex items-center">
            <Terminal size={16} className="mr-2" />
            <span className="font-medium">Output Console</span>
          </div>
          {isOutputVisible ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </button>

        {isOutputVisible && (
          <div className="bg-black text-green-400 p-4 rounded-b-md border-l border-r border-b border-gray-200 max-h-64 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap">{deployOutput}</pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Terraform Deployment</h3>
        {renderStatusLabel()}
      </div>

      {renderCloudConnectionWarning()}

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-4">
          Deploy the infrastructure to Google Cloud Platform using the generated
          Terraform configuration.
        </p>

        {renderActionButtons()}
      </div>

      {renderPlanSummary()}
      {renderOutputs()}
      {renderOutputConsole()}
    </div>
  );
};

/**
 * Pulsante di azione per le operazioni Terraform
 */
const ActionButton = ({
  icon,
  label,
  onClick,
  disabled,
  color,
  isLoading,
  tooltip,
}) => {
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

  const button = (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${
        colorClasses[color] || colorClasses.blue
      } ${buttonClass} px-3 py-1.5 rounded-md flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`}
    >
      {isLoading ? (
        <Loader2 size={16} className="mr-1.5 animate-spin" />
      ) : (
        <span className="mr-1.5">{icon}</span>
      )}
      {label}
    </button>
  );

  // Se c'è un tooltip e il pulsante è disabilitato, mostralo
  if (tooltip && disabled && !isLoading) {
    return (
      <div className="relative group">
        {button}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          {tooltip}
        </div>
      </div>
    );
  }

  return button;
};

export default DeployControls;
