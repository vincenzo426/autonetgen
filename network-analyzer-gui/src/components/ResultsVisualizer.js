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

const ProtocolChart = ({ protocols }) => {
  if (!protocols || protocols.length === 0) return null;
  
  // Normalizza le percentuali in modo che la somma sia 100%
  const total = protocols.reduce((sum, item) => sum + item.count, 0);
  const protocolData = protocols.map(protocol => ({
    ...protocol,
    percentage: Math.round((protocol.count / total) * 100)
  }));
  
  return (
    <div className="w-full">
      {protocolData.map((protocol, idx) => (
        <div key={idx} className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="font-medium">{protocol.name}</span>
            <span>{protocol.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${protocol.percentage}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};

const RoleDistribution = ({ roles }) => {
  if (!roles || Object.keys(roles).length === 0) return null;
  
  // Calcola il totale per le percentuali
  const total = Object.values(roles).reduce((sum, count) => sum + count, 0);
  
  // Colori per le diverse categorie di ruoli
  const colors = {
    CLIENT: '#3B82F6', // blue
    SERVER: '#10B981', // green
    PLC_MODBUS: '#F59E0B', // amber
    PLC_S7COMM: '#D97706', // darker amber
    PLC_ETHERNET_IP: '#92400E', // brown
    WEB_SERVER: '#EC4899', // pink
    DATABASE_SERVER: '#8B5CF6', // purple
    WEB_CLIENT: '#60A5FA', // light blue
    GATEWAY: '#F97316', // orange
    UNKNOWN: '#9CA3AF', // gray
  };
  
  // Calcola offset cumulativi per costruire il grafico a torta
  let cumulativeOffset = 0;
  const roleData = Object.entries(roles).map(([role, count]) => {
    const percentage = Math.round((count / total) * 100);
    const startOffset = cumulativeOffset;
    cumulativeOffset += percentage;
    
    return {
      role,
      count,
      percentage,
      startOffset,
      endOffset: cumulativeOffset,
      color: colors[role] || '#9CA3AF' // default to gray
    };
  });
  
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="w-full md:w-1/2">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {roleData.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                    {item.role}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{item.count}</td>
                <td className="px-3 py-2 whitespace-nowrap">{item.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="w-full md:w-1/2 flex justify-center">
        <div className="relative w-48 h-48">
          {/* SVG Pie Chart */}
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Circle segments */}
            {roleData.map((item, idx) => {
              // Calcola gli angoli per il segmento circolare
              const startAngle = (item.startOffset / 100) * 360;
              const endAngle = (item.endOffset / 100) * 360;
              
              // Converti in coordinate
              const startX = 50 + 50 * Math.cos(Math.PI * startAngle / 180);
              const startY = 50 + 50 * Math.sin(Math.PI * startAngle / 180);
              const endX = 50 + 50 * Math.cos(Math.PI * endAngle / 180);
              const endY = 50 + 50 * Math.sin(Math.PI * endAngle / 180);
              
              // Determina se l'arco Ã¨ maggiore di 180 gradi
              const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
              
              // Path per il segmento
              const path = `
                M 50 50
                L ${startX} ${startY}
                A 50 50 0 ${largeArcFlag} 1 ${endX} ${endY}
                Z
              `;
              
              return (
                <path 
                  key={idx} 
                  d={path} 
                  fill={item.color}
                  stroke="#fff"
                  strokeWidth="0.5"
                />
              );
            })}
            
            {/* Centro bianco */}
            <circle cx="50" cy="50" r="25" fill="white" />
            
            {/* Testo centrale */}
            <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontWeight="bold" fontSize="10">
              {total} hosts
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};

const SubnetList = ({ subnets }) => {
  if (!subnets || subnets.length === 0) return null;
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subnet</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hosts</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Main Role</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {subnets.map((subnet, idx) => {
            // Numero casuale di host per subnet per dimostrazione
            const hosts = Math.floor(Math.random() * 15) + 1;
            // Scegli un ruolo casuale
            const roles = ['CLIENT', 'SERVER', 'PLC_MODBUS', 'GATEWAY', 'UNKNOWN'];
            const mainRole = roles[Math.floor(Math.random() * roles.length)];
            
            return (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-3 whitespace-nowrap">{subnet}</td>
                <td className="px-3 py-3 whitespace-nowrap">{hosts}</td>
                <td className="px-3 py-3 whitespace-nowrap">{mainRole}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const NetworkMap = ({ onViewFullMap }) => {
  return (
    <div className="bg-gray-100 rounded-md p-4 flex flex-col items-center justify-center min-h-[300px]">
      <Network size={64} className="text-gray-400 mb-4" />
      <p className="text-gray-500 mb-4 text-center">Network visualization preview</p>
      <button 
        className="mt-4 bg-blue-600 text-white py-1 px-4 rounded text-sm hover:bg-blue-700"
        onClick={onViewFullMap}
      >
        View Full Network Map
      </button>
    </div>
  );
};

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
  
  // Preprocess del formato dei dati in arrivo
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
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Tabs */}
      <div className="bg-gray-50 border-b border-gray-200">
        <nav className="flex overflow-x-auto">
          <button
            className={`py-3 px-6 font-medium text-sm focus:outline-none ${
              activeTab === 'overview' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm focus:outline-none ${
              activeTab === 'roles' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('roles')}
          >
            Host Roles
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm focus:outline-none ${
              activeTab === 'subnets' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('subnets')}
          >
            Subnets
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm focus:outline-none ${
              activeTab === 'protocols' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('protocols')}
          >
            Protocols
          </button>
        </nav>
      </div>
      
      {/* Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-blue-900">Hosts</h3>
                  <Server size={24} className="text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-blue-900">{processedResults.hosts}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg border border-green-100">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-green-900">Connections</h3>
                  <Activity size={24} className="text-green-600" />
                </div>
                <p className="text-3xl font-bold text-green-900">{processedResults.connections}</p>
              </div>
              <div className="bg-amber-50 p-6 rounded-lg border border-amber-100">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-amber-900">Anomalies</h3>
                  <AlertCircle size={24} className="text-amber-600" />
                </div>
                <p className="text-3xl font-bold text-amber-900">{processedResults.anomalies || 0}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Network size={20} className="text-gray-500 mr-2" />
                  Network Map
                </h3>
                <NetworkMap onViewFullMap={() => onExportClick('graph')} />
              </div>
              
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <BarChart size={20} className="text-gray-500 mr-2" />
                  Protocol Distribution
                </h3>
                <ProtocolChart protocols={processedResults.protocols} />
              </div>
            </div>
            
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
        )}
        
        {/* Host Roles Tab */}
        {activeTab === 'roles' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <PieChart size={20} className="text-gray-500 mr-2" />
              Host Roles Distribution
            </h3>
            <RoleDistribution roles={processedResults.roles} />
          </div>
        )}
        
        {/* Subnets Tab */}
        {activeTab === 'subnets' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Globe size={20} className="text-gray-500 mr-2" />
              Subnet Information
            </h3>
            <SubnetList subnets={processedResults.subnets} />
          </div>
        )}
        
        {/* Protocols Tab */}
        {activeTab === 'protocols' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <BarChart size={20} className="text-gray-500 mr-2" />
              Protocol Distribution
            </h3>
            <ProtocolChart protocols={processedResults.protocols} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsVisualizer;