import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Trend } from 'k6/metrics';

// Metriche personalizzate
const apiResponseTrend = new Trend('api_response_time');

// Carica il file di dati di test
let pcapData;
try {
  pcapData = open('./data/vethd9e14c0-normal-10.pcap', 'b');
} catch (e) {
  fail('Impossibile aprire il file sample.pcap. Assicurati che esista nella cartella "data".');
}

// --- OPZIONI PER LO SPIKE TEST ---
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Carico di base normale (20 utenti)
    { duration: '10s', target: 200 }, // Picco improvviso fino a 200 utenti in 10 secondi
    { duration: '1m', target: 200 },  // Mantiene il picco per 1 minuto
    { duration: '10s', target: 20 },  // Ritorno rapido al carico normale
    { duration: '2m', target: 20 },   // Mantiene il carico normale per osservare il recupero
    { duration: '10s', target: 0 },    // Fine del test
  ],
  thresholds: {
    // Ci aspettiamo qualche errore durante il picco, ma il sistema dovrebbe recuperare.
    'http_req_failed': ['rate<0.1'], 
    'http_req_duration': ['p(95)<10000'], // Tolleriamo una latenza più alta durante il picco (10s)
  },
};

const API_BASE_URL = __ENV.API_URL || 'http://34.13.75.10/';
const PCAP_FILENAME = 'vethd9e14c0-normal-10.pcap';

// --- FUNZIONE PRINCIPALE DEL TEST ---
export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // 1. Ottieni la Signed URL
  const signedUrlPayload = JSON.stringify({
    files: [{ name: PCAP_FILENAME, size: pcapData.length }],
    session_id: `k6-spike-session-${__VU}-${__ITER}`,
  });
  
  const signedUrlRes = http.post(`${API_BASE_URL}api/upload/signed-url`, signedUrlPayload, { headers });
  apiResponseTrend.add(signedUrlRes.timings.duration);
  check(signedUrlRes, { 'spike-test: signed URL OK': (r) => r.status === 200 });
  if (signedUrlRes.status !== 200) return;
  
  const signedUrlData = signedUrlRes.json();
  const uploadUrl = signedUrlData.signed_urls[0].signed_url;
  const blobName = signedUrlData.signed_urls[0].blob_name;
  const sessionId = signedUrlData.session_id;

  // 2. Carica il file su GCS
  const uploadRes = http.put(uploadUrl, pcapData, {
    headers: { 'Content-Type': 'application/octet-stream' },
    timeout: '120s',
  });
  apiResponseTrend.add(uploadRes.timings.duration);
  check(uploadRes, { 'spike-test: upload to GCS OK': (r) => r.status === 200 });
  if (uploadRes.status !== 200) return;

  // 3. Verifica l'upload
  const verifyPayload = JSON.stringify({ blob_names: [blobName] });
  const verifyRes = http.post(`${API_BASE_URL}api/upload/verify`, verifyPayload, { headers });
  apiResponseTrend.add(verifyRes.timings.duration);

  // 4. Avvia l'analisi
  const analyzePayload = JSON.stringify({
    blob_names: [blobName],
    session_id: sessionId,
    type: 'auto',
  });
  const analyzeRes = http.post(`${API_BASE_URL}api/analyze`, analyzePayload, { headers, timeout: '120s' });
  apiResponseTrend.add(analyzeRes.timings.duration);

  sleep(2); // Pausa breve tra le iterazioni
}
