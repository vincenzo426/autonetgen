// src/components/layout/Header.js
import { Network, Settings, Cloud, CloudOff, Loader2 } from "lucide-react";

/**
 * Componente header dell'applicazione
 * 
 * @param {Object} props - Proprietà del componente
 * @param {boolean} props.isCheckingServer - Indica se è in corso un controllo dello stato del server
 * @param {boolean} props.isServerAvailable - Indica se il server è disponibile
 * @param {boolean} props.isConnectedToCloud - Indica se è attiva la connessione al cloud
 * @param {Function} props.onToggleCloud - Funzione per attivare/disattivare la connessione al cloud
 */
const Header = ({ 
  isCheckingServer, 
  isServerAvailable, 
  isConnectedToCloud, 
  onToggleCloud 
}) => {
  return (
    <header className="bg-blue-600 text-white p-4 shadow-md">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Network size={28} />
          <h1 className="text-xl font-bold">Network Traffic Analyzer</h1>
        </div>
        <div className="flex items-center space-x-4">
          {/* Indicatore stato server */}
          <ServerStatusIndicator 
            isChecking={isCheckingServer} 
            isAvailable={isServerAvailable} 
          />
          
          {/* Pulsante connessione cloud */}
          <CloudButton 
            isConnected={isConnectedToCloud} 
            onToggle={onToggleCloud} 
          />
          
          {/* Pulsante impostazioni */}
          <button className="flex items-center p-2 rounded hover:bg-blue-700">
            <Settings size={20} />
            <span className="ml-2">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};

/**
 * Componente per mostrare lo stato del server
 */
const ServerStatusIndicator = ({ isChecking, isAvailable }) => {
  if (isChecking) {
    return (
      <div className="flex items-center text-blue-200">
        <Loader2 size={16} className="animate-spin mr-1" />
        <span className="text-sm">Checking connection...</span>
      </div>
    );
  }
  
  if (isAvailable) {
    return (
      <div className="flex items-center text-green-200">
        <span className="h-2 w-2 rounded-full bg-green-400 mr-1"></span>
        <span className="text-sm">Server connected</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center text-red-200">
      <span className="h-2 w-2 rounded-full bg-red-400 mr-1"></span>
      <span className="text-sm">Server unavailable</span>
    </div>
  );
};

/**
 * Pulsante per attivare/disattivare la connessione al cloud
 */
const CloudButton = ({ isConnected, onToggle }) => {
  return (
    <button 
      onClick={onToggle}
      className="flex items-center p-2 rounded hover:bg-blue-700"
    >
      {isConnected ? <Cloud size={20} /> : <CloudOff size={20} />}
      <span className="ml-2">GCP {isConnected ? "Connected" : "Disconnected"}</span>
    </button>
  );
};

export default Header;