from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from analysis_orchestrator import AnalysisOrchestrator

app = Flask(__name__)
CORS(app)  # Permette chiamate da frontend React

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.json
    
    input_file = data.get('input_file')
    file_type = data.get('type')
    output_dir = data.get('output_dir', 'output')
    output_graph = data.get('output_graph')
    output_analysis = data.get('output_analysis')
    output_terraform = data.get('output_terraform')
    
    if not input_file or not os.path.isfile(input_file):
        return jsonify({'error': 'Invalid or missing input_file'}), 400
    
    orchestrator = AnalysisOrchestrator()
    success = orchestrator.run(
        input_file=input_file,
        file_type=file_type,
        output_dir=output_dir,
        output_graph=output_graph,
        output_analysis=output_analysis,
        output_terraform=output_terraform
    )
    
    if not success:
        return jsonify({'status': 'error', 'message': 'Analysis failed'}), 500

    return jsonify({'status': 'success', 'message': 'Analysis completed'})

if __name__ == '__main__':
    app.run(debug=True)
