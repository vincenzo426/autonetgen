// src/components/terraform/TerraformViewer.js
import React, { useState, useEffect } from 'react';
import { 
  Save, 
  RefreshCw, 
  Check, 
  X, 
  FileCode, 
  Edit2, 
  Download, 
  Server,
  Info
} from 'lucide-react';
import apiService from '../../services/apiService';

/**
 * Componente per visualizzare e modificare i file Terraform generati
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.terraformPath - Percorso dei file Terraform
 * @param {Function} props.onNotify - Handler per mostrare notifiche
 */
const TerraformViewer = ({ terraformPath, onNotify }) => {
  const [fileList, setFileList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  // Modifica 1: Aggiungi una variabile di stato separata per il caricamento del contenuto
  const [isFileContentLoading, setIsFileContentLoading] = useState(false);

  // Carica la lista dei file Terraform all'avvio
  useEffect(() => {
    if (terraformPath) {
      fetchTerraformFiles();
    }
  }, [terraformPath]);

  /**
   * Recupera la lista dei file Terraform dal server
   */
  const fetchTerraformFiles = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // In un'implementazione reale, questa chiamata API recupererebbe i file dal server
      const response = await apiService.getTerraformFiles(terraformPath);
      setFileList(response.files);
      
      // Simulazione dei dati per scopi di dimostrazione
      /*setTimeout(() => {
        const mockFiles = [
          { id: 1, name: 'provider.tf', type: 'configuration' },
          { id: 2, name: 'network.tf', type: 'network' },
          { id: 3, name: 'instances.tf', type: 'compute' },
          { id: 4, name: 'outputs.tf', type: 'output' },
          { id: 5, name: 'variables.tf', type: 'variables' }
        ];
        setFileList(mockFiles);
        setIsLoading(false);
      }, 1000);*/
    } catch (error) {
      setError('Error fetching Terraform files. Please try again.');
      setIsLoading(false);
      onNotify && onNotify({
        message: `Error fetching Terraform files: ${error.message}`,
        type: 'error'
      });
    }
  };

  /**
   * Seleziona un file e ne visualizza il contenuto
   * @param {Object} file - Il file selezionato
   */
  const handleFileSelect = async (file) => {
    if (isEditing && fileContent !== originalContent) {
      if (!window.confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    
    setSelectedFile(file);
    setIsFileContentLoading(true); // Usa la nuova variabile invece di isLoading
    setError(null);
    
    try {
      // In un'implementazione reale, questa chiamata API recupererebbe il contenuto del file
      const response = await apiService.getTerraformFileContent(terraformPath, file.name);
      setFileContent(response.content);
      setOriginalContent(response.content);
      
      // Simulazione dei dati per scopi di dimostrazione
      /*setTimeout(() => {
        const mockContent = getMockFileContent(file.name);
        setFileContent(mockContent);
        setOriginalContent(mockContent);
        setIsLoading(false);
        setIsEditing(false);
      }, 800);*/
    } catch (error) {
      setError(`Error loading file content for ${file.name}.`);
      setIsLoading(false);
      onNotify && onNotify({
        message: `Error loading file: ${error.message}`,
        type: 'error'
      });
    }finally {
        setIsFileContentLoading(false); // Aggiorna la nuova variabile
      }
  };

  /**
   * Ottiene contenuto simulato per un file Terraform
   * @param {string} fileName - Nome del file
   * @returns {string} Contenuto simulato del file
   */
  const getMockFileContent = (fileName) => {
    switch (fileName) {
      case 'provider.tf':
        return `
provider "google" {
  project = "my-project-id"
  region  = "us-central1"
  zone    = "us-central1-a"
}

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}`;
      case 'network.tf':
        return `
# Rete VPC principale
resource "google_compute_network" "main_network" {
  name                    = "inferred-network"
  auto_create_subnetworks = false
}

# Firewall per permettere l'SSH
resource "google_compute_firewall" "allow_ssh" {
  name    = "allow-ssh"
  network = google_compute_network.main_network.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ssh"]
}

resource "google_compute_subnetwork" "subnet-1" {
  name          = "subnet-1"
  network       = google_compute_network.main_network.name
  ip_cidr_range = "10.1.0.0/24"
  region        = "us-central1"
}`;
      case 'instances.tf':
        return `
resource "google_compute_instance" "host_192_168_1_1" {
  name         = "host-192-168-1-1"
  machine_type = "e2-medium"
  zone         = "us-central1-a"
  tags         = ["ssh", "server", "host-192-168-1-1"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network    = google_compute_network.main_network.name
    subnetwork = google_compute_subnetwork.subnet-1.name
    
    access_config {
      // Ephemeral IP
    }
  }

  metadata = {
    role = "SERVER"
    original_ip = "192.168.1.1"
  }
}

resource "google_compute_instance" "host_192_168_1_2" {
  name         = "host-192-168-1-2"
  machine_type = "e2-micro"
  zone         = "us-central1-a"
  tags         = ["ssh", "client", "host-192-168-1-2"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network    = google_compute_network.main_network.name
    subnetwork = google_compute_subnetwork.subnet-1.name
    
    access_config {
      // Ephemeral IP
    }
  }

  metadata = {
    role = "CLIENT"
    original_ip = "192.168.1.2"
  }
}`;
      case 'outputs.tf':
        return `
output "original_to_gcp_mapping" {
  value = {
    "192.168.1.1" = "\${google_compute_instance.host_192_168_1_1.network_interface[0].network_ip}"
    "192.168.1.2" = "\${google_compute_instance.host_192_168_1_2.network_interface[0].network_ip}"
  }
  description = "Mappatura degli indirizzi IP originali agli indirizzi IP GCP"
}`;
      case 'variables.tf':
        return `
variable "project_id" {
  description = "ID del progetto GCP"
  type        = string
  default     = "my-project-id"
}

variable "region" {
  description = "Regione GCP"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "Zona GCP"
  type        = string
  default     = "us-central1-a"
}

variable "subnet_cidr" {
  description = "CIDR per la subnet"
  type        = string
  default     = "10.1.0.0/24"
}`;
      default:
        return '# No content available for this file';
    }
  };

  /**
   * Gestisce l'editing del file
   */
  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  /**
   * Gestisce il cambiamento del contenuto del file
   */
  const handleContentChange = (e) => {
    setFileContent(e.target.value);
  };

  /**
   * Salva le modifiche al file
   */
  const handleSaveChanges = async () => {
    setIsSaving(true);
    
    try {
      // In un'implementazione reale, questa chiamata API salverebbe il contenuto
      await apiService.saveTerraformFile(terraformPath, selectedFile.name, fileContent);
      
      // Simulazione per scopi di dimostrazione
      //await new Promise(resolve => setTimeout(resolve, 1000));
      
      setOriginalContent(fileContent);
      setIsEditing(false);
      onNotify && onNotify({
        message: `File ${selectedFile.name} saved successfully`,
        type: 'success'
      });
    } catch (error) {
      onNotify && onNotify({
        message: `Error saving file: ${error.message}`,
        type: 'error'
      });
    } finally {
        setIsSaving(false);
      }
  };

  /**
   * Annulla le modifiche al file
   */
  const handleCancelEdit = () => {
    setFileContent(originalContent);
    setIsEditing(false);
  };

  /**
   * Scarica il file selezionato
   */
  const handleDownloadFile = () => {
    if (!selectedFile) return;
    
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    onNotify && onNotify({
      message: `File ${selectedFile.name} downloaded`,
      type: 'success'
    });
  };

  /**
   * Scarica tutti i file Terraform come ZIP
   */
  const handleDownloadAllFiles = async () => {
    try {
      // In un'implementazione reale, chiameremo apiService.downloadFile
      onNotify && onNotify({
        message: 'Downloading all Terraform files as ZIP...',
        type: 'info'
      });
      
      await apiService.downloadFile('terraform', terraformPath);
      
      // Simulazione per scopi di dimostrazione
      //await new Promise(resolve => setTimeout(resolve, 1500));
      
      onNotify && onNotify({
        message: 'Terraform files downloaded successfully',
        type: 'success'
      });
    } catch (error) {
      onNotify && onNotify({
        message: `Error downloading files: ${error.message}`,
        type: 'error'
      });
    }
  };

  /**
   * Ottiene l'icona per un tipo di file Terraform
   */
  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'network':
        return <Server size={16} className="text-blue-500" />;
      case 'compute':
        return <Server size={16} className="text-green-500" />;
      case 'output':
        return <FileCode size={16} className="text-purple-500" />;
      case 'variables':
        return <FileCode size={16} className="text-amber-500" />;
      default:
        return <FileCode size={16} className="text-gray-500" />;
    }
  };

  /**
   * Verifica se ci sono modifiche non salvate
   */
  const hasUnsavedChanges = () => {
    return isEditing && fileContent !== originalContent;
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden h-full">
      <div className="flex flex-col md:flex-row h-full">
        {/* Sidebar con lista file */}
        <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Terraform Files</h3>
            <p className="text-sm text-gray-500 mt-1">Path: {terraformPath || 'output/terraform'}</p>
          </div>
          
          {/* Azioni globali */}
          <div className="p-3 border-b border-gray-200 bg-gray-100">
            <div className="flex justify-between">
              <button
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                onClick={fetchTerraformFiles}
                disabled={isLoading}
              >
                <RefreshCw size={14} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                className="text-green-600 hover:text-green-800 text-sm flex items-center"
                onClick={handleDownloadAllFiles}
              >
                <Download size={14} className="mr-1" />
                Download All
              </button>
            </div>
          </div>
          
          {/* Lista file */}
          {isLoading && fileList.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin h-5 w-5 border-b-2 border-gray-500 rounded-full mx-auto mb-2"></div>
              <p>Loading files...</p>
            </div>
          ) : error && fileList.length === 0 ? (
            <div className="p-4 text-center text-red-500">
              <p>{error}</p>
            </div>
          ) : fileList.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No Terraform files found</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {fileList.map((file) => (
                <li 
                  key={file.id}
                  className={`cursor-pointer hover:bg-gray-100 ${selectedFile?.id === file.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                  onClick={() => handleFileSelect(file)}
                >
                  <div className="flex items-center p-3">
                    {getFileIcon(file.type)}
                    <span className="ml-2">{file.name}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Area contenuto file */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Barra degli strumenti */}
          <div className="bg-gray-100 border-b border-gray-200 p-3 flex justify-between items-center">
            <div className="font-medium truncate">
              {selectedFile ? selectedFile.name : 'No file selected'}
            </div>
            
            {selectedFile && (
              <div className="flex items-center space-x-2">
                {isEditing ? (
                  <>
                    <button
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm flex items-center hover:bg-green-700 disabled:bg-gray-400"
                      onClick={handleSaveChanges}
                      disabled={isSaving || fileContent === originalContent}
                    >
                      {isSaving ? (
                        <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full mr-1"></div>
                      ) : (
                        <Check size={14} className="mr-1" />
                      )}
                      Save
                    </button>
                    <button
                      className="px-3 py-1 bg-gray-500 text-white rounded text-sm flex items-center hover:bg-gray-600 disabled:bg-gray-400"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      <X size={14} className="mr-1" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm flex items-center hover:bg-blue-700 disabled:bg-gray-400"
                      onClick={handleEditToggle}
                      disabled={isFileContentLoading}
                    >
                      <Edit2 size={14} className="mr-1" />
                      Edit
                    </button>
                    <button
                      className="px-3 py-1 bg-gray-600 text-white rounded text-sm flex items-center hover:bg-gray-700 disabled:bg-gray-400"
                      onClick={handleDownloadFile}
                      disabled={isFileContentLoading}
                    >
                      <Download size={14} className="mr-1" />
                      Download
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Contenuto file */}
          <div className="flex-1 overflow-auto bg-gray-50 p-4">
            {!selectedFile ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <FileCode size={48} className="mb-4" />
                <p>Select a file from the sidebar to view its content</p>
              </div>
            ) : isFileContentLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full mb-4"></div>
                <p>Loading file content...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-red-500">
                <p>{error}</p>
              </div>
            ) : isEditing ? (
              <textarea
                className="w-full h-full p-4 font-mono text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={fileContent}
                onChange={handleContentChange}
                spellCheck="false"
                disabled={isSaving}
              />
            ) : (
              <pre className="font-mono text-sm whitespace-pre-wrap bg-white border rounded p-4 h-full overflow-auto">
                {fileContent}
              </pre>
            )}
          </div>
          
          {/* Barra inferiore con info */}
          {selectedFile && !isFileContentLoading && !error && (
            <div className="bg-gray-100 border-t border-gray-200 px-3 py-2 text-xs text-gray-600 flex items-center">
              <Info size={14} className="mr-1" />
              {isEditing 
                ? `Editing mode. Changes are not saved until you click 'Save'.`
                : `Read-only mode. Click 'Edit' to make changes.`}
              {hasUnsavedChanges() && (
                <span className="ml-2 bg-yellow-200 px-1 rounded text-yellow-800">Unsaved changes</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export default TerraformViewer;