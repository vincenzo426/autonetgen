// src/components/layout/Sidebar.js
import { Upload, Play, Activity, Download, Server, Code, Database } from "lucide-react";

/**
 * Componente per la barra laterale dell'applicazione
 * 
 * @param {Object} props - Proprietà del componente
 * @param {string} props.activeTab - Tab attualmente attiva
 * @param {Function} props.onTabChange - Funzione per cambiare la tab attiva
 * @param {Function} props.isTabDisabled - Funzione che verifica se una tab dovrebbe essere disabilitata
 * @param {boolean} props.isServerAvailable - Indica se il server è disponibile
 * @param {boolean} props.isConnectedToCloud - Indica se è attiva la connessione al cloud
 * @param {Array} props.additionalTabs - Tab aggiuntive da visualizzare
 */
const Sidebar = ({
  activeTab,
  onTabChange,
  isTabDisabled,
  isServerAvailable,
  isConnectedToCloud,
  additionalTabs = []
}) => {
  // Definizione delle tabs di base dell'applicazione
  const baseTabs = [
    { 
      id: "upload", 
      name: "Upload Data", 
      icon: Upload 
    },
    { 
      id: "analyze", 
      name: "Analyze", 
      icon: Play 
    },
    { 
      id: "results", 
      name: "Results", 
      icon: Activity 
    },
    { 
      id: "export", 
      name: "Export", 
      icon: Download 
    }
  ];
  
  // Funzione di supporto per ottenere il componente icona
  const getIconComponent = (iconName) => {
    switch (iconName) {
      case "Server": return Server;
      case "Code": return Code;
      case "Database": return Database;
      default: return null;
    }
  };
  
  // Prepara le tab aggiuntive con i componenti icona corretti
  const processedAdditionalTabs = additionalTabs.map(tab => ({
    ...tab,
    icon: typeof tab.icon === 'string' ? getIconComponent(tab.icon) : tab.icon
  }));
  
  // Combina le tab di base con quelle aggiuntive
  const allTabs = [...baseTabs, ...processedAdditionalTabs];

  return (
    <nav className="w-64 bg-gray-800 text-white">
      <div className="p-4">
        {/* Tabs di navigazione */}
        {allTabs.map(tab => (
          <TabButton
            key={tab.id}
            id={tab.id}
            name={tab.name}
            Icon={tab.icon}
            isActive={activeTab === tab.id}
            isDisabled={isTabDisabled(tab.id)}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>
      
      {/* Indicatori di stato */}
      <StatusIndicators 
        isServerAvailable={isServerAvailable}
        isConnectedToCloud={isConnectedToCloud}
      />
    </nav>
  );
};

/**
 * Componente per un pulsante di navigazione
 */
const TabButton = ({ id, name, Icon, isActive, isDisabled, onClick }) => {
  return (
    <button 
      className={`flex items-center w-full p-3 rounded mb-2 ${
        isActive ? "bg-blue-600" : "hover:bg-gray-700"
      }`}
      onClick={onClick}
      disabled={isDisabled}
      style={{ opacity: isDisabled ? 0.5 : 1 }}
    >
      {Icon && <Icon size={20} className="mr-3" />}
      {name}
    </button>
  );
};

/**
 * Componente per gli indicatori di stato del sistema
 */
const StatusIndicators = ({ isServerAvailable, isConnectedToCloud }) => {
  // Array di stati da mostrare
  const statuses = [
    {
      name: "Cloud Storage",
      isActive: isConnectedToCloud
    },
    {
      name: "Parser Service",
      isActive: isServerAvailable
    },
    {
      name: "Analysis Engine",
      isActive: isServerAvailable
    }
  ];

  return (
    <div className="mt-auto p-4 border-t border-gray-700">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">System Status</h3>
        
        {statuses.map((status, index) => (
          <div key={index} className="flex items-center justify-between mb-1">
            <span className="text-sm">{status.name}</span>
            <span className={`h-3 w-3 rounded-full ${
              status.isActive ? "bg-green-500" : "bg-red-500"
            }`}></span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;