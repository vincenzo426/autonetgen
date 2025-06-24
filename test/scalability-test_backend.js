import http from "k6/http";
import { check, sleep, fail } from "k6";
import { Trend } from "k6/metrics";

// Metriche personalizzate
const signedUrlDuration = new Trend("signed_url_duration");
const uploadToGcsDuration = new Trend("upload_to_gcs_duration");
const verifyUploadDuration = new Trend("verify_upload_duration");
const analyzeDuration = new Trend("analyze_duration");

// Carica il file di dati di test (es. un file .pcap)
let pcapData;
try {
  pcapData = open("./data/vethd9e14c0-normal-10.pcap", "b");
} catch (e) {
  fail(
    'Impossibile aprire il file sample.pcap. Assicurati che esista nella cartella "data".'
  );
}

// --- OPZIONI PER IL TEST DI SCALABILITÀ ---
export const options = {
  stages: [
    { duration: "2m", target: 50 }, // Rampa graduale fino a 50 utenti in 2 minuti
    { duration: "5m", target: 50 }, // Mantiene 50 utenti per 5 minuti (prima fase di soak)
    { duration: "2m", target: 100 }, // Aumenta il carico fino a 100 utenti
    { duration: "5m", target: 100 }, // Mantiene 100 utenti per 5 minuti (seconda fase di soak)
    { duration: "2m", target: 0 }, // Rampa verso il basso
  ],
  thresholds: {
    // Le soglie sono strette perché ci aspettiamo che il sistema scali
    // e mantenga la performance, non che si rompa.
    http_req_failed: ["rate<0.01"], // Meno dell'1% di errori
    http_req_duration: ["p(95)<3000"], // Il 95% delle richieste deve essere sotto i 3s
  },
};

const API_BASE_URL = __ENV.API_URL || "http://34.13.75.10";
const PCAP_FILENAME = "vethd9e14c0-normal-10.pcap";

// --- FUNZIONE PRINCIPALE DEL TEST ---
export default function () {
  const headers = { "Content-Type": "application/json" };

  // 1. Ottieni la Signed URL per l'upload
  const signedUrlPayload = JSON.stringify({
    files: [{ name: PCAP_FILENAME, size: pcapData.length }],
    session_id: `k6-scale-session-${__VU}-${__ITER}`, // Un ID di sessione unico
  });

  const signedUrlRes = http.post(
    `${API_BASE_URL}/api/upload/signed-url`,
    signedUrlPayload,
    { headers }
  );
  signedUrlDuration.add(signedUrlRes.timings.duration);
  const signedUrlCheck = check(signedUrlRes, {
    "step1: signed URL status is 200": (r) => r.status === 200,
  });
  if (!signedUrlCheck) {
    console.error(`Errore nell'ottenere la signed URL: ${signedUrlRes.body}`);
    return; // Interrompe l'iterazione se il primo step fallisce
  }

  const signedUrlData = signedUrlRes.json();
  const uploadUrl = signedUrlData.signed_urls[0].signed_url;
  const blobName = signedUrlData.signed_urls[0].blob_name;
  const sessionId = signedUrlData.session_id;

  // 2. Carica il file su Google Cloud Storage
  const uploadRes = http.put(uploadUrl, pcapData, {
    headers: { "Content-Type": "application/octet-stream" },
  });
  uploadToGcsDuration.add(uploadRes.timings.duration);
  const uploadCheck = check(uploadRes, {
    "step2: upload to GCS status is 200": (r) => r.status === 200,
  });
  if (!uploadCheck) {
    console.error(`Errore durante l'upload su GCS: ${uploadRes.body}`);
    return;
  }

  // 3. Verifica l'upload
  const verifyPayload = JSON.stringify({ blob_names: [blobName] });
  const verifyRes = http.post(
    `${API_BASE_URL}/api/upload/verify`,
    verifyPayload,
    { headers }
  );
  verifyUploadDuration.add(verifyRes.timings.duration);
  check(verifyRes, {
    "step3: verifica upload status is 200": (r) => r.status === 200,
  });

  // 4. Avvia l'analisi
  const analyzePayload = JSON.stringify({
    blob_names: [blobName],
    session_id: sessionId,
    type: "auto",
  });
  const analyzeRes = http.post(`${API_BASE_URL}/api/analyze`, analyzePayload, {
    headers,
  });
  analyzeDuration.add(analyzeRes.timings.duration);
  check(analyzeRes, {
    "step4: richiesta di analisi status is 200": (r) => r.status === 200,
  });

  sleep(5); // Pausa di 5 secondi tra un'iterazione e l'altra per simulare un tempo di attesa dell'utente
}
