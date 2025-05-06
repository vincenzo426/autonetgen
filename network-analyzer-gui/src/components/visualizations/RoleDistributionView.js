// src/components/visualizations/RoleDistributionView.js
import React from 'react';

/**
 * Componente per visualizzare la distribuzione dei ruoli degli host nella rete
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.roles - Oggetto con ruoli come chiavi e conteggi come valori
 */
const RoleDistributionView = ({ roles }) => {
  if (!roles || Object.keys(roles).length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        <p>No role distribution data available</p>
      </div>
    );
  }
  
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
      {/* Tabella */}
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
      
      {/* Grafico a torta */}
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
              
              // Determina se l'arco è maggiore di 180 gradi
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

export default RoleDistributionView;