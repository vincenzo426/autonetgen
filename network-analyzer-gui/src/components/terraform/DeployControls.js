import React, { useState, useEffect } from "react";
import {
  Play,
  Square,
  AlertTriangle,
  Check,
  Loader2,
  UploadCloud,
  Info,
  Zap,
  CheckCircle,
  RotateCw,
  Eye,
  Trash2,
  RefreshCw,
  Database,
  Cloud,
} from "lucide-react";
import apiService from "../../services/apiService";

const DeployControls = ({
  terraformPath,
  onNotify,
  isCloudConnected,
  onToggleCloud,
}) => {
  const [status, setStatus] = useState({
    isInitialized: false,
    isValidated: false,
    isDeployed: false,
    outputs: {},
  });

  const [deployStage, setDeployStage] = useState("idle");
  const [trafficTestStage, setTrafficTestStage] = useState("idle");
  const [deployOutput, setDeployOutput] = useState("");
  const [trafficTestOutput, setTrafficTestOutput] = useState("");
  const [isOutputVisible, setIsOutputVisible] = useState(false);
  const [isTrafficOutputVisible, setIsTrafficOutputVisible] = useState(false);
  const [planFile, setPlanFile] = useState(null);
  const [planSummary, setPlanSummary] = useState(null);
  const [cloudLoadingStates, setCloudLoadingStates] = useState({
    refresh: false,
    cloud: false,
  });
  const [filesAvailable, setFilesAvailable] = useState(true);

  // Ottieni sessionId dal localStorage o usa un default
  const sessionId = localStorage.getItem("sessionId") || "default-session";

  // Funzioni esistenti
  const handleRefreshStatus = async () => {
    setCloudLoadingStates((prev) => ({ ...prev, refresh: true }));
    try {
      // Logica per refresh status
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulazione
      onNotify("Status refreshed", "success");
    } catch (error) {
      onNotify(`Refresh failed: ${error.message}`, "error");
    } finally {
      setCloudLoadingStates((prev) => ({ ...prev, refresh: false }));
    }
  };

  const handleInit = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    setDeployStage("downloading");
    setDeployOutput("Initializing Terraform...\n");
    setIsOutputVisible(true);

    try {
      const result = await apiService.initTerraform(sessionId);

      if (result.status === "success") {
        setDeployOutput(
          (prev) =>
            prev + `${result.output}\nTerraform initialization successful.\n`
        );
        setStatus((prev) => ({ ...prev, isInitialized: true }));
        onNotify("Terraform initialized successfully", "success");
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

  const handleValidate = async () => {
    if (!status.isInitialized) {
      onNotify("Please initialize Terraform first", "warning");
      return;
    }

    setDeployStage("validating");
    setDeployOutput((prev) => prev + "Validating Terraform configuration...\n");
    setIsOutputVisible(true);

    try {
      const result = await apiService.validateTerraform(sessionId);

      if (result.status === "success") {
        setDeployOutput(
          (prev) =>
            prev + `${result.output}\nTerraform configuration is valid.\n`
        );
        setStatus((prev) => ({ ...prev, isValidated: true }));
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

  const handlePlan = async () => {
    if (!status.isInitialized) {
      await handleInit();
      if (deployStage === "idle" && !status.isInitialized) {
        return;
      }
    }

    setDeployStage("planning");
    setDeployOutput((prev) => prev + "Creating Terraform plan...\n");
    setIsOutputVisible(true);
    setPlanSummary(null);

    try {
      const result = await apiService.planTerraform(sessionId);

      if (result.status === "success") {
        setDeployOutput((prev) => prev + `${result.output}\n`);

        if (result.has_changes) {
          setPlanSummary(result.plan_summary);
          setPlanFile(result.plan_file);
          setDeployOutput(
            (prev) =>
              prev +
              `\nChanges detected in the plan:\n` +
              `  Add:     ${result.plan_summary.add}\n` +
              `  Change:  ${result.plan_summary.change}\n` +
              `  Destroy: ${result.plan_summary.destroy}\n`
          );
          onNotify(
            `Plan created with ${
              result.plan_summary.add +
              result.plan_summary.change +
              result.plan_summary.destroy
            } changes`,
            "info"
          );
        } else {
          setDeployOutput(
            (prev) => prev + "\nNo changes detected in the plan.\n"
          );
          onNotify("No infrastructure changes to apply", "info");
        }
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

  const handleApply = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    if (!status.isInitialized) {
      onNotify("Please initialize Terraform first", "warning");
      return;
    }

    if (!planFile) {
      if (
        !window.confirm(
          "You haven't created a plan yet. Do you want to apply the configuration directly?"
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

  const handleDestroy = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    if (!status.isInitialized) {
      onNotify("Infrastructure not initialized", "warning");
      return;
    }

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
      const result = await apiService.destroyTerraform(sessionId, null, true);

      if (result.status === "success") {
        setDeployOutput(
          (prev) =>
            prev +
            `${result.output}\n\nTerraform infrastructure destroyed successfully.\n`
        );
        setStatus((prev) => ({ ...prev, isDeployed: false, outputs: {} }));
        onNotify("Infrastructure destroyed successfully", "success");

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

  // NUOVA FUNZIONE per il test di traffico
  const handleTrafficTest = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }

    if (!status.isDeployed) {
      onNotify(
        "Infrastructure must be deployed before running traffic tests",
        "warning"
      );
      return;
    }

    if (
      !window.confirm(
        "Do you want to start the traffic test? This will execute traffic.sh on the custom-vm."
      )
    ) {
      return;
    }

    setTrafficTestStage("running");
    setTrafficTestOutput("Starting traffic test...\n");
    setIsTrafficOutputVisible(true);

    try {
      const result = await apiService.runTrafficTest(sessionId);

      if (result.status === "success") {
        setTrafficTestOutput(
          (prev) =>
            prev + `${result.output}\n\nTraffic test completed successfully!\n`
        );
        onNotify("Traffic test completed successfully", "success");
      } else {
        setTrafficTestOutput((prev) => prev + `Error: ${result.error}\n`);
        onNotify("Traffic test failed", "error");
      }
    } catch (error) {
      setTrafficTestOutput((prev) => prev + `Error: ${error.message}\n`);
      onNotify(`Traffic test failed: ${error.message}`, "error");
    } finally {
      setTrafficTestStage("idle");
    }
  };

  // Funzioni di rendering
  const renderStatusLabel = () => {
    if (!isCloudConnected) {
      return (
        <div className="flex items-center text-red-600">
          <AlertTriangle size={16} className="mr-2" />
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

  const renderActionButtons = () => {
    const isLoading = deployStage !== "idle";

    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={<RefreshCw size={16} />}
          label="Refresh"
          onClick={handleRefreshStatus}
          disabled={cloudLoadingStates.refresh}
          isLoading={cloudLoadingStates.refresh}
          color="indigo"
        />

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

        <ActionButton
          icon={<CheckCircle size={16} />}
          label="Validate"
          onClick={handleValidate}
          disabled={isLoading || !status.isInitialized}
          color="indigo"
          isLoading={deployStage === "validating"}
        />

        <ActionButton
          icon={planFile ? <CheckCircle size={16} /> : <Eye size={16} />}
          label="Plan"
          onClick={handlePlan}
          disabled={isLoading || !isCloudConnected}
          color={planFile ? "success" : "indigo"}
          isLoading={deployStage === "planning"}
        />

        <ActionButton
          icon={<Play size={16} />}
          label="Deploy"
          onClick={handleApply}
          disabled={isLoading || !isCloudConnected}
          color="green"
          isLoading={deployStage === "applying"}
        />

        {/* NUOVO PULSANTE per il test di traffico */}
        <ActionButton
          icon={<Zap size={16} />}
          label="Traffic Test"
          onClick={handleTrafficTest}
          disabled={
            !status.isDeployed ||
            deployStage !== "idle" ||
            trafficTestStage !== "idle"
          }
          isLoading={trafficTestStage === "running"}
          color="amber"
        />

        <ActionButton
          icon={<Trash2 size={16} />}
          label="Destroy"
          onClick={handleDestroy}
          disabled={isLoading || !status.isDeployed || !isCloudConnected}
          color="red"
          isLoading={deployStage === "destroying"}
        />
      </div>
    );
  };

  const renderPlanSummary = () => {
    if (!planSummary) return null;

    return (
      <div className="mt-4 bg-indigo-50 rounded-md p-4 border border-indigo-100">
        <h4 className="font-medium mb-2 text-indigo-800">Plan Summary</h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 bg-green-100 rounded text-center">
            <span className="block text-green-800 text-xs uppercase">Add</span>
            <span className="font-bold text-xl text-green-700">
              {planSummary.add}
            </span>
          </div>
          <div className="p-2 bg-amber-100 rounded text-center">
            <span className="block text-amber-800 text-xs uppercase">
              Change
            </span>
            <span className="font-bold text-xl text-amber-700">
              {planSummary.change}
            </span>
          </div>
          <div className="p-2 bg-red-100 rounded text-center">
            <span className="block text-red-800 text-xs uppercase">
              Destroy
            </span>
            <span className="font-bold text-xl text-red-700">
              {planSummary.destroy}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderOutputs = () => {
    if (!status.outputs || Object.keys(status.outputs).length === 0)
      return null;

    return (
      <div className="mt-4 bg-green-50 rounded-md p-4 border border-green-100">
        <h4 className="font-medium mb-2 text-green-800">Terraform Outputs</h4>
        <div className="space-y-1">
          {Object.entries(status.outputs).map(([key, output]) => (
            <div key={key} className="text-sm">
              <span className="font-medium text-green-700">{key}:</span>{" "}
              <span className="text-green-600">{output.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOutputConsole = () => {
    if (!isOutputVisible) return null;

    return (
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-semibold">Terraform Output</h4>
          <button
            onClick={() => setIsOutputVisible(false)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Hide Output
          </button>
        </div>
        <div className="bg-gray-900 text-green-400 p-3 rounded-md font-mono text-xs max-h-64 overflow-y-auto">
          <pre className="whitespace-pre-wrap">{deployOutput}</pre>
          {deployStage !== "idle" && (
            <div className="flex items-center mt-2">
              <Loader2 size={14} className="mr-2 animate-spin" />
              <span>Running {deployStage}...</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTrafficTestOutput = () => {
    if (!isTrafficOutputVisible) return null;

    return (
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-semibold">Traffic Test Output</h4>
          <button
            onClick={() => setIsTrafficOutputVisible(false)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Hide Output
          </button>
        </div>
        <div className="bg-gray-900 text-green-400 p-3 rounded-md font-mono text-xs max-h-64 overflow-y-auto">
          <pre className="whitespace-pre-wrap">{trafficTestOutput}</pre>
          {trafficTestStage === "running" && (
            <div className="flex items-center mt-2">
              <Loader2 size={14} className="mr-2 animate-spin" />
              <span>Running traffic test...</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCloudConnectionWarning = () => {
    if (isCloudConnected) return null;

    return (
      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center">
          <AlertTriangle size={20} className="text-amber-600 mr-3" />
          <div className="flex-1">
            <h4 className="text-amber-800 font-medium">
              Cloud Connection Required
            </h4>
            <p className="text-amber-700 text-sm mt-1">
              Connect to Google Cloud to deploy and manage your Terraform
              infrastructure.
            </p>
          </div>
          <button
            onClick={onToggleCloud}
            className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <Cloud size={16} className="mr-2 inline" />
            Connect
          </button>
        </div>
      </div>
    );
  };

  if (!terraformPath) {
    return (
      <div className="flex flex-col items-center justify-center bg-white p-8 rounded-lg shadow-md min-h-[400px]">
        <div className="text-center text-gray-500">
          <p className="mb-4">No Terraform configuration available yet.</p>
          <p>Please run an analysis first to generate Terraform files.</p>
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

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-4">
          Deploy the infrastructure to Google Cloud Platform and run traffic
          tests on the deployed network.
        </p>

        {renderActionButtons()}
      </div>

      {renderPlanSummary()}
      {renderOutputs()}
      {renderOutputConsole()}
      {renderTrafficTestOutput()}
    </div>
  );
};

const ActionButton = ({ icon, label, onClick, disabled, color, isLoading }) => {
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
      {isLoading ? (
        <Loader2 size={16} className="mr-1.5 animate-spin" />
      ) : (
        <span className="mr-1.5">{icon}</span>
      )}
      {label}
    </button>
  );
};

export default DeployControls;
