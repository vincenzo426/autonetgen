// src/components/terraform/TrafficTestControls.js
import { useState, useEffect } from "react";
import {
  Play,
  Square,
  Activity,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Clock,
  Zap,
  BarChart3,
  Settings,
} from "lucide-react";
import apiService from "../../services/apiService";

/**
 * Componente per controllare i test di traffico dell'infrastruttura deployata
 *
 * @param {Object} props - Proprietà del componente
 * @param {string} props.terraformPath - Percorso della directory Terraform
 * @param {Object} props.analysisResults - Risultati dell'analisi originale
 * @param {Function} props.onNotify - Handler per mostrare notifiche
 */
const TrafficTestControls = ({ terraformPath, analysisResults, onNotify }) => {
  const [infrastructureInfo, setInfrastructureInfo] = useState(null);
  const [isLoadingInfra, setIsLoadingInfra] = useState(false);
  const [activeTests, setActiveTests] = useState([]);
  const [testHistory, setTestHistory] = useState([]);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [selectedTestType, setSelectedTestType] = useState("generated");
  const [testConfig, setTestConfig] = useState({
    duration: 60,
    base_rps: 10,
    scenarios: ["normal", "peak"],
    include_stress_tests: true,
  });
  const [customPatterns, setCustomPatterns] = useState([]);
  const [testTemplates, setTestTemplates] = useState({});

  // Carica informazioni sull'infrastruttura all'avvio
  useEffect(() => {
    if (terraformPath) {
      loadInfrastructureInfo();
      loadTestTemplates();
    }
  }, [terraformPath]);

  // Aggiorna periodicamente lo stato dei test
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTests.length > 0) {
        refreshTestsStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTests]);

  /**
   * Carica le informazioni sull'infrastruttura deployata
   */
  const loadInfrastructureInfo = async () => {
    setIsLoadingInfra(true);

    try {
      const response = await apiService.getInfrastructureMapping(terraformPath);

      if (response.status === "success") {
        setInfrastructureInfo(response.data);
        onNotify("Infrastructure information loaded successfully", "success");
      } else {
        throw new Error(
          response.message || "Failed to load infrastructure info"
        );
      }
    } catch (error) {
      onNotify(`Error loading infrastructure: ${error.message}`, "error");
      console.error("Infrastructure loading error:", error);
    } finally {
      setIsLoadingInfra(false);
    }
  };

  /**
   * Carica i template di test predefiniti
   */
  const loadTestTemplates = async () => {
    try {
      const response = await apiService.getTestTemplates();

      if (response.status === "success") {
        setTestTemplates(response.data);
      }
    } catch (error) {
      console.error("Error loading test templates:", error);
    }
  };

  /**
   * Aggiorna lo stato di tutti i test
   */
  const refreshTestsStatus = async () => {
    setIsLoadingTests(true);

    try {
      const response = await apiService.getAllTestsStatus();

      if (response.status === "success") {
        const { tests } = response.data;
        const active = tests.filter((test) => test.is_active);
        const history = tests.filter((test) => !test.is_active);

        setActiveTests(active);
        setTestHistory(history.slice(0, 10)); // Mantieni solo i 10 più recenti
      }
    } catch (error) {
      console.error("Error refreshing tests status:", error);
    } finally {
      setIsLoadingTests(false);
    }
  };

  /**
   * Avvia un nuovo test di traffico
   */
  const startTrafficTest = async () => {
    if (!infrastructureInfo) {
      onNotify(
        "Infrastructure information not available. Please ensure Terraform is deployed.",
        "error"
      );
      return;
    }

    try {
      let testData = {
        test_type: selectedTestType,
        test_config: testConfig,
      };

      if (selectedTestType === "generated" && analysisResults) {
        testData.network_data = analysisResults;
        testData.infrastructure_mapping = infrastructureInfo.ip_mapping;
        testData.host_roles = analysisResults.roles || {};
      } else if (selectedTestType === "custom") {
        testData.patterns = customPatterns;
      } else if (selectedTestType === "load_test") {
        testData.infrastructure_mapping = infrastructureInfo.ip_mapping;
        testData.host_roles = analysisResults?.roles || {};
      }

      const response = await apiService.startTrafficTest(testData);

      if (response.status === "success") {
        onNotify(`Traffic test started: ${response.test_id}`, "success");
        refreshTestsStatus();
      } else {
        throw new Error(response.message || "Failed to start traffic test");
      }
    } catch (error) {
      onNotify(`Error starting traffic test: ${error.message}`, "error");
      console.error("Traffic test start error:", error);
    }
  };

  /**
   * Ferma un test di traffico attivo
   */
  const stopTrafficTest = async (testId) => {
    try {
      const response = await apiService.stopTrafficTest(testId);

      if (response.status === "success") {
        onNotify(`Traffic test ${testId} stopped`, "success");
        refreshTestsStatus();
      } else {
        throw new Error(response.message || "Failed to stop traffic test");
      }
    } catch (error) {
      onNotify(`Error stopping traffic test: ${error.message}`, "error");
      console.error("Traffic test stop error:", error);
    }
  };

  /**
   * Genera pattern di traffico automaticamente
   */
  const generateTrafficPatterns = async () => {
    if (!infrastructureInfo || !analysisResults) {
      onNotify("Infrastructure and analysis data required", "error");
      return;
    }

    try {
      const requestData = {
        network_data: analysisResults,
        host_roles: analysisResults.roles || {},
        infrastructure_mapping: infrastructureInfo.ip_mapping,
        test_config: testConfig,
      };

      const response = await apiService.generateTrafficPatterns(requestData);

      if (response.status === "success") {
        setCustomPatterns(response.patterns);
        setSelectedTestType("custom");
        onNotify(
          `Generated ${response.patterns.length} traffic patterns`,
          "success"
        );
      } else {
        throw new Error(response.message || "Failed to generate patterns");
      }
    } catch (error) {
      onNotify(`Error generating patterns: ${error.message}`, "error");
      console.error("Pattern generation error:", error);
    }
  };

  /**
   * Aggiunge un pattern personalizzato
   */
  const addCustomPattern = () => {
    const newPattern = {
      source_ip: "",
      destination_ip: "",
      destination_port: 80,
      traffic_type: "http",
      duration_seconds: 60,
      requests_per_second: 10,
      payload_size: 512,
      custom_headers: {},
      protocol_specific_config: {},
    };
    setCustomPatterns([...customPatterns, newPattern]);
  };

  /**
   * Rimuove un pattern personalizzato
   */
  const removeCustomPattern = (index) => {
    const updated = customPatterns.filter((_, i) => i !== index);
    setCustomPatterns(updated);
  };

  /**
   * Aggiorna un pattern personalizzato
   */
  const updateCustomPattern = (index, field, value) => {
    const updated = [...customPatterns];
    updated[index] = { ...updated[index], [field]: value };
    setCustomPatterns(updated);
  };

  /**
   * Applica un template di test
   */
  const applyTestTemplate = (templateKey) => {
    const template = testTemplates[templateKey];
    if (!template || !infrastructureInfo) return;

    const ipMappings = Object.entries(infrastructureInfo.ip_mapping);
    if (ipMappings.length < 2) {
      onNotify("At least 2 hosts required for test template", "error");
      return;
    }

    const [sourceIp] = ipMappings[0];
    const [, targetIp] = ipMappings[1];

    const pattern = {
      source_ip: sourceIp,
      destination_ip: targetIp,
      destination_port: 80,
      ...template.pattern_template,
    };

    setCustomPatterns([pattern]);
    setSelectedTestType("custom");
    onNotify(`Applied template: ${template.name}`, "success");
  };

  // Renderizza la sezione di controllo principale
  const renderMainControls = () => (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Traffic Testing Controls</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadInfrastructureInfo}
            disabled={isLoadingInfra}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
          >
            {isLoadingInfra ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <RefreshCw size={14} className="mr-1" />
            )}
            Refresh Infrastructure
          </button>
        </div>
      </div>

      {/* Stato infrastruttura */}
      <InfrastructureStatus
        info={infrastructureInfo}
        isLoading={isLoadingInfra}
      />

      {/* Controlli test */}
      <div className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <TestTypeSelector
            selectedType={selectedTestType}
            onTypeChange={setSelectedTestType}
            templatesAvailable={Object.keys(testTemplates).length > 0}
          />

          <button
            onClick={startTrafficTest}
            disabled={!infrastructureInfo || activeTests.length >= 5}
            className="bg-green-600 text-white py-2 px-4 rounded flex items-center justify-center hover:bg-green-700 disabled:bg-gray-400"
          >
            <Play size={16} className="mr-2" />
            Start Test
          </button>

          <button
            onClick={generateTrafficPatterns}
            disabled={!infrastructureInfo || !analysisResults}
            className="bg-purple-600 text-white py-2 px-4 rounded flex items-center justify-center hover:bg-purple-700 disabled:bg-gray-400"
          >
            <Zap size={16} className="mr-2" />
            Generate Patterns
          </button>
        </div>
      </div>
    </div>
  );

  // Renderizza la configurazione del test
  const renderTestConfiguration = () => (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h4 className="text-md font-semibold mb-4 flex items-center">
        <Settings size={18} className="mr-2" />
        Test Configuration
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Duration (seconds)
          </label>
          <input
            type="number"
            value={testConfig.duration}
            onChange={(e) =>
              setTestConfig({
                ...testConfig,
                duration: parseInt(e.target.value) || 60,
              })
            }
            className="w-full p-2 border rounded text-sm"
            min="10"
            max="3600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Base RPS</label>
          <input
            type="number"
            value={testConfig.base_rps}
            onChange={(e) =>
              setTestConfig({
                ...testConfig,
                base_rps: parseInt(e.target.value) || 10,
              })
            }
            className="w-full p-2 border rounded text-sm"
            min="1"
            max="1000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Test Scenarios
          </label>
          <select
            multiple
            value={testConfig.scenarios}
            onChange={(e) =>
              setTestConfig({
                ...testConfig,
                scenarios: Array.from(
                  e.target.selectedOptions,
                  (option) => option.value
                ),
              })
            }
            className="w-full p-2 border rounded text-sm"
          >
            <option value="normal">Normal Load</option>
            <option value="peak">Peak Load</option>
            <option value="stress">Stress Test</option>
            <option value="burst">Burst Test</option>
          </select>
        </div>

        <div className="flex items-center">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={testConfig.include_stress_tests}
              onChange={(e) =>
                setTestConfig({
                  ...testConfig,
                  include_stress_tests: e.target.checked,
                })
              }
              className="mr-2"
            />
            <span className="text-sm">Include Stress Tests</span>
          </label>
        </div>
      </div>

      {/* Template veloci */}
      {Object.keys(testTemplates).length > 0 && (
        <div>
          <h5 className="text-sm font-medium mb-2">Quick Templates</h5>
          <div className="flex flex-wrap gap-2">
            {Object.entries(testTemplates).map(([key, template]) => (
              <button
                key={key}
                onClick={() => applyTestTemplate(key)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizza i pattern personalizzati
  const renderCustomPatterns = () => {
    if (selectedTestType !== "custom") return null;

    return (
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-semibold">Custom Traffic Patterns</h4>
          <button
            onClick={addCustomPattern}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Add Pattern
          </button>
        </div>

        {customPatterns.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No custom patterns defined. Click "Add Pattern" to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {customPatterns.map((pattern, index) => (
              <CustomPatternEditor
                key={index}
                pattern={pattern}
                index={index}
                onUpdate={updateCustomPattern}
                onRemove={removeCustomPattern}
                availableIPs={
                  infrastructureInfo?.ip_mapping
                    ? Object.values(infrastructureInfo.ip_mapping)
                    : []
                }
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">
        Infrastructure Traffic Testing
      </h2>
      <p className="text-gray-600 mb-6">
        Test your deployed infrastructure by injecting realistic traffic
        patterns based on your network analysis.
      </p>

      {renderMainControls()}
      {renderTestConfiguration()}
      {renderCustomPatterns()}

      {/* Test attivi */}
      <ActiveTestsList
        tests={activeTests}
        onStopTest={stopTrafficTest}
        isLoading={isLoadingTests}
      />

      {/* Cronologia test */}
      <TestHistoryList tests={testHistory} onRefresh={refreshTestsStatus} />
    </div>
  );
};

/**
 * Componente per mostrare lo stato dell'infrastruttura
 */
const InfrastructureStatus = ({ info, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-gray-50 p-4 rounded border flex items-center">
        <Loader2 size={18} className="mr-2 animate-spin" />
        <span>Loading infrastructure information...</span>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="bg-red-50 p-4 rounded border border-red-200 flex items-center">
        <XCircle size={18} className="mr-2 text-red-600" />
        <span className="text-red-800">
          Infrastructure information not available
        </span>
      </div>
    );
  }

  const hostsCount = Object.keys(info.ip_mapping || {}).length;

  return (
    <div className="bg-green-50 p-4 rounded border border-green-200">
      <div className="flex items-center mb-2">
        <CheckCircle size={18} className="mr-2 text-green-600" />
        <span className="text-green-800 font-medium">Infrastructure Ready</span>
      </div>
      <div className="text-sm text-green-700 space-y-1">
        <p>Mapped Hosts: {hostsCount}</p>
        {info.frontend_url && <p>Frontend: Available</p>}
        {info.backend_url && <p>Backend: Available</p>}
        {info.database_connection && <p>Database: Available</p>}
      </div>
    </div>
  );
};

/**
 * Selettore tipo di test
 */
const TestTypeSelector = ({
  selectedType,
  onTypeChange,
  templatesAvailable,
}) => {
  const types = [
    {
      value: "generated",
      label: "Auto-Generated",
      description: "Based on network analysis",
    },
    {
      value: "custom",
      label: "Custom Patterns",
      description: "Manual configuration",
    },
    {
      value: "load_test",
      label: "Load Test",
      description: "Synthetic load scenarios",
    },
  ];

  return (
    <div>
      <label className="block text-sm font-medium mb-2">Test Type</label>
      <select
        value={selectedType}
        onChange={(e) => onTypeChange(e.target.value)}
        className="w-full p-2 border rounded"
      >
        {types.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">
        {types.find((t) => t.value === selectedType)?.description}
      </p>
    </div>
  );
};

/**
 * Editor per pattern personalizzati
 */
const CustomPatternEditor = ({
  pattern,
  index,
  onUpdate,
  onRemove,
  availableIPs,
}) => {
  const trafficTypes = ["http", "https", "tcp", "udp", "modbus", "mqtt", "dns"];

  return (
    <div className="border rounded p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <h5 className="font-medium">Pattern {index + 1}</h5>
        <button
          onClick={() => onRemove(index)}
          className="text-red-600 hover:text-red-800"
        >
          <XCircle size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Source IP</label>
          <select
            value={pattern.source_ip}
            onChange={(e) => onUpdate(index, "source_ip", e.target.value)}
            className="w-full p-1 border rounded text-sm"
          >
            <option value="">Select IP</option>
            {availableIPs.map((ip) => (
              <option key={ip} value={ip}>
                {ip}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">
            Destination IP
          </label>
          <select
            value={pattern.destination_ip}
            onChange={(e) => onUpdate(index, "destination_ip", e.target.value)}
            className="w-full p-1 border rounded text-sm"
          >
            <option value="">Select IP</option>
            {availableIPs.map((ip) => (
              <option key={ip} value={ip}>
                {ip}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Port</label>
          <input
            type="number"
            value={pattern.destination_port}
            onChange={(e) =>
              onUpdate(
                index,
                "destination_port",
                parseInt(e.target.value) || 80
              )
            }
            className="w-full p-1 border rounded text-sm"
            min="1"
            max="65535"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Protocol</label>
          <select
            value={pattern.traffic_type}
            onChange={(e) => onUpdate(index, "traffic_type", e.target.value)}
            className="w-full p-1 border rounded text-sm"
          >
            {trafficTypes.map((type) => (
              <option key={type} value={type}>
                {type.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Duration (s)</label>
          <input
            type="number"
            value={pattern.duration_seconds}
            onChange={(e) =>
              onUpdate(
                index,
                "duration_seconds",
                parseInt(e.target.value) || 60
              )
            }
            className="w-full p-1 border rounded text-sm"
            min="1"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">RPS</label>
          <input
            type="number"
            value={pattern.requests_per_second}
            onChange={(e) =>
              onUpdate(
                index,
                "requests_per_second",
                parseInt(e.target.value) || 10
              )
            }
            className="w-full p-1 border rounded text-sm"
            min="1"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Payload Size</label>
          <input
            type="number"
            value={pattern.payload_size}
            onChange={(e) =>
              onUpdate(index, "payload_size", parseInt(e.target.value) || 512)
            }
            className="w-full p-1 border rounded text-sm"
            min="1"
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Lista dei test attivi
 */
const ActiveTestsList = ({ tests, onStopTest, isLoading }) => {
  if (tests.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h4 className="text-md font-semibold mb-4 flex items-center">
          <Activity size={18} className="mr-2" />
          Active Tests
        </h4>
        <p className="text-gray-500 text-center py-4">
          No active tests running
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-md font-semibold flex items-center">
          <Activity size={18} className="mr-2" />
          Active Tests ({tests.length})
        </h4>
        {isLoading && <Loader2 size={16} className="animate-spin" />}
      </div>

      <div className="space-y-3">
        {tests.map((test) => (
          <ActiveTestItem key={test.test_id} test={test} onStop={onStopTest} />
        ))}
      </div>
    </div>
  );
};

/**
 * Elemento test attivo
 */
const ActiveTestItem = ({ test, onStop }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case "running":
        return <Activity size={16} className="text-green-600 animate-pulse" />;
      case "pending":
        return <Clock size={16} className="text-yellow-600" />;
      default:
        return <AlertTriangle size={16} className="text-red-600" />;
    }
  };

  const result = test.result || {};

  return (
    <div className="border rounded p-4 bg-gray-50">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center mb-2">
            {getStatusIcon(test.status)}
            <span className="ml-2 font-medium">
              {test.test_id.substring(0, 8)}
            </span>
            <span className="ml-2 text-sm text-gray-600 capitalize">
              {test.status}
            </span>
          </div>

          {result.total_requests !== undefined && (
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                Requests: {result.successful_requests || 0}/
                {result.total_requests || 0}
              </p>
              <p>
                Avg Response: {(result.average_response_time || 0).toFixed(2)}ms
              </p>
              <p>Throughput: {(result.throughput_mbps || 0).toFixed(2)} Mbps</p>
            </div>
          )}
        </div>

        <button
          onClick={() => onStop(test.test_id)}
          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center"
        >
          <Square size={14} className="mr-1" />
          Stop
        </button>
      </div>
    </div>
  );
};

/**
 * Lista cronologia test
 */
const TestHistoryList = ({ tests, onRefresh }) => {
  if (tests.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h4 className="text-md font-semibold mb-4 flex items-center">
          <BarChart3 size={18} className="mr-2" />
          Test History
        </h4>
        <p className="text-gray-500 text-center py-4">No completed tests</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-md font-semibold flex items-center">
          <BarChart3 size={18} className="mr-2" />
          Test History
        </h4>
        <button
          onClick={onRefresh}
          className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
        >
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Test ID</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Success Rate</th>
              <th className="text-left p-2">Avg Response</th>
              <th className="text-left p-2">Throughput</th>
              <th className="text-left p-2">Duration</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => (
              <TestHistoryRow key={test.test_id} test={test} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Riga cronologia test
 */
const TestHistoryRow = ({ test }) => {
  const result = test.result || {};
  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      case "cancelled":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  const successRate =
    result.total_requests > 0
      ? ((result.successful_requests / result.total_requests) * 100).toFixed(1)
      : "0";

  const duration =
    result.start_time && result.end_time
      ? Math.round(
          (new Date(result.end_time) - new Date(result.start_time)) / 1000
        )
      : "N/A";

  return (
    <tr className="border-t border-gray-200">
      <td className="p-2 font-mono text-xs">{test.test_id.substring(0, 8)}</td>
      <td className={`p-2 capitalize ${getStatusColor(test.status)}`}>
        {test.status}
      </td>
      <td className="p-2">{successRate}%</td>
      <td className="p-2">
        {(result.average_response_time || 0).toFixed(2)}ms
      </td>
      <td className="p-2">{(result.throughput_mbps || 0).toFixed(2)} Mbps</td>
      <td className="p-2">{duration}s</td>
    </tr>
  );
};

export default TrafficTestControls;
