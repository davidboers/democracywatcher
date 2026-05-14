import os
from datetime import datetime

from flask import Flask, jsonify
from flask_cors import CORS

date_file_format = '%d-%m-%y-%H-%M.json'

def list_timestamps():
    for f in os.listdir('data/'):
        dt = datetime.strptime(f, date_file_format)
        yield dt

app = Flask(__name__)
CORS(app)

@app.route('/results-timestamps')
def results_timestamps():
    timestamps = list(list_timestamps())
    result = [{ 'file': datetime.strftime(ts, date_file_format), 'timestamp': ts.isoformat() } for ts in timestamps]
    return jsonify(result)

if __name__ == '__main__':
    app.run()