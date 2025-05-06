// src/components/visualizations/ProtocolChartView.js
import React from 'react';

/**
 * Componente per visualizzare la distribuzione dei protocolli come grafico a barre
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Array} props.protocols - Array di oggetti protocollo con name e count
 */
const ProtocolChartView = ({ protocols }) => {
  if (!protocols || protocols.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        <p>No protocol data available</p>
      </div>
    );
  }
  
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

export default ProtocolChartView;