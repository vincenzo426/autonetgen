// src/services/apiService.js

const API_URL = "http://localhost:8000/api";

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
      console.error("Health check failed:", error);
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
      if (options.type) formData.append("type", options.type);
      if (options.output_dir) formData.append("output_dir", options.output_dir);
      if (options.output_graph)
        formData.append("output_graph", options.output_graph);
      if (options.output_analysis)
        formData.append("output_analysis", options.output_analysis);
      if (options.output_terraform)
        formData.append("output_terraform", options.output_terraform);

      // Invia la richiesta al server
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Analysis failed:", error);
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
      const downloadUrl = `${API_URL}/download/${fileType}?path=${encodeURIComponent(
        filePath
      )}`;

      // Utilizza il metodo fetch in modalità 'no-cors' per ottenere il file
      const response = await fetch(downloadUrl);

      if (!response.ok) {
        // Se la risposta è un JSON di errore
        if (
          response.headers.get("content-type")?.includes("application/json")
        ) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! Status: ${response.status}`
          );
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Ottieni il blob del file
      const fileBlob = await response.blob();

      // Determina il nome del file
      let fileName;
      const contentDisposition = response.headers.get("content-disposition");
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          fileName = filenameMatch[1];
        }
      }

      if (!fileName) {
        switch (fileType) {
          case "graph":
            fileName = "network_graph.pdf";
            break;
          case "analysis":
            fileName = "network_analysis.json";
            break;
          case "terraform":
            fileName = "terraform_config.zip";
            break;
          default:
            fileName = "download";
        }
      }

      // Crea un URL per il download
      const url = window.URL.createObjectURL(fileBlob);

      // Crea un elemento <a> temporaneo per avviare il download
      const a = document.createElement("a");
      a.style.display = "none";
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
      const response = await fetch(
        `${API_URL}/terraform/files?path=${encodeURIComponent(terraformPath)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get Terraform files:", error);
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
      const response = await fetch(
        `${API_URL}/terraform/content?path=${encodedPath}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: `${terraformPath}/${fileName}`,
          content: content,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to save file ${fileName}:`, error);
      throw error;
    }
  },

  /**
   * Inizializza Terraform nella directory specificata
   * @param {string} terraformPath - Percorso della directory Terraform
   * @returns {Promise<Object>} Risultato dell'operazione
   */
  initTerraform: async (terraformPath) => {
    try {
      const response = await fetch(`${API_URL}/terraform/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ terraformPath }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Terraform init failed:", error);
      throw error;
    }
  },

  /**
   * Valida la configurazione Terraform
   * @param {string} terraformPath - Percorso della directory Terraform
   * @returns {Promise<Object>} Risultato della validazione
   */
  validateTerraform: async (terraformPath) => {
    try {
      const response = await fetch(`${API_URL}/terraform/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ terraformPath }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Terraform validate failed:", error);
      throw error;
    }
  },

  /**
   * Esegue terraform plan
   * @param {string} terraformPath - Percorso della directory Terraform
   * @returns {Promise<Object>} Risultato del plan
   */
  planTerraform: async (terraformPath) => {
    try {
      const response = await fetch(`${API_URL}/terraform/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ terraformPath }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Terraform plan failed:", error);
      throw error;
    }
  },

  /**
   * Esegue terraform apply
   * @param {string} terraformPath - Percorso della directory Terraform
   * @param {string} planFile - File del piano Terraform (opzionale)
   * @param {boolean} autoApprove - Se approvare automaticamente il piano
   * @returns {Promise<Object>} Risultato dell'operazione apply
   */
  applyTerraform: async (
    terraformPath,
    planFile = null,
    autoApprove = false
  ) => {
    try {
      const response = await fetch(`${API_URL}/terraform/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          terraformPath,
          planFile,
          autoApprove,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Terraform apply failed:", error);
      throw error;
    }
  },

  /**
   * Esegue terraform destroy
   * @param {string} terraformPath - Percorso della directory Terraform
   * @param {boolean} autoApprove - Se approvare automaticamente la distruzione
   * @returns {Promise<Object>} Risultato dell'operazione destroy
   */
  destroyTerraform: async (terraformPath, autoApprove = false) => {
    try {
      const response = await fetch(`${API_URL}/terraform/destroy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          terraformPath,
          autoApprove,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Terraform destroy failed:", error);
      throw error;
    }
  },

  /**
   * Verifica lo stato attuale dell'infrastruttura Terraform
   * @param {string} terraformPath - Percorso della directory Terraform
   * @returns {Promise<Object>} Stato dell'infrastruttura
   */
  getTerraformStatus: async (terraformPath) => {
    try {
      const response = await fetch(
        `${API_URL}/terraform/status?terraformPath=${encodeURIComponent(
          terraformPath
        )}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get Terraform status:", error);
      throw error;
    }
  },

  // Estensioni da aggiungere al file src/services/apiService.js
  // Aggiungi queste funzioni nell'oggetto apiService, prima della chiusura

  /**
   * Ottiene la mappatura dell'infrastruttura deployata
   * @param {string} terraformPath - Percorso della directory Terraform
   * @returns {Promise<Object>} Informazioni sull'infrastruttura
   */
  getInfrastructureMapping: async (terraformPath) => {
    try {
      const response = await fetch(
        `${API_URL}/traffic/infrastructure/mapping`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ terraform_path: terraformPath }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get infrastructure mapping:", error);
      throw error;
    }
  },

  /**
   * Avvia un test di traffico
   * @param {Object} testData - Dati del test di traffico
   * @param {string} testData.test_type - Tipo di test ('custom'|'generated'|'load_test')
   * @param {Array} testData.patterns - Pattern di traffico (per test custom)
   * @param {Object} testData.network_data - Dati di analisi (per test generated)
   * @param {Object} testData.infrastructure_mapping - Mappatura IP (per test generated/load_test)
   * @param {Object} testData.host_roles - Ruoli host (per test generated/load_test)
   * @param {Object} testData.test_config - Configurazione test
   * @returns {Promise<Object>} Risultato dell'avvio del test
   */
  startTrafficTest: async (testData) => {
    try {
      const response = await fetch(`${API_URL}/traffic/test/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to start traffic test:", error);
      throw error;
    }
  },

  /**
   * Ferma un test di traffico attivo
   * @param {string} testId - ID del test da fermare
   * @returns {Promise<Object>} Risultato dell'operazione
   */
  stopTrafficTest: async (testId) => {
    try {
      const response = await fetch(`${API_URL}/traffic/test/stop/${testId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to stop traffic test ${testId}:`, error);
      throw error;
    }
  },

  /**
   * Ottiene lo stato di un test di traffico specifico
   * @param {string} testId - ID del test
   * @returns {Promise<Object>} Stato del test
   */
  getTestStatus: async (testId) => {
    try {
      const response = await fetch(`${API_URL}/traffic/test/status/${testId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to get test status for ${testId}:`, error);
      throw error;
    }
  },

  /**
   * Ottiene lo stato di tutti i test di traffico
   * @returns {Promise<Object>} Stato di tutti i test
   */
  getAllTestsStatus: async () => {
    try {
      const response = await fetch(`${API_URL}/traffic/test/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get all tests status:", error);
      throw error;
    }
  },

  /**
   * Genera pattern di traffico automaticamente basati sui dati di analisi
   * @param {Object} analysisData - Dati dell'analisi di rete
   * @param {Object} analysisData.network_data - Dati di rete analizzati
   * @param {Object} analysisData.host_roles - Ruoli degli host
   * @param {Object} analysisData.infrastructure_mapping - Mappatura IP originali -> GCP
   * @param {Object} analysisData.test_config - Configurazione del test
   * @param {number} analysisData.test_config.duration - Durata in secondi
   * @param {number} analysisData.test_config.base_rps - RPS base
   * @param {boolean} analysisData.test_config.include_stress_tests - Include stress test
   * @returns {Promise<Object>} Pattern di traffico generati
   */
  generateTrafficPatterns: async (analysisData) => {
    try {
      const response = await fetch(`${API_URL}/traffic/patterns/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(analysisData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to generate traffic patterns:", error);
      throw error;
    }
  },

  /**
   * Ottiene i template di test predefiniti
   * @returns {Promise<Object>} Template di test disponibili
   */
  getTestTemplates: async () => {
    try {
      const response = await fetch(`${API_URL}/traffic/test/templates`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get test templates:", error);
      throw error;
    }
  },

  /**
   * Ottiene le metriche dettagliate di un test completato
   * @param {string} testId - ID del test
   * @returns {Promise<Object>} Metriche dettagliate del test
   */
  getTestMetrics: async (testId) => {
    try {
      const response = await fetch(
        `${API_URL}/traffic/test/metrics/${testId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to get test metrics for ${testId}:`, error);
      throw error;
    }
  },

  /**
   * Valida la connettività dell'infrastruttura prima di avviare test
   * @param {Object} infrastructureMapping - Mappatura dell'infrastruttura
   * @returns {Promise<Object>} Risultato della validazione
   */
  validateInfrastructureConnectivity: async (infrastructureMapping) => {
    try {
      const response = await fetch(
        `${API_URL}/traffic/infrastructure/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            infrastructure_mapping: infrastructureMapping,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to validate infrastructure connectivity:", error);
      throw error;
    }
  },

  /**
   * Ottiene statistiche aggregate di tutti i test eseguiti
   * @param {string} timeRange - Range temporale ('1h'|'24h'|'7d'|'30d')
   * @returns {Promise<Object>} Statistiche aggregate
   */
  getTrafficTestStatistics: async (timeRange = "24h") => {
    try {
      const response = await fetch(
        `${API_URL}/traffic/test/statistics?range=${timeRange}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get traffic test statistics:", error);
      throw error;
    }
  },

  /**
   * Esporta i risultati di un test in formato CSV/JSON
   * @param {string} testId - ID del test
   * @param {string} format - Formato di export ('csv'|'json'|'pdf')
   * @returns {Promise<Blob>} File esportato
   */
  exportTestResults: async (testId, format = "json") => {
    try {
      const response = await fetch(
        `${API_URL}/traffic/test/export/${testId}?format=${format}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.blob();
    } catch (error) {
      console.error(`Failed to export test results for ${testId}:`, error);
      throw error;
    }
  },

  /**
   * Crea un test di traffico schedulato
   * @param {Object} scheduleData - Dati per lo scheduling
   * @param {Object} scheduleData.test_config - Configurazione del test
   * @param {string} scheduleData.schedule - Cron expression per lo schedule
   * @param {string} scheduleData.name - Nome del test schedulato
   * @returns {Promise<Object>} Risultato della creazione
   */
  createScheduledTest: async (scheduleData) => {
    try {
      const response = await fetch(`${API_URL}/traffic/test/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to create scheduled test:", error);
      throw error;
    }
  },

  /**
   * Ottiene la lista dei test schedulati
   * @returns {Promise<Object>} Lista dei test schedulati
   */
  getScheduledTests: async () => {
    try {
      const response = await fetch(`${API_URL}/traffic/test/schedule`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get scheduled tests:", error);
      throw error;
    }
  },

  /**
   * Cancella un test schedulato
   * @param {string} scheduleId - ID del test schedulato
   * @returns {Promise<Object>} Risultato della cancellazione
   */
  deleteScheduledTest: async (scheduleId) => {
    try {
      const response = await fetch(
        `${API_URL}/traffic/test/schedule/${scheduleId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to delete scheduled test ${scheduleId}:`, error);
      throw error;
    }
  },

  // Aggiungi questi metodi al file network-analyzer-gui/src/services/apiService.js

  /**
   * Esporta i risultati dell'analisi in formato CSV
   * @param {Object} analysisResults - Risultati dell'analisi da esportare
   * @param {string} exportType - Tipo di esportazione (all, normalized, ml_features, replay)
   * @param {string} outputDir - Directory di output personalizzata (opzionale)
   * @returns {Promise<Object>} Risultato dell'esportazione
   */
  exportToCSV: async (
    analysisResults,
    exportType = "all",
    outputDir = null
  ) => {
    try {
      const response = await fetch(`${API_URL}/export/csv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysis_results: analysisResults,
          export_type: exportType,
          output_dir: outputDir || `output/csv_export_${Date.now()}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("CSV export failed:", error);
      throw error;
    }
  },

  /**
   * Scarica un file CSV specifico dall'esportazione
   * @param {string} fileType - Tipo di file (normalized, ml_features, replay, metadata)
   * @param {string} exportDir - Directory di esportazione
   * @returns {Promise<void>} Avvia il download del file
   */
  downloadCSVFile: async (fileType, exportDir) => {
    try {
      const downloadUrl = `${API_URL}/export/csv/download/${fileType}?export_dir=${encodeURIComponent(
        exportDir
      )}`;

      const response = await fetch(downloadUrl);

      if (!response.ok) {
        if (
          response.headers.get("content-type")?.includes("application/json")
        ) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! Status: ${response.status}`
          );
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Ottieni il blob del file
      const fileBlob = await response.blob();

      // Determina il nome del file
      let fileName;
      const contentDisposition = response.headers.get("content-disposition");
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          fileName = filenameMatch[1];
        }
      }

      if (!fileName) {
        const fileExtensions = {
          normalized: "network_data_normalized.csv",
          ml_features: "ml_features.csv",
          replay: "replay_dataset.csv",
          metadata: "dataset_metadata.json",
        };
        fileName = fileExtensions[fileType] || `${fileType}_export.csv`;
      }

      // Crea un URL per il download
      const url = window.URL.createObjectURL(fileBlob);

      // Crea un elemento <a> temporaneo per avviare il download
      const a = document.createElement("a");
      a.style.display = "none";
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
   * Scarica il package completo di tutti i file CSV come ZIP
   * @param {string} exportDir - Directory di esportazione (opzionale)
   * @returns {Promise<void>} Avvia il download del package
   */
  downloadCSVPackage: async (exportDir = null) => {
    try {
      let downloadUrl = `${API_URL}/export/csv/package`;
      if (exportDir) {
        downloadUrl += `?export_dir=${encodeURIComponent(exportDir)}`;
      }

      const response = await fetch(downloadUrl);

      if (!response.ok) {
        if (
          response.headers.get("content-type")?.includes("application/json")
        ) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! Status: ${response.status}`
          );
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Ottieni il blob del file
      const fileBlob = await response.blob();

      // Crea un URL per il download
      const url = window.URL.createObjectURL(fileBlob);

      // Crea un elemento <a> temporaneo per avviare il download
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = "network_dataset_export.zip";

      // Aggiungi l'elemento al DOM, avvia il download e rimuovi l'elemento
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Package download failed:", error);
      throw error;
    }
  },

  /**
   * Ottieni informazioni sui formati di esportazione CSV disponibili
   * @returns {Promise<Object>} Informazioni sui formati disponibili
   */
  getCSVExportFormats: async () => {
    try {
      const response = await fetch(`${API_URL}/export/csv/formats`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get CSV export formats:", error);
      throw error;
    }
  },

  /**
   * Valida i risultati dell'analisi prima dell'esportazione CSV
   * @param {Object} analysisResults - Risultati dell'analisi da validare
   * @returns {Object} Risultato della validazione
   */
  validateAnalysisForCSV: (analysisResults) => {
    const validation = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: [],
    };

    // Verifica presenza di dati essenziali
    if (!analysisResults) {
      validation.isValid = false;
      validation.errors.push("Analysis results are missing");
      return validation;
    }

    // Verifica hosts
    if (
      !analysisResults.hosts_list ||
      analysisResults.hosts_list.length === 0
    ) {
      validation.isValid = false;
      validation.errors.push("No hosts found in analysis results");
    } else if (analysisResults.hosts_list.length < 2) {
      validation.warnings.push(
        "Very few hosts detected - CSV export may be limited"
      );
    }

    // Verifica connessioni
    if (
      !analysisResults.connections_details ||
      Object.keys(analysisResults.connections_details).length === 0
    ) {
      validation.warnings.push(
        "No connection details found - normalized CSV will have limited data"
      );
    }

    // Verifica ruoli degli host
    if (
      !analysisResults.roles ||
      Object.keys(analysisResults.roles).length === 0
    ) {
      validation.warnings.push(
        "No host roles identified - ML features may be less accurate"
      );
    } else {
      const unknownRoles = Object.values(analysisResults.roles).filter(
        (role) => role === "UNKNOWN"
      ).length;
      const totalRoles = Object.keys(analysisResults.roles).length;
      if (unknownRoles / totalRoles > 0.5) {
        validation.warnings.push(
          "Many hosts have unknown roles - consider running deeper analysis"
        );
      }
    }

    // Verifica protocolli
    if (!analysisResults.protocols || analysisResults.protocols.length === 0) {
      validation.warnings.push("No protocol information found");
    }

    // Verifica subnet
    if (!analysisResults.subnets || analysisResults.subnets.length === 0) {
      validation.warnings.push(
        "No subnet information found - network topology analysis will be limited"
      );
    }

    // Raccomandazioni basate sui dati
    if (analysisResults.hosts > 100) {
      validation.recommendations.push(
        "Large network detected - consider using replay dataset for performance"
      );
    }

    if (analysisResults.connections > 1000) {
      validation.recommendations.push(
        "High connection count - ML features export recommended for pattern analysis"
      );
    }

    return validation;
  },
};

export default apiService;
