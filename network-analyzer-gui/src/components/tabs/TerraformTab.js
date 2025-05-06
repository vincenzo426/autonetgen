// src/components/tabs/TerraformTab.js
import React from 'react';
import TerraformViewer from '../terraform/TerraformViewer';

/**
 * Componente per la scheda che mostra e permette di modificare i file Terraform
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.results - Risultati dell'analisi
 * @param {Function} props.onNotify - Handler per mostrare notifiche
 */
const TerraformTab = ({ results, onNotify }) => {
  if (!results || !results.output_paths || !results.output_paths.terraform) {
    return (
      <div className="flex flex-col items-center justify-center bg-white p-8 rounded-lg shadow-md min-h-[400px]">
        <div className="text-center text-gray-500">
          <p className="mb-4">No Terraform configuration available yet.</p>
          <p>Please run an analysis first to generate Terraform files.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-16rem)]">
      <h2 className="text-2xl font-bold mb-4">Terraform Configuration</h2>
      <p className="text-gray-600 mb-4">
        View and edit your generated Terraform files. You can make changes to the configuration 
        before deploying to Google Cloud Platform.
      </p>
      
      <div className="h-[calc(100%-6rem)]">
        <TerraformViewer 
          terraformPath={results.output_paths.terraform} 
          onNotify={onNotify} 
        />
      </div>
    </div>
  );
};

export default TerraformTab;