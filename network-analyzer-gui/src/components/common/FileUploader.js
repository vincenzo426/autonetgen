// src/components/common/FileUploader.js - VERSIONE MODIFICATA
import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import apiService from "../../services/apiService";

/**
 * Componente per l'upload di file direttamente su Cloud Storage
 *
 * @param {Object} props - Proprietà del componente
 * @param {Function} props.onFilesUploaded - Handler per l'upload dei file
 */
const FileUploader = ({ onFilesUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  // Gestione eventi drag
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // Gestione drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  // Gestione input file
  const handleFileInputChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);

    // Reset input file
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Elaborazione file con upload diretto su Cloud Storage
  const handleFiles = async (newFiles) => {
    setError(null);

    // Validazione tipi di file
    const validFileTypes = [".pcap", ".pcapng", ".csv", ".nflow", ".nfcapd"];
    const invalidFiles = newFiles.filter((file) => {
      const extension = "." + file.name.split(".").pop().toLowerCase();
      return !validFileTypes.includes(extension);
    });

    if (invalidFiles.length > 0) {
      setError(`Invalid file type(s): ${invalidFiles
        .map((f) => f.name)
        .join(", ")}. 
                Please upload only PCAP, CSV, or NetFlow files.`);
      return;
    }

    // Prepara i file con status di upload
    const filesWithStatus = newFiles.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      status: "preparing", // preparing, uploading, uploaded, error
      progress: 0,
      blob_name: null,
      error: null,
    }));

    // Aggiorna la lista dei file
    const updatedFiles = [...files, ...filesWithStatus];
    setFiles(updatedFiles);

    // Inizia l'upload per ogni file
    for (let i = files.length; i < updatedFiles.length; i++) {
      uploadFileToStorage(updatedFiles[i], i);
    }
  };

  // Upload di un singolo file su Cloud Storage
  const uploadFileToStorage = async (fileItem, index) => {
    try {
      // Aggiorna status a "preparing"
      updateFileStatus(index, { status: "preparing" });

      // 1. Ottieni signed URL dal backend
      const response = await apiService.getUploadUrl(fileItem.name);
      const { upload_url, blob_name } = response.upload_info;

      // Aggiorna status a "uploading"
      updateFileStatus(index, {
        status: "uploading",
        blob_name: blob_name,
      });

      // 2. Upload diretto su Cloud Storage
      const uploadResponse = await fetch(upload_url, {
        method: "PUT",
        body: fileItem.file,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // 3. Aggiorna status a "uploaded"
      updateFileStatus(index, {
        status: "uploaded",
        progress: 100,
      });

      // Notifica il componente parent
      notifyParentOfUpload();
    } catch (error) {
      console.error(`Error uploading ${fileItem.name}:`, error);
      updateFileStatus(index, {
        status: "error",
        error: error.message,
      });
    }
  };

  // Aggiorna lo status di un file
  const updateFileStatus = (index, updates) => {
    setFiles((prevFiles) => {
      const newFiles = [...prevFiles];
      newFiles[index] = { ...newFiles[index], ...updates };
      return newFiles;
    });
  };

  // Notifica al componente parent i file caricati con successo
  const notifyParentOfUpload = () => {
    const uploadedFiles = files.filter((f) => f.status === "uploaded");
    if (onFilesUploaded) {
      onFilesUploaded(uploadedFiles);
    }
  };

  // Rimozione file
  const removeFile = (index) => {
    const updatedFiles = [...files];
    updatedFiles.splice(index, 1);
    setFiles(updatedFiles);

    // Notifica componente parent
    notifyParentOfUpload();
  };

  // Riprova upload file fallito
  const retryUpload = (index) => {
    const fileItem = files[index];
    uploadFileToStorage(fileItem, index);
  };

  // Apertura dialog selezione file
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <DropZone
        isDragging={isDragging}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onBrowse={triggerFileInput}
      />

      {/* Input File nascosto */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
        multiple
        accept=".pcap,.pcapng,.csv,.nflow,.nfcapd"
      />

      {/* Messaggio errore */}
      {error && <ErrorMessage message={error} />}

      {/* Lista file con status di upload */}
      {files.length > 0 && (
        <FileListWithStatus
          files={files}
          onRemove={removeFile}
          onRetry={retryUpload}
        />
      )}
    </div>
  );
};

/**
 * Componente per l'area di drop dei file
 */
const DropZone = ({
  isDragging,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onBrowse,
}) => {
  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isDragging
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 hover:border-blue-400"
      }`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <Upload size={48} className="mx-auto mb-4 text-gray-400" />
      <p className="mb-4 text-gray-600">
        Drag and drop your network data files here, or
      </p>
      <button
        type="button"
        onClick={onBrowse}
        className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
      >
        Browse Files
      </button>
      <p className="mt-4 text-sm text-gray-500">
        Supported formats: PCAP, CSV, NetFlow
      </p>
      <p className="mt-2 text-xs text-blue-600">
        Files will be uploaded directly to secure cloud storage
      </p>
    </div>
  );
};

/**
 * Componente per mostrare un messaggio di errore
 */
const ErrorMessage = ({ message }) => {
  return (
    <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700 flex items-start">
      <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
      <p className="text-sm">{message}</p>
    </div>
  );
};

/**
 * Componente per la lista dei file con status di upload
 */
const FileListWithStatus = ({ files, onRemove, onRetry }) => {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium mb-3">Files</h3>
      <ul className="divide-y divide-gray-200 border rounded-md">
        {files.map((fileItem, index) => (
          <FileItemWithStatus
            key={index}
            fileItem={fileItem}
            index={index}
            onRemove={onRemove}
            onRetry={onRetry}
          />
        ))}
      </ul>
    </div>
  );
};

/**
 * Componente per il singolo elemento della lista file con status
 */
const FileItemWithStatus = ({ fileItem, index, onRemove, onRetry }) => {
  const getStatusIcon = () => {
    switch (fileItem.status) {
      case "preparing":
      case "uploading":
        return <Clock size={20} className="text-blue-500 animate-spin" />;
      case "uploaded":
        return <CheckCircle size={20} className="text-green-500" />;
      case "error":
        return <AlertCircle size={20} className="text-red-500" />;
      default:
        return <FileText size={20} className="text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (fileItem.status) {
      case "preparing":
        return "Preparing...";
      case "uploading":
        return "Uploading...";
      case "uploaded":
        return "Uploaded to cloud storage";
      case "error":
        return `Error: ${fileItem.error}`;
      default:
        return "Ready";
    }
  };

  return (
    <li className="p-3">
      <div className="flex justify-between items-start">
        <div className="flex items-start flex-1">
          {getStatusIcon()}
          <div className="ml-3 flex-1">
            <p className="font-medium truncate">{fileItem.name}</p>
            <p className="text-sm text-gray-500">
              {(fileItem.size / 1024).toFixed(2)} KB
            </p>
            <p
              className={`text-xs ${
                fileItem.status === "error"
                  ? "text-red-600"
                  : fileItem.status === "uploaded"
                  ? "text-green-600"
                  : "text-blue-600"
              }`}
            >
              {getStatusText()}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {fileItem.status === "error" && (
            <button
              type="button"
              onClick={() => onRetry(index)}
              className="text-blue-500 hover:text-blue-700 text-sm underline"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-red-500 hover:text-red-700 focus:outline-none"
            aria-label="Remove file"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </li>
  );
};

export default FileUploader;
