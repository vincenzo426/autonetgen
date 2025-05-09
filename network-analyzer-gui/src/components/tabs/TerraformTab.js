// src/components/tabs/TerraformTab.js
import React, { useState, useEffect } from 'react';
import TerraformViewer from '../terraform/TerraformViewer';
import DeployControls from '../terraform/DeployControls';

/**
 * Componente per la scheda che mostra e permette di modificare i file Terraform
 * e di deployare l'infrastruttura
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.results - Risultati dell'analisi
 * @param {boolean} props.isCloudConnected - Indica se è attiva la connessione al cloud
 * @param {Function} props.onNotify - Handler per mostrare notifiche
 */
const TerraformTab = ({ results, isCloudConnected, onNotify }) => {
  const [selectedSection, setSelectedSection] = useState('files'); // files, deploy
  
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
        View, edit, and deploy your generated Terraform infrastructure on Google Cloud Platform.
      </p>
      
      {/* Tabs per selezionare la sezione */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex">
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${
              selectedSection === 'files' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setSelectedSection('files')}
          >
            Configuration Files
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${
              selectedSection === 'deploy' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setSelectedSection('deploy')}
          >
            Deploy Infrastructure
          </button>
        </nav>
      </div>
      
      {/* Contenuto in base alla sezione selezionata */}
      {selectedSection === 'files' ? (
        <div className="h-[calc(100%-10rem)]">
          <TerraformViewer 
            terraformPath={results.output_paths.terraform} 
            onNotify={onNotify} 
          />
        </div>
      ) : (
        <DeployControls 
          terraformPath={results.output_paths.terraform} 
          onNotify={onNotify}
          isCloudConnected={isCloudConnected}
        />
      )}
    </div>
  );
};

export default TerraformTab;