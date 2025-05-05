// src/components/NetworkAnalyzerDashboard.js
import { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  FileText, 
  Network, 
  Server, 
  Download, 
  Settings, 
  Play, 
  AlertCircle,
  Activity,
  Database,
  CloudOff,
  Cloud,
  Trash2,
  X,
  CheckCircle,
  Info
} from "lucide-react";

// API URL per il backend
const API_URL = "http://localhost:5000/api";

// Main App Component
export default function NetworkAnalyzerDashboard() {
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [selectedParser, setSelectedParser] = useState("auto");
  const [outputFormats, setOutputFormats] = useState({
    graphviz: true,
    terraform: true,
    json: true
  });
  const [outputPaths, setOutputPaths] = useState({
    output_dir: "output",
    output_graph: "output/network_graph.pdf",
    output_analysis: "output/network_analysis.json",
    output_terraform: "output/terraform"
  });
  const [isConnectedToCloud, setIsConnectedToCloud] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [downloadLinks, setDownloadLinks] = useState({});
  const [error, setError] = useState(null);
  
  const fileInputRef = useRef(null);

  // Handle file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Save files to state
    setUploadedFiles([...uploadedFiles, ...files]);
    
    // Add notification
    addNotification("Files uploaded successfully", "success");
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove file from uploaded files list
  const removeFile = (index) => {
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
    addNotification("File removed", "info");
  };

  // Start analysis process
  const startAnalysis = async () => {
    if (uploadedFiles.length === 0) {
      addNotification("Please upload at least one file to analyze", "error");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Create a FormData object to send files
      const formData = new FormData();
      
      // Append each file to the FormData
      uploadedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });
      
      // Add additional parameters
      formData.append('type', selectedParser);
      formData.append('output_dir', outputPaths.output_dir);
      formData.append('output_graph', outputPaths.output_graph);
      formData.append('output_analysis', outputPaths.output_analysis);
      formData.append('output_terraform', outputPaths.output_terraform);
      
      // In un'implementazione reale, dovresti inviare i file al server
      // Per questa simulazione, aspettiamo un po' e poi simuliamo un risultato
      
      // Simula API call - in una implementazione reale, questa sarebbe una fetch all'API
      setTimeout(() => {
        const mockResults = {
          status: 'success',
          hosts: uploadedFiles.length * 5 + Math.floor(Math.random() * 10),
          connections: uploadedFiles.length * 12 + Math.floor(Math.random() * 20),
          protocols: ['TCP', 'UDP', 'HTTP', 'MODBUS', 'S7COMM'],
          anomalies: Math.floor(Math.random() * 5),
          subnets: ['192.168.1.0/24', '10.0.0.0/24'],
          roles: {
            'CLIENT': Math.floor(Math.random() * 10) + 5,
            'SERVER': Math.floor(Math.random() * 5) + 2,
            'PLC_MODBUS': Math.floor(Math.random() * 3) + 1,
            'GATEWAY': Math.floor(Math.random() * 2) + 1
          },
          output_paths: {
            graph: outputPaths.output_graph,
            analysis: outputPaths.output_analysis,
            terraform: outputPaths.output_terraform
          }
        };
        
        setAnalysisResults(mockResults);
        setIsAnalyzing(false);
        addNotification("Analysis completed successfully", "success");
        
        // Imposta link di download simulati
        setDownloadLinks({
          graph: '/download/graph.pdf',
          analysis: '/download/analysis.json',
          terraform: '/download/terraform.zip'
        });
        
        // Passa automaticamente alla scheda dei risultati
        setActiveTab("results");
      }, 3000); // Simula 3 secondi di elaborazione
      
      /* 
       * Implementazione reale dell'API call:
       * 
       * const response = await fetch(`${API_URL}/analyze`, {
       *   method: 'POST',
       *   body: formData
       * });
       * 
       * if (!response.ok) {
       *   const errorData = await response.json();
       *   throw new Error(errorData.message || 'Analysis failed');
       * }
       * 
       * const data = await response.json();
       * setAnalysisResults(data);
       * setIsAnalyzing(false);
       * setActiveTab("results");
       * addNotification("Analysis completed successfully", "success");
       */
      
    } catch (err) {
      setIsAnalyzing(false);
      setError(err.message || 'An unexpected error occurred');
      addNotification(err.message || 'Analysis failed', "error");
    }
  };

  // Function to add notifications
  const addNotification = (message, type) => {
    const id = Date.now();
    setNotifications([...notifications, { id, message, type }]);
    
    // Auto remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(current => current.filter(n => n.id !== id));
    }, 5000);
  };

  // Function to remove notification
  const removeNotification = (id) => {
    setNotifications(current => current.filter(n => n.id !== id));
  };

  // Function to toggle cloud connection
  const toggleCloudConnection = () => {
    setIsConnectedToCloud(!isConnectedToCloud);
    addNotification(
      isConnectedToCloud ? "Disconnected from Google Cloud" : "Connected to Google Cloud", 
      "info"
    );
  };

  // Function to handle exports
  const handleExport = (type) => {
    // In a real implementation, this would trigger a download from the backend
    addNotification(`${type} export started`, "info");
    
    // Simulate download after a delay
    setTimeout(() => {
      addNotification(`${type} exported successfully`, "success");
    }, 1500);
  };

  // Determine if a tab should be disabled
  const isTabDisabled = (tabName) => {
    if (tabName === "upload") return false;
    if (tabName === "analyze") return uploadedFiles.length === 0;
    if (tabName === "results" || tabName === "export") return !analysisResults;
    return false;
  };

  // Render the upload tab content
  const renderUploadTab = () => (
    <div>
      <h2 className="text-2xl font-bold mb-6">Upload Network Data</h2>
      <div className="bg-white p-8 rounded-lg shadow-md mb-6">
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const droppedFiles = Array.from(e.dataTransfer.files);
            setUploadedFiles([...uploadedFiles, ...droppedFiles]);
            addNotification("Files uploaded successfully", "success");
          }}
        >
          <Upload size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="mb-4 text-gray-600">Drag and drop your files here, or</p>
          <label className="bg-blue-600 text-white py-2 px-6 rounded cursor-pointer hover:bg-blue-700 inline-block">
            Browse Files
            <input 
              type="file" 
              className="hidden" 
              onChange={handleFileUpload} 
              multiple
              ref={fileInputRef}
            />
          </label>
          <p className="mt-4 text-sm text-gray-500">Supported formats: PCAP, CSV, NetFlow</p>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Uploaded Files</h3>
          <ul className="divide-y divide-gray-200">
            {uploadedFiles.map((file, index) => (
              <li key={index} className="py-3 flex justify-between items-center">
                <div className="flex items-center">
                  <FileText size={20} className="text-gray-500 mr-3" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button 
                  className="text-red-500 hover:text-red-700"
                  onClick={() => removeFile(index)}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <button 
              className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700"
              onClick={() => setActiveTab("analyze")}
            >
              <Play size={18} className="mr-2" />
              Continue to Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Render the analysis configuration tab
  const renderAnalyzeTab = () => (
    <div>
      <h2 className="text-2xl font-bold mb-6">Configure Analysis</h2>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="text-lg font-semibold mb-4">Parser Selection</h3>
        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium">Select Parser Type</label>
          <select 
            className="w-full p-2 border border-gray-300 rounded"
            value={selectedParser}
            onChange={(e) => setSelectedParser(e.target.value)}
          >
            <option value="auto">Auto-detect (recommended)</option>
            <option value="pcap">PCAP Parser</option>
            <option value="csv">CSV Parser</option>
            <option value="netflow">NetFlow Parser</option>
          </select>
          <p className="mt-2 text-sm text-gray-500">Auto-detect will determine the parser based on file extension</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="text-lg font-semibold mb-4">Output Generation</h3>
        <div className="mb-4">
          <label className="flex items-center mb-3">
            <input 
              type="checkbox" 
              checked={outputFormats.graphviz}
              onChange={() => setOutputFormats({...outputFormats, graphviz: !outputFormats.graphviz})}
              className="mr-2"
            />
            <span>Graphviz Network Visualization</span>
          </label>
          <label className="flex items-center mb-3">
            <input 
              type="checkbox" 
              checked={outputFormats.terraform}
              onChange={() => setOutputFormats({...outputFormats, terraform: !outputFormats.terraform})}
              className="mr-2"
            />
            <span>Terraform Configuration</span>
          </label>
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={outputFormats.json}
              onChange={() => setOutputFormats({...outputFormats, json: !outputFormats.json})}
              className="mr-2"
            />
            <span>JSON Export</span>
          </label>
        </div>
        
        <h3 className="text-lg font-semibold mb-4 mt-8">Output Paths</h3>
        <div className="space-y-3">
          <div>
            <label className="block mb-1 text-sm font-medium">Output Directory</label>
            <input 
              type="text" 
              value={outputPaths.output_dir}
              onChange={(e) => setOutputPaths({...outputPaths, output_dir: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          {outputFormats.graphviz && (
            <div>
              <label className="block mb-1 text-sm font-medium">Graph Output Path</label>
              <input 
                type="text" 
                value={outputPaths.output_graph}
                onChange={(e) => setOutputPaths({...outputPaths, output_graph: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
          )}
          {outputFormats.json && (
            <div>
              <label className="block mb-1 text-sm font-medium">JSON Analysis Path</label>
              <input 
                type="text" 
                value={outputPaths.output_analysis}
                onChange={(e) => setOutputPaths({...outputPaths, output_analysis: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
          )}
          {outputFormats.terraform && (
            <div>
              <label className="block mb-1 text-sm font-medium">Terraform Files Path</label>
              <input 
                type="text" 
                value={outputPaths.output_terraform}
                onChange={(e) => setOutputPaths({...outputPaths, output_terraform: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700 disabled:bg-gray-400"
          onClick={startAnalysis}
          disabled={isAnalyzing || uploadedFiles.length === 0}
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              Analyzing...
            </>
          ) : (
            <>
              <Play size={20} className="mr-2" />
              Start Analysis
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Render the results tab
  const renderResultsTab = () => (
    <div>
      <h2 className="text-2xl font-bold mb-6">Analysis Results</h2>
      
      {analysisResults && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-gray-500">Hosts</h3>
                <Server size={24} className="text-blue-600" />
              </div>
              <p className="text-3xl font-bold">{analysisResults.hosts}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-gray-500">Connections</h3>
                <Network size={24} className="text-green-600" />
              </div>
              <p className="text-3xl font-bold">{analysisResults.connections}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-gray-500">Anomalies</h3>
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <p className="text-3xl font-bold">{analysisResults.anomalies}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Network Map Visualization */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Network Map</h3>
              <div className="bg-gray-100 h-64 rounded flex items-center justify-center">
                <div className="text-center">
                  <Network size={48} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-500">Network visualization preview</p>
                  <button 
                    className="mt-4 bg-blue-600 text-white py-1 px-4 rounded text-sm hover:bg-blue-700"
                    onClick={() => handleExport('graph')}
                  >
                    View Full Graph
                  </button>
                </div>
              </div>
            </div>
            
            {/* Protocol Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Protocol Distribution</h3>
              <div className="bg-gray-100 h-64 rounded flex items-center justify-center p-4">
                <div className="w-full px-4">
                  {analysisResults.protocols.map((protocol, idx) => {
                    const percentage = Math.floor(Math.random() * 100);
                    return (
                      <div key={idx} className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span>{protocol}</span>
                          <span>{percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          
          {/* Host Roles */}
          <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Host Roles Distribution</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="text-left py-2">Role</th>
                      <th className="text-left py-2">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analysisResults.roles).map(([role, count], idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-gray-50" : ""}>
                        <td className="py-2">{role}</td>
                        <td className="py-2">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border-8 border-gray-200 relative">
                  {Object.entries(analysisResults.roles).map(([role, count], idx) => {
                    const total = Object.values(analysisResults.roles).reduce((a, b) => a + b, 0);
                    const percentage = (count / total) * 100;
                    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
                    return (
                      <div
                        key={idx}
                        className="absolute inset-0"
                        style={{
                          clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((idx + percentage/100) * 2 * Math.PI)}% ${50 - 50 * Math.sin((idx + percentage/100) * 2 * Math.PI)}%)`,
                          backgroundColor: colors[idx % colors.length],
                        }}
                      ></div>
                    );
                  })}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold">{analysisResults.hosts}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Subnet Information */}
          <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Subnet Information</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left py-2 px-4">Subnet</th>
                    <th className="text-left py-2 px-4">Hosts</th>
                    <th className="text-left py-2 px-4">Main Role</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisResults.subnets.map((subnet, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="py-2 px-4">{subnet}</td>
                      <td className="py-2 px-4">{Math.floor(Math.random() * 10) + 1}</td>
                      <td className="py-2 px-4">
                        {Object.keys(analysisResults.roles)[Math.floor(Math.random() * Object.keys(analysisResults.roles).length)]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button 
              className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700"
              onClick={() => setActiveTab("export")}
            >
              <Download size={20} className="mr-2" />
              Export Results
            </button>
          </div>
        </>
      )}
    </div>
  );

  // Render the export tab
  const renderExportTab = () => (
    <div>
      <h2 className="text-2xl font-bold mb-6">Export Results</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <div className="text-center">
            <div className="bg-blue-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Network size={32} className="text-blue-700" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Graphviz Network Map</h3>
            <p className="text-gray-600 mb-4">Visual representation of network topology</p>
            <button 
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 w-full"
              onClick={() => handleExport('graph')}
            >
              Export Graph
            </button>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <div className="text-center">
            <div className="bg-green-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Server size={32} className="text-green-700" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Terraform Configuration</h3>
            <p className="text-gray-600 mb-4">Infrastructure as code for GCP deployment</p>
            <button 
              className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 w-full"
              onClick={() => handleExport('terraform')}
            >
              Export Terraform
            </button>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <div className="text-center">
            <div className="bg-purple-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Database size={32} className="text-purple-700" />
            </div>
            <h3 className="text-lg font-semibold mb-2">JSON Data Export</h3>
            <p className="text-gray-600 mb-4">Complete analysis results in JSON format</p>
            <button 
              className="bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 w-full"
              onClick={() => handleExport('json')}
            >
              Export JSON
            </button>
          </div>
        </div>
      </div>
      
      {isConnectedToCloud && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Cloud Storage Options</h3>
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium">Storage Bucket</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option>network-analysis-results</option>
              <option>terraform-exports</option>
              <option>visualization-data</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button 
              className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700"
              onClick={() => {
                addNotification("Saving to cloud storage...", "info");
                setTimeout(() => {
                  addNotification("All files saved to cloud storage", "success");
                }, 2000);
              }}
            >
              Save All to Cloud
            </button>
          </div>
        </div>
      )}
      
      {!isConnectedToCloud && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
          <div className="flex items-start">
            <Info size={24} className="text-yellow-500 mr-3 mt-1" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Cloud Storage Not Available</h3>
              <p className="text-gray-600">Connect to Google Cloud Platform to enable direct cloud storage of analysis results.</p>
              <button 
                className="mt-4 bg-yellow-500 text-white py-2 px-4 rounded hover:bg-yellow-600"
                onClick={toggleCloudConnection}
              >
                Connect to GCP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Network size={28} />
            <h1 className="text-xl font-bold">Network Analyzer Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={toggleCloudConnection}
              className={`flex items-center p-2 rounded ${isConnectedToCloud ? 'hover:bg-blue-700' : 'hover:bg-blue-700'}`}
            >
              {isConnectedToCloud ? <Cloud size={20} /> : <CloudOff size={20} />}
              <span className="ml-2">GCP {isConnectedToCloud ? "Connected" : "Disconnected"}</span>
            </button>
            <button className="flex items-center p-2 rounded hover:bg-blue-700">
              <Settings size={20} />
              <span className="ml-2">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="w-64 bg-gray-800 text-white">
          <div className="p-4">
            <button 
              className={`flex items-center w-full p-3 rounded mb-2 ${activeTab === "upload" ? "bg-blue-600" : "hover:bg-gray-700"}`}
              onClick={() => setActiveTab("upload")}
            >
              <Upload size={20} className="mr-3" />
              Upload Data
            </button>
            <button 
              className={`flex items-center w-full p-3 rounded mb-2 ${activeTab === "analyze" ? "bg-blue-600" : "hover:bg-gray-700"}`}
              onClick={() => setActiveTab("analyze")}
              disabled={isTabDisabled("analyze")}
              style={{ opacity: isTabDisabled("analyze") ? 0.5 : 1 }}
            >
              <Play size={20} className="mr-3" />
              Analyze
            </button>
            <button 
              className={`flex items-center w-full p-3 rounded mb-2 ${activeTab === "results" ? "bg-blue-600" : "hover:bg-gray-700"}`}
              onClick={() => setActiveTab("results")}
              disabled={isTabDisabled("results")}
              style={{ opacity: isTabDisabled("results") ? 0.5 : 1 }}
            >
              <Activity size={20} className="mr-3" />
              Results
            </button>
            <button 
              className={`flex items-center w-full p-3 rounded mb-2 ${activeTab === "export" ? "bg-blue-600" : "hover:bg-gray-700"}`}
              onClick={() => setActiveTab("export")}
              disabled={isTabDisabled("export")}
              style={{ opacity: isTabDisabled("export") ? 0.5 : 1 }}
            >
              <Download size={20} className="mr-3" />
              Export
            </button>
          </div>
          
          {/* Status indicators */}
          <div className="mt-auto p-4 border-t border-gray-700">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">System Status</h3>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">Cloud Storage</span>
                <span className={`h-3 w-3 rounded-full ${isConnectedToCloud ? "bg-green-500" : "bg-red-500"}`}></span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">Parser Service</span>
                <span className="h-3 w-3 rounded-full bg-green-500"></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Analysis Engine</span>
                <span className="h-3 w-3 rounded-full bg-green-500"></span>
              </div>
            </div>
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === "upload" && renderUploadTab()}
          {activeTab === "analyze" && renderAnalyzeTab()}
          {activeTab === "results" && renderResultsTab()}
          {activeTab === "export" && renderExportTab()}

          {error && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
                <div className="flex items-start">
                  <AlertCircle size={24} className="text-red-500 mr-3" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">Error</h3>
                    <p className="text-gray-700 mb-4">{error}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button 
                    className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
                    onClick={() => setError(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Notifications */}
      <div className="fixed bottom-4 right-4 z-50 w-80">
        {notifications.map(notification => (
          <div 
            key={notification.id}
            className={`mb-2 p-3 rounded-lg shadow-lg flex justify-between items-center ${
              notification.type === 'success' ? 'bg-green-500 text-white' :
              notification.type === 'error' ? 'bg-red-500 text-white' :
              'bg-blue-500 text-white'
            }`}
          >
            <div className="flex items-center">
              {notification.type === 'success' && <CheckCircle size={18} className="mr-2" />}
              {notification.type === 'error' && <AlertCircle size={18} className="mr-2" />}
              {notification.type === 'info' && <Info size={18} className="mr-2" />}
              <p>{notification.message}</p>
            </div>
            <button 
              onClick={() => removeNotification(notification.id)}
              className="ml-2 text-white hover:text-gray-200"
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}