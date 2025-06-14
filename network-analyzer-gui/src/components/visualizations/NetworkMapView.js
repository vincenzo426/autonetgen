// src/components/visualizations/NetworkMapView.js
import React from "react";
import { Network } from "lucide-react";

/**
 * Componente per visualizzare un'anteprima della mappa di rete
 *
 * @param {Object} props - Proprietà del componente
 * @param {Function} props.onViewFullMap - Callback per visualizzare la mappa completa
 */
const NetworkMapView = ({ onViewFullMap }) => {
  return (
    <div className="bg-gray-100 rounded-md p-4 flex flex-col items-center justify-center min-h-[300px]">
      <Network size={64} className="text-gray-400 mb-4" />
      <p className="text-gray-500 mb-4 text-center">
        Network visualization preview
      </p>
      <button
        className="mt-4 bg-blue-600 text-white py-1 px-4 rounded text-sm hover:bg-blue-700"
        onClick={onViewFullMap}
      >
        View Full Network Map
      </button>
    </div>
  );
};

export default NetworkMapView;
