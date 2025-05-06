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
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
        {subnets.map((entry, idx) => {
          const [subnetPart, hostsPart, rolePart] = entry.split(" | ");

          const subnet = subnetPart.trim();
          const hosts = hostsPart.replace("Hosts in subnet: ", "").trim();
          const role = rolePart.replace("Roles: ", "").trim();

          return (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-3 whitespace-nowrap">{subnet}</td>
              <td className="px-3 py-3 whitespace-nowrap">{hosts}</td>
              <td className="px-3 py-3 whitespace-nowrap">{role}</td>
            </tr>
          );
        })}
        </tbody>
      </table>
    </div>
  );
};

export default SubnetListView;