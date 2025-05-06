// src/components/tabs/AnalyzeTab.js
import { Play, Loader2 } from "lucide-react";

/**
 * Componente per la scheda di configurazione dell'analisi
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.config - Configurazione attuale dell'analisi
 * @param {Function} props.onConfigChange - Handler per modificare la configurazione
 * @param {Function} props.onStartAnalysis - Handler per avviare l'analisi
 * @param {boolean} props.isAnalyzing - Indica se l'analisi è in corso
 */
const AnalyzeTab = ({ config, onConfigChange, onStartAnalysis, isAnalyzing }) => {
  // Handler per modificare il tipo di parser
  const handleParserChange = (e) => {
    onConfigChange({ parserType: e.target.value });
  };

  // Handler per modificare i formati di output
  const handleOutputFormatChange = (format) => {
    onConfigChange({
      outputFormats: {
        ...config.outputFormats,
        [format]: !config.outputFormats[format]
      }
    });
  };

  // Handler per modificare i percorsi di output
  const handleOutputPathChange = (path, value) => {
    onConfigChange({
      outputPaths: {
        ...config.outputPaths,
        [path]: value
      }
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Configure Analysis</h2>
      
      {/* Configurazione del parser */}
      <ConfigSection title="Parser Selection">
        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium">Select Parser Type</label>
          <select 
            className="w-full p-2 border border-gray-300 rounded"
            value={config.parserType}
            onChange={handleParserChange}
          >
            <option value="auto">Auto-detect (recommended)</option>
            <option value="pcap">PCAP Parser</option>
            <option value="csv">CSV Parser</option>
            <option value="netflow">NetFlow Parser</option>
          </select>
          <p className="mt-2 text-sm text-gray-500">
            Auto-detect will determine the parser based on file extension
          </p>
        </div>
      </ConfigSection>

      {/* Configurazione dei formati di output */}
      <ConfigSection title="Output Generation">
        <div className="mb-4">
          <OutputFormatOption 
            label="Graphviz Network Visualization"
            checked={config.outputFormats.graphviz}
            onChange={() => handleOutputFormatChange('graphviz')}
          />
          <OutputFormatOption 
            label="Terraform Configuration"
            checked={config.outputFormats.terraform}
            onChange={() => handleOutputFormatChange('terraform')}
          />
          <OutputFormatOption 
            label="JSON Export"
            checked={config.outputFormats.json}
            onChange={() => handleOutputFormatChange('json')}
          />
        </div>
        
        <h3 className="text-lg font-semibold mb-4 mt-8">Output Paths</h3>
        <div className="space-y-3">
          <OutputPathInput 
            label="Output Directory"
            value={config.outputPaths.output_dir}
            onChange={(e) => handleOutputPathChange('output_dir', e.target.value)}
          />
          
          {config.outputFormats.graphviz && (
            <OutputPathInput 
              label="Graph Output Path"
              value={config.outputPaths.output_graph}
              onChange={(e) => handleOutputPathChange('output_graph', e.target.value)}
            />
          )}
          
          {config.outputFormats.json && (
            <OutputPathInput 
              label="JSON Analysis Path"
              value={config.outputPaths.output_analysis}
              onChange={(e) => handleOutputPathChange('output_analysis', e.target.value)}
            />
          )}
          
          {config.outputFormats.terraform && (
            <OutputPathInput 
              label="Terraform Files Path"
              value={config.outputPaths.output_terraform}
              onChange={(e) => handleOutputPathChange('output_terraform', e.target.value)}
            />
          )}
        </div>
      </ConfigSection>

      {/* Pulsante per avviare l'analisi */}
      <div className="flex justify-end">
        <button 
          className="bg-blue-600 text-white py-2 px-6 rounded flex items-center hover:bg-blue-700 disabled:bg-gray-400"
          onClick={onStartAnalysis}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="animate-spin mr-2" size={20} />
              Analyzing...
            </>
          ) : (
            <>
              <Play size={20} className="mr-2" />
              Start Analysis
            </>
          )}
        </button>
      </div>
    </div>
  );
};

/**
 * Componente per una sezione di configurazione
 */
const ConfigSection = ({ title, children }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
};

/**
 * Componente per un'opzione di formato di output
 */
const OutputFormatOption = ({ label, checked, onChange }) => {
  return (
    <label className="flex items-center mb-3">
      <input 
        type="checkbox" 
        checked={checked}
        onChange={onChange}
        className="mr-2"
      />
      <span>{label}</span>
    </label>
  );
};

/**
 * Componente per un campo di input del percorso di output
 */
const OutputPathInput = ({ label, value, onChange }) => {
  return (
    <div>
      <label className="block mb-1 text-sm font-medium">{label}</label>
      <input 
        type="text" 
        value={value}
        onChange={onChange}
        className="w-full p-2 border border-gray-300 rounded"
      />
    </div>
  );
};

export default AnalyzeTab;