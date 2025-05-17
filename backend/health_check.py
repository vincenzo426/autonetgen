#!/usr/bin/env python3
"""
Script semplice per health check
"""

from flask import Flask

app = Flask(__name__)

@app.route('/health')
def health_check():
    """Endpoint di health check semplice"""
    return "OK", 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)