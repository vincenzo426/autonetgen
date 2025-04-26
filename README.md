# AutoNetGen

**Generatore automatico di configurazioni di rete basato su analisi del traffico**

## Descrizione

**AutoNetGen** è uno strumento che analizza il traffico di rete catturato in file PCAP e inferisce automaticamente la topologia della rete, per poi generare configurazioni di infrastruttura come codice (IaC) utilizzando Terraform per Google Cloud Platform (GCP).

## Caratteristiche

- Analisi di file PCAP per estrazione dei flussi di traffico di rete
- Identificazione automatica di client, server e servizi
- Creazione di un grafo della topologia di rete
- Generazione automatica di configurazione Terraform per GCP
- Supporto per il deployment automatico dell'infrastruttura
- Validazione della rete creata

## Requisiti

- Python 3.8+
- Terraform 1.0+
- Account Google Cloud Platform con accesso API
- Google Cloud SDK (opzionale, per test e validazione)

### Dipendenze Python

- `scapy`
- `pandas`
- `networkx`
- `jinja2`

## Installazione

```bash
# Installa le dipendenze
pip install scapy pandas networkx jinja2

# Clona il repository
git clone https://github.com/tuouser/autonetgen.git
cd autonetgen

# Installazione (per sviluppatori)
pip install -e .
```

## Struttura del progetto

```
autonetgen/
├── autonetgen/
│   ├── __init__.py
│   ├── core.py       # Classe principale AutoNetGen
│   ├── cli.py        # Interfaccia a riga di comando
│   └── templates/    # Templates Jinja2 per Terraform
├── tests/            # Test unitari
├── examples/         # Esempi di utilizzo
├── setup.py          # Script di installazione
└── README.md         # Questo file
```

## Utilizzo

### Interfaccia a riga di comando

AutoNetGen offre diversi comandi per fasi specifiche del processo o per l'esecuzione dell'intero pipeline.

#### Analizzare un file PCAP

```bash
autonetgen analyze --pcap path/to/capture.pcap
```

#### Generare la configurazione Terraform

```bash
autonetgen generate --pcap path/to/capture.pcap --output terraform_config
```

#### Eseguire il deployment dell'infrastruttura

```bash
autonetgen deploy --config terraform_config
```

#### Distruggere l'infrastruttura

```bash
autonetgen destroy --config terraform_config
```

#### Eseguire l'intero pipeline

```bash
autonetgen run-all --pcap path/to/capture.pcap --output terraform_config [--deploy]
```

### Opzioni comuni

- `--project, -j`: ID del progetto GCP
- `--region, -r`: Regione GCP (default: `europe-west1`)
- `--zone, -z`: Zona GCP (default: `europe-west1-b`)
- `--verbose, -v`: Abilita log dettagliato
- `--auto-approve, -y`: Approva automaticamente le operazioni (per deploy e destroy)

### Esempio di utilizzo programmativo

```python
from autonetgen.core import AutoNetGen

# Configura AutoNetGen
config = {
    'terraform_dir': 'output_terraform',
    'gcp': {
        'project': 'mio-progetto-gcp',
        'region': 'europe-west1',
        'zone': 'europe-west1-b'
    }
}

# Inizializza
auto_net_gen = AutoNetGen(config)

# Esegui il pipeline
auto_net_gen.run_pipeline('mia_cattura.pcap', auto_deploy=False)

# Opzionale: esegui il deployment
auto_net_gen.deploy_infrastructure()
```

## Pipeline di elaborazione

1. **Analisi del traffico**: Il file PCAP viene analizzato per estrarre informazioni sui flussi di rete.
2. **Inferenza della topologia**: Viene creato un grafo della rete e inferiti i ruoli dei nodi (client, server).
3. **Generazione della configurazione**: Vengono creati file Terraform basati sulla topologia inferita.
4. **Deployment (opzionale)**: Viene eseguito il deployment dell'infrastruttura su GCP utilizzando Terraform.
5. **Validazione (opzionale)**: Vengono eseguiti test per verificare che la rete creata funzioni correttamente.

## Limitazioni attuali

- L'inferenza dei ruoli è basata su euristiche semplici
- Supporto solo per Google Cloud Platform
- La validazione automatica della rete richiede ulteriore sviluppo
- L'analisi di file PCAP molto grandi può richiedere molta memoria

## Roadmap

- Supporto per altri provider cloud (AWS, Azure)
- Miglioramento degli algoritmi di inferenza
- Interfaccia utente grafica (GUI)
- Validazione automatica delle reti create
- Supporto per protocolli industriali (Modbus, DNP3, ecc.)
- Supporto per IPv6
- Analisi incrementale e in tempo reale

## Contribuire

Le contribuzioni sono benvenute!  
Per favore, apri un'**issue** o una **pull request**.
