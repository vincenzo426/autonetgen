// src/components/tabs/UploadTab.js
import { Play } from "lucide-react";
import FileUploader from "../common/FileUploader";

/**
 * Componente per la scheda di upload dei file
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Array} props.uploadedFiles - Array di file caricati
 * @param {Function} props.onFilesUploaded - Handler per l'upload dei file
 * @param {Function} props.onContinue - Handler per continuare all'analisi
 */
const UploadTab = ({ uploadedFiles, onFilesUploaded, onContinue }) => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Upload Network Data</h2>
      <div className="bg-white p-8 rounded-lg shadow-md">
        <FileUploader onFilesUploaded={onFilesUploaded} />
      </div>
      
      {uploadedFiles.length > 0 && (
        <div className="mt-6 flex justify-end">
          <button 
            className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700"
            onClick={onContinue}
          >
            <Play size={18} className="mr-2" />
            Continue to Analysis
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadTab;