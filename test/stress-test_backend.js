import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

// Lo script principale e le metriche rimangono gli stessi...
const signedUrlDuration = new Trend('signed_url_duration');
const uploadToGcsDuration = new Trend('upload_to_gcs_duration');
const verifyUploadDuration = new Trend('verify_upload_duration');
const analyzeDuration = new Trend('analyze_duration');

let pcapData;
try {
  pcapData = open('./data/vethd9e14c0-normal-10.pcap', 'b');
} catch (e) {
  fail('Impossibile aprire il file sample.pcap.');
}

// --- OPZIONI PER LO STRESS TEST ---
export const options = {
  // Lo stress test aumenta il carico fino a un punto di rottura.
  // Iniziamo con un numero molto alto di utenti virtuali (VU).
  stages: [
    { duration: '2m', target: 100 }, // Rampa fino a 100 utenti in 2 minuti
    { duration: '3m', target: 100 }, // Mantiene il carico per 3 minuti per vedere se regge
    { duration: '1m', target: 200 }, // Raddoppia il carico in 1 minuto per trovare il limite
    { duration: '3m', target: 200 }, // Mantiene il carico massimo per 3 minuti
    { duration: '1m', target: 0 },   // Rampa verso il basso
  ],
  thresholds: {
    // Durante uno stress test, ci aspettiamo degli errori.
    // Impostiamo una soglia di errore più tollerante (es. < 10%).
    'http_req_failed': ['rate<0.1'],
  },
};

const API_BASE_URL = __ENV.API_URL || 'http://34.13.75.10';
const PCAP_FILENAME = 'vethd9e14c0-normal-10.pcap';

// La funzione default() rimane identica allo script upload-analyze.js
export default function () {
    // 1. Get Signed URL
    const signedUrlPayload = JSON.stringify({
        files: [{ name: PCAP_FILENAME, size: pcapData.length }],
        session_id: `k6-stress-session-${__VU}-${__ITER}`,
    });
    const signedUrlRes = http.post(`${API_BASE_URL}/api/upload/signed-url`, signedUrlPayload, { headers: { 'Content-Type': 'application/json' } });
    signedUrlDuration.add(signedUrlRes.timings.duration);
    check(signedUrlRes, { 'step1: signed URL OK': (r) => r.status === 200 });
    if (signedUrlRes.status !== 200) return;

    const signedUrlData = signedUrlRes.json();
    const uploadUrl = signedUrlData.signed_urls[0].signed_url;
    const blobName = signedUrlData.signed_urls[0].blob_name;
    const sessionId = signedUrlData.session_id;

    // 2. Upload to GCS
    const uploadRes = http.put(uploadUrl, pcapData, { headers: { 'Content-Type': 'application/octet-stream' } });
    uploadToGcsDuration.add(uploadRes.timings.duration);
    check(uploadRes, { 'step2: upload to GCS OK': (r) => r.status === 200 });
    if (uploadRes.status !== 200) return;

    // 3. Verify
    const verifyPayload = JSON.stringify({ blob_names: [blobName] });
    const verifyRes = http.post(`${API_BASE_URL}/api/upload/verify`, verifyPayload, { headers: { 'Content-Type': 'application/json' } });
    verifyUploadDuration.add(verifyRes.timings.duration);
    check(verifyRes, { 'step3: verify upload OK': (r) => r.status === 200 });

    // 4. Analyze
    const analyzePayload = JSON.stringify({
        blob_names: [blobName],
        session_id: sessionId,
        type: 'auto',
    });
    const analyzeRes = http.post(`${API_BASE_URL}/api/analyze`, analyzePayload, { headers: { 'Content-Type': 'application/json' } });
    analyzeDuration.add(analyzeRes.timings.duration);
    check(analyzeRes, { 'step4: analyze request OK': (r) => r.status === 200 });
}
