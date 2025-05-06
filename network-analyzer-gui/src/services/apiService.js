// src/services/apiService.js

const API_URL = 'http://localhost:8000/api';

/**
 * Servizio per comunicare con il backend API
 */
const apiService = {
  /**
   * Verifica lo stato del server
   * @returns {Promise<Object>} Stato del server
   */
  checkServerStatus: async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  /**
   * Avvia l'analisi di file di rete
   * @param {File[]} files - Array di oggetti File da analizzare
   * @param {Object} options - Opzioni di configurazione dell'analisi
   * @returns {Promise<Object>} Risultato dell'analisi
   */
  analyzeFiles: async (files, options) => {
    try {
      // Creazione del FormData per inviare i file
      const formData = new FormData();
      
      // Aggiungi i file
      files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });
      
      // Aggiungi le opzioni di configurazione
      if (options.type) formData.append('type', options.type);
      if (options.output_dir) formData.append('output_dir', options.output_dir);
      if (options.output_graph) formData.append('output_graph', options.output_graph);
      if (options.output_analysis) formData.append('output_analysis', options.output_analysis);
      if (options.output_terraform) formData.append('output_terraform', options.output_terraform);
      
      // Invia la richiesta al server
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  },

  /**
   * Scarica un file dal server
   * @param {string} fileType - Tipo di file da scaricare (graph, analysis, terraform)
   * @param {string} filePath - Percorso del file sul server
   * @returns {Promise<void>} Avvia il download del file
   */
  downloadFile: async (fileType, filePath) => {
    try {
      // Costruisci l'URL per il download
      const downloadUrl = `${API_URL}/download/${fileType}?path=${encodeURIComponent(filePath)}`;
      
      // Utilizza il metodo fetch in modalità 'no-cors' per ottenere il file
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        // Se la risposta è un JSON di errore
        if (response.headers.get('content-type')?.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      // Ottieni il blob del file
      const fileBlob = await response.blob();
      
      // Determina il nome del file
      let fileName;
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          fileName = filenameMatch[1];
        }
      }
      
      if (!fileName) {
        switch (fileType) {
          case 'graph':
            fileName = 'network_graph.pdf';
            break;
          case 'analysis':
            fileName = 'network_analysis.json';
            break;
          case 'terraform':
            fileName = 'terraform_config.zip';
            break;
          default:
            fileName = 'download';
        }
      }
      
      // Crea un URL per il download
      const url = window.URL.createObjectURL(fileBlob);
      
      // Crea un elemento <a> temporaneo per avviare il download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      
      // Aggiungi l'elemento al DOM, avvia il download e rimuovi l'elemento
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(`Download failed for ${fileType}:`, error);
      throw error;
    }
  },

  /**
   * Recupera la lista dei file Terraform generati
   * @param {string} terraformPath - Percorso della directory Terraform
   * @returns {Promise<Object>} Lista dei file Terraform
   */
  getTerraformFiles: async (terraformPath) => {
    try {
      const response = await fetch(`${API_URL}/terraform/files?path=${encodeURIComponent(terraformPath)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get Terraform files:', error);
      throw error;
    }
  },

  /**
   * Recupera il contenuto di un file Terraform
   * @param {string} terraformPath - Percorso della directory Terraform
   * @param {string} fileName - Nome del file
   * @returns {Promise<Object>} Contenuto del file
   */
  getTerraformFileContent: async (terraformPath, fileName) => {
    try {
      const encodedPath = encodeURIComponent(`${terraformPath}/${fileName}`);
      const response = await fetch(`${API_URL}/terraform/content?path=${encodedPath}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Failed to get content for file ${fileName}:`, error);
      throw error;
    }
  },

  /**
   * Salva le modifiche a un file Terraform
   * @param {string} terraformPath - Percorso della directory Terraform
   * @param {string} fileName - Nome del file
   * @param {string} content - Nuovo contenuto del file
   * @returns {Promise<Object>} Risultato dell'operazione
   */
  saveTerraformFile: async (terraformPath, fileName, content) => {
    try {
      const response = await fetch(`${API_URL}/terraform/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: `${terraformPath}/${fileName}`,
          content: content
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Failed to save file ${fileName}:`, error);
      throw error;
    }
  }
};

export default apiService;