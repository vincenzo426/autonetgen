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

  const [deployStage, setDeployStage] = useState("idle"); // idle, initializing, planning, applying, destroying
  const [trafficTestStage, setTrafficTestStage] = useState("idle"); // idle, running
  const [deployOutput, setDeployOutput] = useState("");
  const [trafficTestOutput, setTrafficTestOutput] = useState("");
  const [isOutputVisible, setIsOutputVisible] = useState(false);
  const [isTrafficOutputVisible, setIsTrafficOutputVisible] = useState(false);
  const [planFile, setPlanFile] = useState(null);
  const [planSummary, setPlanSummary] = useState(null);

  // Resto del codice esistente per le funzioni terraform...
  // [Include qui tutte le funzioni esistenti: handleInit, handleValidate, handlePlan, handleApply, handleDestroy]

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

    // Richiedi conferma
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
      // Ottieni il session ID dal localStorage o da dove viene memorizzato
      const sessionId = localStorage.getItem("sessionId") || "default-session";

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

  // Funzioni di rendering esistenti...
  const renderActionButtons = () => {
    if (!isCloudConnected) {
      return (
        <div className="flex items-center space-x-2">
          <AlertTriangle size={20} className="text-amber-500" />
          <span className="text-amber-600">
            Please connect to Google Cloud to use Terraform deployment
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={<Play size={16} />}
          label="Initialize"
          onClick={handleInit}
          disabled={deployStage !== "idle"}
          isLoading={deployStage === "initializing"}
          color="blue"
        />

        <ActionButton
          icon={<Check size={16} />}
          label="Validate"
          onClick={handleValidate}
          disabled={!status.isInitialized || deployStage !== "idle"}
          isLoading={deployStage === "validating"}
          color="green"
        />

        <ActionButton
          icon={<Info size={16} />}
          label="Plan"
          onClick={handlePlan}
          disabled={!status.isValidated || deployStage !== "idle"}
          isLoading={deployStage === "planning"}
          color="indigo"
        />

        <ActionButton
          icon={<Play size={16} />}
          label="Apply"
          onClick={handleApply}
          disabled={!status.isValidated || deployStage !== "idle"}
          isLoading={deployStage === "applying"}
          color="success"
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
          icon={<Square size={16} />}
          label="Destroy"
          onClick={handleDestroy}
          disabled={!status.isDeployed || deployStage !== "idle"}
          isLoading={deployStage === "destroying"}
          color="red"
        />
      </div>
    );
  };

  // Console output per il test di traffico
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

  // Include qui tutte le altre funzioni di rendering esistenti...

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Terraform Deployment</h3>
        {/* Status label esistente */}
      </div>

      {/* Warning connessione cloud esistente */}

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-4">
          Deploy the infrastructure to Google Cloud Platform and run traffic
          tests on the deployed network.
        </p>

        {renderActionButtons()}
      </div>

      {/* Output console esistente */}
      {/* Outputs esistenti */}

      {/* NUOVO: Console output per il test di traffico */}
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
      {isLoading ? <Loader2 size={16} className="mr-1 animate-spin" /> : icon}
      <span className="ml-1">{label}</span>
    </button>
  );
};

export default DeployControls;
