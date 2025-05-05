import { useState, useEffect } from "react";
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
  ChevronDown
} from "lucide-react";

// Main App Component
export default function NetworkAnalyzerDashboard() {
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [selectedParser, setSelectedParser] = useState("pcap");
  const [outputFormats, setOutputFormats] = useState({
    graphviz: true,
    terraform: true,
    json: false
  });
  const [isConnectedToCloud, setIsConnectedToCloud] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Simulated function for file upload handling
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles([...uploadedFiles, ...files]);
    
    // Add notification
    addNotification("Files uploaded successfully", "success");
  };


  const startAnalysis = async () => {
    const formData = new FormData();
    formData.append('file', uploadedFiles[0]);
    formData.append('type', 'pcap'); // Optional: CSV, netflow, etc.
  
    const response = await fetch('http://localhost:8000/api/analyze', {
      method: 'POST',
      body: formData,
    });
  
    const result = await response.json();
    console.log(result);
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
              className="flex items-center p-2 rounded hover:bg-blue-700"
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
            >
              <Play size={20} className="mr-3" />
              Analyze
            </button>
            <button 
              className={`flex items-center w-full p-3 rounded mb-2 ${activeTab === "results" ? "bg-blue-600" : "hover:bg-gray-700"}`}
              onClick={() => analysisResults && setActiveTab("results")}
              disabled={!analysisResults}
              style={{ opacity: analysisResults ? 1 : 0.5 }}
            >
              <Activity size={20} className="mr-3" />
              Results
            </button>
            <button 
              className={`flex items-center w-full p-3 rounded mb-2 ${activeTab === "export" ? "bg-blue-600" : "hover:bg-gray-700"}`}
              onClick={() => analysisResults && setActiveTab("export")}
              disabled={!analysisResults}
              style={{ opacity: analysisResults ? 1 : 0.5 }}
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
          {/* Upload Tab */}
          {activeTab === "upload" && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Upload Network Data</h2>
              <div className="bg-white p-8 rounded-lg shadow-md mb-6">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                  <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="mb-4 text-gray-600">Drag and drop your files here, or</p>
                  <label className="bg-blue-600 text-white py-2 px-6 rounded cursor-pointer hover:bg-blue-700 inline-block">
                    Browse Files
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={handleFileUpload} 
                      multiple
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
                          <span>{file.name}</span>
                        </div>
                        <button 
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
                          }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Analyze Tab */}
          {activeTab === "analyze" && (
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
                    <option value="pcap">PCAP Parser</option>
                    <option value="csv">CSV Parser</option>
                    <option value="netflow">NetFlow Parser</option>
                  </select>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h3 className="text-lg font-semibold mb-4">Output Generation</h3>
                <div>
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
          )}

          {/* Results Tab */}
          {activeTab === "results" && analysisResults && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Analysis Results</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-gray-500">Nodes</h3>
                    <Server size={24} className="text-blue-600" />
                  </div>
                  <p className="text-3xl font-bold">{analysisResults.nodes}</p>
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
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-4">Network Map</h3>
                  <div className="bg-gray-100 h-64 rounded flex items-center justify-center">
                    <Network size={48} className="text-gray-400" />
                    <p className="ml-3 text-gray-500">Network visualization would appear here</p>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-4">Protocol Distribution</h3>
                  <div className="bg-gray-100 h-64 rounded flex items-center justify-center">
                    <div className="w-full px-8">
                      {analysisResults.protocols.map((protocol, idx) => (
                        <div key={idx} className="mb-3">
                          <div className="flex justify-between mb-1">
                            <span>{protocol}</span>
                            <span>{Math.floor(Math.random() * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.floor(Math.random() * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === "export" && analysisResults && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Export Results</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-shadow">
                  <div className="text-center">
                    <div className="bg-blue-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <Network size={32} className="text-blue-700" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Graphviz Network Map</h3>
                    <p className="text-gray-600 mb-4">Visual representation of network topology</p>
                    <button className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 w-full">
                      Export Graph
                    </button>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-shadow">
                  <div className="text-center">
                    <div className="bg-green-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <Server size={32} className="text-green-700" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Terraform Configuration</h3>
                    <p className="text-gray-600 mb-4">Infrastructure as code for GCP deployment</p>
                    <button className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 w-full">
                      Export Terraform
                    </button>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-shadow">
                  <div className="text-center">
                    <div className="bg-purple-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <Database size={32} className="text-purple-700" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">JSON Data Export</h3>
                    <p className="text-gray-600 mb-4">Complete analysis results in JSON format</p>
                    <button className="bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 w-full">
                      Export JSON
                    </button>
                  </div>
                </div>
              </div>
              
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
                  <button className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700">
                    Save All to Cloud
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
            <p>{notification.message}</p>
            <button 
              onClick={() => removeNotification(notification.id)}
              className="ml-2 text-white"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
