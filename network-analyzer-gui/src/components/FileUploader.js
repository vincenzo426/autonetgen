// src/components/FileUploader.js
import { useState, useRef } from "react";
import { Upload, FileText, Trash2, AlertCircle } from "lucide-react";

const FileUploader = ({ onFilesUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Handle drag events
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

  // Handle drop event
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Process files
  const handleFiles = (newFiles) => {
    setError(null);
    
    // Validate file types
    const validFileTypes = ['.pcap', '.pcapng', '.csv', '.nflow', '.nfcapd'];
    const invalidFiles = newFiles.filter(file => {
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      return !validFileTypes.includes(extension);
    });
    
    if (invalidFiles.length > 0) {
      setError(`Invalid file type(s): ${invalidFiles.map(f => f.name).join(', ')}. 
                Please upload only PCAP, CSV, or NetFlow files.`);
      return;
    }
    
    // Add new files
    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    
    // Notify parent component
    if (onFilesUploaded) {
      onFilesUploaded(updatedFiles);
    }
  };

  // Remove file
  const removeFile = (index) => {
    const updatedFiles = [...files];
    updatedFiles.splice(index, 1);
    setFiles(updatedFiles);
    
    // Notify parent component
    if (onFilesUploaded) {
      onFilesUploaded(updatedFiles);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-blue-400'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Upload size={48} className="mx-auto mb-4 text-gray-400" />
        <p className="mb-4 text-gray-600">
          Drag and drop your network data files here, or
        </p>
        <button
          type="button"
          onClick={triggerFileInput}
          className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          Browse Files
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          className="hidden"
          multiple
          accept=".pcap,.pcapng,.csv,.nflow,.nfcapd"
        />
        <p className="mt-4 text-sm text-gray-500">
          Supported formats: PCAP, CSV, NetFlow
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700 flex items-start">
          <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Uploaded Files</h3>
          <ul className="divide-y divide-gray-200 border rounded-md">
            {files.map((file, index) => (
              <li key={index} className="p-3 flex justify-between items-center">
                <div className="flex items-center">
                  <FileText size={20} className="text-gray-500 mr-3" />
                  <div>
                    <p className="font-medium truncate max-w-xs">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-700 focus:outline-none"
                  aria-label="Remove file"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUploader;