// src/components/visualizations/SubnetListView.js
import React from 'react';

/**
 * Componente per visualizzare le informazioni sulle subnet
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Array} props.subnets - Array di subnet
 */
const SubnetListView = ({ subnets }) => {
  if (!subnets || subnets.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        <p>No subnet data available</p>
      </div>
    );
  }
  
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

export default SubnetListView;