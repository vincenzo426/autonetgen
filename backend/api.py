from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
from analysis_orchestrator import AnalysisOrchestrator

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

@app.route('/api/analyze', methods=['POST'])
def analyze():
    uploaded_file = request.files.get('file')
    file_type = request.form.get('type')  # Optional
    print(request)
    if not uploaded_file:
        return jsonify({'error': 'No file uploaded'}), 400

    filename = secure_filename(uploaded_file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    uploaded_file.save(file_path)

    # Now run your analysis
    orchestrator = AnalysisOrchestrator()
    success = orchestrator.run(
        input_file=file_path,
        file_type=file_type,
        output_dir='output',
        output_graph='output/graph.png',
        output_analysis='output/analysis.json',
        output_terraform='output/terraform'
    )

    if not success:
        return jsonify({'status': 'error', 'message': 'Analysis failed'}), 500

    return jsonify({'status': 'success', 'message': 'Analysis completed'})

if __name__ == '__main__':
    app.run(port=8000, debug=True)