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
  CloudOff
} from "lucide-react";
import apiService from "../../services/apiService";

/**
 * Componente per controllare il deploy dell'infrastruttura Terraform
 * 
 * @param {Object} props - Proprietà del componente
 * @param {string} props.terraformPath - Percorso della directory Terraform
 * @param {Function} props.onNotify - Handler per mostrare notifiche
 * @param {boolean} props.isCloudConnected - Se l'app è connessa al cloud
 */
const DeployControls = ({ terraformPath, onNotify, isCloudConnected }) => {
  const [status, setStatus] = useState({
    isInitialized: false,
    isDeployed: false,
    outputs: {}
  });
  
  const [deployStage, setDeployStage] = useState("idle"); // idle, validating, planning, applying, destroying
  const [deployOutput, setDeployOutput] = useState("");
  const [isOutputVisible, setIsOutputVisible] = useState(false);
  const [planSummary, setPlanSummary] = useState(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [planFile, setPlanFile] = useState(null);

  // Recupera lo stato all'avvio
  useEffect(() => {
    if (terraformPath) {
      fetchStatus();
    }
  }, [terraformPath]);

  // Recupera lo stato di Terraform
  const fetchStatus = async () => {
    setIsStatusLoading(true);
    
    try {
      const response = await apiService.getTerraformStatus(terraformPath);
      
      if (response.status === 'success') {
        setStatus({
          isInitialized: response.is_initialized,
          isDeployed: response.is_deployed,
          outputs: response.outputs
        });
      } else {
        onNotify("Failed to get Terraform status", "error");
      }
    } catch (error) {
      onNotify(`Error checking Terraform status: ${error.message}`, "error");
    } finally {
      setIsStatusLoading(false);
    }
  };

  // Inizializza Terraform
  const handleInit = async () => {
    if (!isCloudConnected) {
      onNotify("Please connect to Google Cloud first", "warning");
      return;
    }
    
    setDeployStage("initializing");
    setDeployOutput("Initializing Terraform...\n");
    setIsOutputVisible(true);
    
    try {
      const result = await apiService.initTerraform(terraformPath);
      
      if (result.status === 'success') {
        setDeployOutput(prev => prev + `${result.output}\nTerraform initialization successful.\n`);
        setStatus(prev => ({ ...prev, isInitialized: true }));
        onNotify("Terraform initialized successfully", "success");
      } else {
        setDeployOutput(prev => prev + `Error: ${result.error}\n`);
        onNotify("Terraform initialization failed", "error");
      }
    } catch (error) {
      setDeployOutput(prev => prev + `Error: ${error.message}\n`);
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
      const result = await apiService.validateTerraform(terraformPath);
      
      if (result.status === 'success') {
        setDeployOutput(prev => prev + `${result.output}\nTerraform configuration is valid.\n`);
        onNotify("Terraform configuration is valid", "success");
      } else {
        setDeployOutput(prev => prev + `Error: ${result.error}\n`);
        onNotify("Terraform configuration is invalid", "error");
      }
    } catch (error) {
      setDeployOutput(prev => prev + `Error: ${error.message}\n`);
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
    setDeployOutput(prev => prev + "Creating Terraform plan...\n");
    setIsOutputVisible(true);
    setPlanSummary(null);
    
    try {
      const result = await apiService.planTerraform(terraformPath);
      
      if (result.status === 'success') {
        setDeployOutput(prev => prev + `${result.output}\n`);
        
        if (result.has_changes) {
          setPlanSummary(result.plan_summary);
          setPlanFile(result.plan_file);
          setDeployOutput(prev => prev + `\nChanges detected in the plan:\n` +
            `  Add:     ${result.plan_summary.add}\n` +
            `  Change:  ${result.plan_summary.change}\n` +
            `  Destroy: ${result.plan_summary.destroy}\n`);
          onNotify(`Plan created with ${result.plan_summary.add + result.plan_summary.change + result.plan_summary.destroy} changes`, "info");
        } else {
          setDeployOutput(prev => prev + "\nNo changes detected in the plan.\n");
          onNotify("No infrastructure changes to apply", "info");
        }
      } else {
        setDeployOutput(prev => prev + `Error: ${result.error}\n`);
        onNotify("Failed to create Terraform plan", "error");
      }
    } catch (error) {
      setDeployOutput(prev => prev + `Error: ${error.message}\n`);
      onNotify(`Plan failed: ${error.message}`, "error");
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
    
    // Se non è stato creato un piano, mostra un messaggio di conferma
    if (!planFile) {
      if (!window.confirm("You haven't created a plan yet. Do you want to apply the configuration directly?")) {
        return;
      }
    }
    
    setDeployStage("applying");
    setDeployOutput(prev => prev + "Applying Terraform configuration...\n");
    setIsOutputVisible(true);
    
    try {
      const result = await apiService.applyTerraform(terraformPath, planFile, true);
      
      if (result.status === 'success') {
        setDeployOutput(prev => prev + `${result.output}\n\nTerraform infrastructure deployed successfully!\n`);
        setStatus(prev => ({ ...prev, isDeployed: true, outputs: result.terraform_outputs }));
        onNotify("Infrastructure deployed successfully", "success");
        
        // Reset del piano dopo l'applicazione
        setPlanFile(null);
        setPlanSummary(null);
      } else {
        setDeployOutput(prev => prev + `Error: ${result.error}\n`);
        onNotify("Failed to deploy infrastructure", "error");
      }
    } catch (error) {
      setDeployOutput(prev => prev + `Error: ${error.message}\n`);
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
    if (!window.confirm("Are you sure you want to destroy all the infrastructure? This action cannot be undone.")) {
      return;
    }
    
    setDeployStage("destroying");
    setDeployOutput(prev => prev + "Destroying Terraform infrastructure...\n");
    setIsOutputVisible(true);
    
    try {
      const result = await apiService.destroyTerraform(terraformPath, true);
      
      if (result.status === 'success') {
        setDeployOutput(prev => prev + `${result.output}\n\nTerraform infrastructure destroyed successfully.\n`);
        setStatus(prev => ({ ...prev, isDeployed: false, outputs: {} }));
        onNotify("Infrastructure destroyed successfully", "success");
        
        // Reset del piano dopo la distruzione
        setPlanFile(null);
        setPlanSummary(null);
      } else {
        setDeployOutput(prev => prev + `Error: ${result.error}\n`);
        onNotify("Failed to destroy infrastructure", "error");
      }
    } catch (error) {
      setDeployOutput(prev => prev + `Error: ${error.message}\n`);
      onNotify(`Destroy failed: ${error.message}`, "error");
    } finally {
      setDeployStage("idle");
    }
  };

  // Toggle visualizzazione output
  const toggleOutputVisibility = () => {
    setIsOutputVisible(!isOutputVisible);
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
        {/* Pulsante init */}
        <ActionButton
          icon={status.isInitialized ? <CheckCircle size={16} /> : <RotateCw size={16} />}
          label="Initialize"
          onClick={handleInit}
          disabled={isLoading || (!isCloudConnected)}
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
          icon={<Eye size={16} />}
          label="Plan"
          onClick={handlePlan}
          disabled={isLoading}
          color="indigo"
          isLoading={deployStage === "planning"}
        />
        
        {/* Pulsante apply */}
        <ActionButton
          icon={<Play size={16} />}
          label="Deploy"
          onClick={handleApply}
          disabled={isLoading || (!isCloudConnected)}
          color="green"
          isLoading={deployStage === "applying"}
        />
        
        {/* Pulsante destroy */}
        <ActionButton
          icon={<Trash2 size={16} />}
          label="Destroy"
          onClick={handleDestroy}
          disabled={isLoading || !status.isDeployed || (!isCloudConnected)}
          color="red"
          isLoading={deployStage === "destroying"}
        />
      </div>
    );
  };
  
  // Renderizza riepilogo del piano
  const renderPlanSummary = () => {
    if (!planSummary) return null;
    
    return (
      <div className="mt-4 bg-indigo-50 rounded-md p-4 border border-indigo-100">
        <h4 className="font-medium mb-2 text-indigo-800">Plan Summary</h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 bg-green-100 rounded text-center">
            <span className="block text-green-800 text-xs uppercase">Add</span>
            <span className="font-bold text-xl text-green-700">{planSummary.add}</span>
          </div>
          <div className="p-2 bg-amber-100 rounded text-center">
            <span className="block text-amber-800 text-xs uppercase">Change</span>
            <span className="font-bold text-xl text-amber-700">{planSummary.change}</span>
          </div>
          <div className="p-2 bg-red-100 rounded text-center">
            <span className="block text-red-800 text-xs uppercase">Destroy</span>
            <span className="font-bold text-xl text-red-700">{planSummary.destroy}</span>
          </div>
        </div>
      </div>
    );
  };
  
  // Renderizza gli output Terraform
  const renderOutputs = () => {
    if (!status.isDeployed || !status.outputs || Object.keys(status.outputs).length === 0) {
      return null;
    }
    
    return (
      <div className="mt-4 bg-gray-50 p-4 rounded-md border border-gray-200">
        <h4 className="font-medium mb-2 flex items-center">
          <Info size={16} className="mr-2 text-gray-500" />
          <span>Terraform Outputs</span>
        </h4>
        
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2">Output</th>
                <th className="text-left p-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(status.outputs).map(([key, output]) => (
                <tr key={key} className="border-t border-gray-200">
                  <td className="p-2 font-medium">{key}</td>
                  <td className="p-2 font-mono text-xs">
                    {typeof output.value === 'object' 
                      ? JSON.stringify(output.value, null, 2)
                      : String(output.value)
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  // Renderizza la console di output
  const renderOutputConsole = () => {
    if (!deployOutput) return null;
    
    return (
      <div className="mt-4 border border-gray-300 rounded-md overflow-hidden">
        <div className="flex items-center justify-between bg-gray-800 text-white px-3 py-2">
          <span className="text-sm font-mono flex items-center">
            <Terminal size={14} className="mr-2" />
            Terraform Output
          </span>
          <button 
            onClick={toggleOutputVisibility}
            className="text-gray-400 hover:text-white"
          >
            {isOutputVisible ? 'Hide' : 'Show'}
          </button>
        </div>
        
        {isOutputVisible && (
          <pre className="bg-black text-green-400 p-4 font-mono text-sm overflow-auto max-h-60 whitespace-pre-wrap">
            {deployOutput}
          </pre>
        )}
      </div>
    );
  };

  // Avviso GCP non connesso
  const renderCloudConnectionWarning = () => {
    if (isCloudConnected) return null;
    
    return (
      <div className="mb-4 bg-amber-50 p-3 rounded-md border border-amber-200 flex items-start">
        <CloudOff size={18} className="text-amber-500 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <p className="text-amber-800 text-sm">
            Not connected to Google Cloud. Connect to GCP to deploy infrastructure.
          </p>
        </div>
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
          Deploy the infrastructure to Google Cloud Platform using the generated Terraform configuration.
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
const ActionButton = ({ icon, label, onClick, disabled, color, isLoading }) => {
  // Mappatura dei colori alle classi Tailwind
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    green: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
    amber: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
    red: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    indigo: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
    success: "bg-green-100 text-green-800 hover:bg-green-200 focus:ring-green-300"
  };
  
  const buttonClass = color === "success" 
    ? "border border-green-500"
    : "text-white";
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${colorClasses[color] || colorClasses.blue} ${buttonClass} px-3 py-1.5 rounded-md flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
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