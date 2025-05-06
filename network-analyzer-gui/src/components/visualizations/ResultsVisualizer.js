// src/components/visualizations/ResultsVisualizer.js
import { useState } from 'react';
import { 
  Network, 
  Server, 
  Activity, 
  AlertCircle, 
  Download, 
  BarChart, 
  PieChart,
  Globe
} from 'lucide-react';
import NetworkMapView from './NetworkMapView';
import ProtocolChartView from './ProtocolChartView';
import RoleDistributionView from './RoleDistributionView';
import SubnetListView from './SubnetListView';

/**
 * Componente principale per visualizzare i risultati dell'analisi
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.results - Risultati dell'analisi
 * @param {Function} props.onExportClick - Handler per l'esportazione
 */
const ResultsVisualizer = ({ results, onExportClick }) => {
  const [activeTab, setActiveTab] = useState('overview');
  
  if (!results) {
    return (
      <div className="p-6 text-center text-gray-500">
        <AlertCircle size={48} className="mx-auto mb-4" />
        <p>No analysis results available. Please run an analysis first.</p>
      </div>
    );
  }
  
  // Preprocess dei dati in arrivo per garantire un formato coerente
  const processedResults = {
    hosts: results.hosts || 0,
    hosts_list: results.hosts_list || [],
    connections: results.connections || 0,
    protocols: Array.isArray(results.protocols) ? results.protocols : 
               (typeof results.protocols === 'object' ? 
                Object.entries(results.protocols).map(([name, count]) => ({ name, count })) : 
                []),
    anomalies: results.anomalies || 0,
    subnets: Array.isArray(results.subnets) ? results.subnets : [],
    roles: results.roles || {},
    output_paths: results.output_paths || {}
  };

  // Array di tabs disponibili
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'roles', label: 'Host Roles' },
    { id: 'subnets', label: 'Subnets' },
    { id: 'protocols', label: 'Protocols' }
  ];
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Tabs di navigazione */}
      <div className="bg-gray-50 border-b border-gray-200">
        <nav className="flex overflow-x-auto">
          {tabs.map(tab => (
            <TabButton 
              key={tab.id}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              label={tab.label}
            />
          ))}
        </nav>
      </div>
      
      {/* Contenuto della tab attiva */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab 
            data={processedResults}
            onExportClick={onExportClick}
          />
        )}
        
        {activeTab === 'roles' && (
          <RolesTab 
            data={processedResults}
          />
        )}
        
        {activeTab === 'subnets' && (
          <SubnetsTab 
            data={processedResults}
          />
        )}
        
        {activeTab === 'protocols' && (
          <ProtocolsTab 
            data={processedResults}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Componente per un pulsante di tab
 */
const TabButton = ({ isActive, onClick, label }) => {
  return (
    <button
      className={`py-3 px-6 font-medium text-sm focus:outline-none ${
        isActive 
          ? 'text-blue-600 border-b-2 border-blue-600' 
          : 'text-gray-500 hover:text-gray-700'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

/**
 * Componente per la sezione overview
 */
const OverviewTab = ({ data, onExportClick }) => {
  // Dati per le card di statistiche
  const statCards = [
    {
      title: 'Hosts',
      value: data.hosts,
      icon: Server,
      color: 'blue'
    },
    {
      title: 'Connections',
      value: data.connections,
      icon: Activity,
      color: 'green'
    },
    {
      title: 'Anomalies',
      value: data.anomalies,
      icon: AlertCircle,
      color: 'amber'
    }
  ];

  return (
    <div>
      {/* Card di statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {statCards.map((card, index) => (
          <StatCard key={index} data={card} />
        ))}
      </div>
      
      {/* Grafici principali */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Network size={20} className="text-gray-500 mr-2" />
            Network Map
          </h3>
          <NetworkMapView onViewFullMap={() => onExportClick('graph')} />
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BarChart size={20} className="text-gray-500 mr-2" />
            Protocol Distribution
          </h3>
          <ProtocolChartView protocols={data.protocols} />
        </div>
      </div>
      
      {/* Bottone esportazione */}
      <div className="flex justify-end">
        <button 
          className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700"
          onClick={() => onExportClick('analysis')}
        >
          <Download size={20} className="mr-2" />
          Export Full Analysis
        </button>
      </div>
    </div>
  );
};

/**
 * Componente per la scheda Host Roles
 */
const RolesTab = ({ data }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <PieChart size={20} className="text-gray-500 mr-2" />
        Host Roles Distribution
      </h3>
      <RoleDistributionView roles={data.roles} />
    </div>
  );
};

/**
 * Componente per la scheda Subnets
 */
const SubnetsTab = ({ data }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Globe size={20} className="text-gray-500 mr-2" />
        Subnet Information
      </h3>
      <SubnetListView subnets={data.subnets} />
    </div>
  );
};

/**
 * Componente per la scheda Protocols
 */
const ProtocolsTab = ({ data }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <BarChart size={20} className="text-gray-500 mr-2" />
        Protocol Distribution
      </h3>
      <ProtocolChartView protocols={data.protocols} />
    </div>
  );
};

/**
 * Card di statistica
 */
const StatCard = ({ data }) => {
  const getColorClasses = () => {
    switch (data.color) {
      case 'blue': return 'bg-blue-50 text-blue-900 border-blue-100';
      case 'green': return 'bg-green-50 text-green-900 border-green-100';
      case 'amber': return 'bg-amber-50 text-amber-900 border-amber-100';
      default: return 'bg-gray-50 text-gray-900 border-gray-100';
    }
  };

  const getIconColorClass = () => {
    switch (data.color) {
      case 'blue': return 'text-blue-600';
      case 'green': return 'text-green-600'; 
      case 'amber': return 'text-amber-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className={`p-6 rounded-lg border ${getColorClasses()}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium">{data.title}</h3>
        <data.icon size={24} className={getIconColorClass()} />
      </div>
      <p className="text-3xl font-bold">{data.value}</p>
    </div>
  );
};

export default ResultsVisualizer;