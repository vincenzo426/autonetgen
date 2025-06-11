// src/services/apiService.js

const API_URL =
  "https://autonetgen-backend-744895722272.europe-west1.run.app/api";

/**
 * Servizio per comunicare con il backend API
 * Aggiornato per supportare Google Cloud Storage con Signed URLs
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
   * Genera un session ID unico per l'upload
   * @returns {string} Session ID unico
   */
  generateSessionId: () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Ottiene signed URLs per l'upload di file su GCS
   * @param {File[]} files - Array di oggetti File da caricare
   * @param {string} sessionId - ID della sessione (opzionale, verrà generato se non fornito)
   * @returns {Promise<Object>} Signed URLs e informazioni della sessione
   */
  getSignedUrls: async (files, sessionId = null) => {
    try {
      if (!files || files.length === 0) {
        throw new Error("No files provided");
      }

      // Prepara le informazioni dei file
      const filesInfo = files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      }));

      const requestData = {
        files: filesInfo,
        session_id: sessionId || apiService.generateSessionId(),
      };

      console.log("Requesting signed URLs for:", requestData);

      const response = await fetch(`${API_URL}/upload/signed-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      const result = await response.json();
      console.log("Received signed URLs:", result);

      return result;
    } catch (error) {
      console.error("Failed to get signed URLs:", error);
      throw error;
    }
  },

  /**
   * Carica un file direttamente su GCS usando la signed URL
   * @param {File} file - File da caricare
   * @param {string} signedUrl - Signed URL per l'upload
   * @param {Function} onProgress - Callback per il progresso dell'upload (opzionale)
   * @returns {Promise<Object>} Risultato dell'upload
   */
  uploadFileToGCS: async (file, signedUrl, onProgress = null) => {
    try {
      console.log(`Uploading ${file.name} to GCS...`);

      // Crea la richiesta di upload
      const uploadPromise = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Gestione del progresso
        if (onProgress) {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const percentComplete = (event.loaded / event.total) * 100;
              onProgress(percentComplete);
            }
          });
        }

        // Gestione della risposta
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            resolve({
              success: true,
              status: xhr.status,
              message: `File ${file.name} uploaded successfully`,
            });
          } else {
            reject(
              new Error(
                `Upload failed with status ${xhr.status}: ${xhr.statusText}`
              )
            );
          }
        };

        xhr.onerror = () => {
          reject(new Error(`Network error during upload of ${file.name}`));
        };

        xhr.ontimeout = () => {
          reject(new Error(`Upload timeout for ${file.name}`));
        };

        // Configura la richiesta
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");

        // Timeout di 30 minuti per file grandi
        xhr.timeout = 30 * 60 * 1000;

        // Invia il file
        xhr.send(file);
      });

      const result = await uploadPromise;
      console.log(`Successfully uploaded ${file.name}`);
      return result;
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      throw error;
    }
  },

  /**
   * Carica múltipli file su GCS
   * @param {File[]} files - Array di file da caricare
   * @param {Array} signedUrlsData - Array di oggetti con signed URLs
   * @param {Function} onProgress - Callback per il progresso totale (opzionale)
   * @param {Function} onFileProgress - Callback per il progresso di ogni file (opzionale)
   * @returns {Promise<Object>} Risultato dell'upload di tutti i file
   */
  uploadFilesToGCS: async (
    files,
    signedUrlsData,
    onProgress = null,
    onFileProgress = null
  ) => {
    try {
      const uploadResults = [];
      const totalFiles = files.length;
      let completedFiles = 0;

      console.log(`Starting upload of ${totalFiles} files...`);

      // Carica ogni file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const urlData = signedUrlsData.find(
          (data) => data.filename === file.name
        );

        if (!urlData) {
          throw new Error(`No signed URL found for file: ${file.name}`);
        }

        try {
          // Callback per il progresso del singolo file
          const fileProgressCallback = onFileProgress
            ? (progress) => onFileProgress(file.name, progress)
            : null;

          const result = await apiService.uploadFileToGCS(
            file,
            urlData.signed_url,
            fileProgressCallback
          );

          uploadResults.push({
            filename: file.name,
            blob_name: urlData.blob_name,
            success: true,
            ...result,
          });

          completedFiles++;

          // Aggiorna il progresso totale
          if (onProgress) {
            onProgress((completedFiles / totalFiles) * 100);
          }
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          uploadResults.push({
            filename: file.name,
            blob_name: urlData.blob_name,
            success: false,
            error: error.message,
          });

          completedFiles++;

          // Aggiorna il progresso anche per i fallimenti
          if (onProgress) {
            onProgress((completedFiles / totalFiles) * 100);
          }
        }
      }

      // Verifica se almeno un file è stato caricato con successo
      const successfulUploads = uploadResults.filter(
        (result) => result.success
      );
      const failedUploads = uploadResults.filter((result) => !result.success);

      if (successfulUploads.length === 0) {
        throw new Error("All file uploads failed");
      }

      console.log(
        `Upload completed: ${successfulUploads.length} successful, ${failedUploads.length} failed`
      );

      return {
        success: true,
        results: uploadResults,
        successful_uploads: successfulUploads,
        failed_uploads: failedUploads,
        blob_names: successfulUploads.map((result) => result.blob_name),
      };
    } catch (error) {
      console.error("Bulk upload failed:", error);
      throw error;
    }
  },

  /**
   * Verifica che i file siano stati caricati correttamente su GCS
   * @param {string[]} blobNames - Array di nomi blob da verificare
   * @returns {Promise<Object>} Risultato della verifica
   */
  verifyUploads: async (blobNames) => {
    try {
      console.log("Verifying uploads:", blobNames);

      const response = await fetch(`${API_URL}/upload/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blob_names: blobNames,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      const result = await response.json();
      console.log("Verification results:", result);

      return result;
    } catch (error) {
      console.error("Upload verification failed:", error);
      throw error;
    }
  },

  /**
   * Processo completo di upload di file con gestione errori
   * @param {File[]} files - Array di file da caricare
   * @param {Function} onProgress - Callback per il progresso totale
   * @param {Function} onFileProgress - Callback per il progresso di ogni file
   * @returns {Promise<Object>} Risultato completo dell'upload
   */
  uploadFiles: async (files, onProgress = null, onFileProgress = null) => {
    try {
      console.log("Starting complete upload process...");

      // Step 1: Ottieni signed URLs
      const signedUrlsResponse = await apiService.getSignedUrls(files);

      if (signedUrlsResponse.status !== "success") {
        throw new Error("Failed to get signed URLs");
      }

      const { session_id, signed_urls, expires_in } = signedUrlsResponse;

      // Step 2: Carica i file su GCS
      const uploadResponse = await apiService.uploadFilesToGCS(
        files,
        signed_urls,
        onProgress,
        onFileProgress
      );

      if (!uploadResponse.success) {
        throw new Error("File upload failed");
      }

      // Step 3: Verifica che i file siano stati caricati
      const verificationResponse = await apiService.verifyUploads(
        uploadResponse.blob_names
      );

      if (verificationResponse.status !== "success") {
        throw new Error("Upload verification failed");
      }

      // Controlla che tutti i file siano presenti
      const verificationResults = verificationResponse.verification_results;
      const missingFiles = verificationResults.filter(
        (result) => !result.exists
      );

      if (missingFiles.length > 0) {
        console.warn("Some files are missing after upload:", missingFiles);

        // Se alcuni file mancano, prova a ripulire la sessione
        try {
          await apiService.cleanupSession(session_id);
        } catch (cleanupError) {
          console.warn(
            "Failed to cleanup session after missing files:",
            cleanupError
          );
        }

        throw new Error(
          `Upload verification failed: ${missingFiles.length} files not found on server`
        );
      }

      console.log("Complete upload process successful");

      return {
        success: true,
        session_id,
        blob_names: uploadResponse.blob_names,
        upload_results: uploadResponse.results,
        verification_results: verificationResults,
      };
    } catch (error) {
      console.error("Complete upload process failed:", error);
      throw error;
    }
  },

  /**
   * Avvia l'analisi di file di rete da GCS
   * @param {string[]} blobNames - Array di nomi blob su GCS da analizzare
   * @param {Object} options - Opzioni di configurazione dell'analisi
   * @param {string} sessionId - ID della sessione
   * @returns {Promise<Object>} Risultato dell'analisi
   */
  analyzeFiles: async (blobNames, options, sessionId) => {
    try {
      console.log("Starting analysis of files:", blobNames);

      const requestData = {
        blob_names: blobNames,
        session_id: sessionId,
        type: options.type || "auto",
        output_dir: options.output_dir || "output",
        output_graph: options.output_graph,
        output_analysis: options.output_analysis,
        output_terraform: options.output_terraform,
      };

      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      const result = await response.json();
      console.log("Analysis completed:", result);

      return result;
    } catch (error) {
      console.error("Analysis failed:", error);
      throw error;
    }
  },

  /**
   * Pulisce i file di una sessione
   * @param {string} sessionId - ID della sessione da pulire
   * @returns {Promise<Object>} Risultato della pulizia
   */
  cleanupSession: async (sessionId) => {
    try {
      console.log("Cleaning up session:", sessionId);

      const response = await fetch(`${API_URL}/cleanup/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! Status: ${response.status}`
        );
      }

      const result = await response.json();
      console.log("Session cleanup completed:", result);

      return result;
    } catch (error) {
      console.error("Session cleanup failed:", error);
      throw error;
    }
  },

  /**
   * Processo completo: upload e analisi di file
   * @param {File[]} files - Array di file da processare
   * @param {Object} analysisOptions - Opzioni per l'analisi
   * @param {Function} onUploadProgress - Callback per il progresso dell'upload
   * @param {Function} onFileProgress - Callback per il progresso di ogni file
   * @returns {Promise<Object>} Risultato completo del processo
   */
  uploadAndAnalyzeFiles: async (
    files,
    analysisOptions,
    onUploadProgress = null,
    onFileProgress = null
  ) => {
    let sessionId = null;

    try {
      console.log("Starting complete upload and analysis process...");

      // Step 1: Upload dei file
      const uploadResult = await apiService.uploadFiles(
        files,
        onUploadProgress,
        onFileProgress
      );
      sessionId = uploadResult.session_id;

      console.log("Upload completed, starting analysis...");

      // Step 2: Analisi dei file
      const analysisResult = await apiService.analyzeFiles(
        uploadResult.blob_names,
        analysisOptions,
        sessionId
      );

      console.log("Complete process successful");

      return {
        success: true,
        upload_result: uploadResult,
        analysis_result: analysisResult,
        session_id: sessionId,
      };
    } catch (error) {
      console.error("Complete process failed:", error);

      // In caso di errore, prova a pulire la sessione
      if (sessionId) {
        try {
          await apiService.cleanupSession(sessionId);
          console.log("Session cleaned up after error");
        } catch (cleanupError) {
          console.warn("Failed to cleanup session after error:", cleanupError);
        }
      }

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
};

export default apiService;
