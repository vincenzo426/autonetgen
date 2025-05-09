#!/usr/bin/env python3
"""
TerraformManager - classe per gestire le operazioni Terraform
"""

import os
import subprocess
import json
import tempfile
from config import logger

class TerraformManager:
    """Classe per gestire le operazioni di Terraform"""

    def __init__(self, terraform_dir):
        """
        Inizializza il manager Terraform
        
        Args:
            terraform_dir (str): Directory contenente i file Terraform
        """
        self.terraform_dir = terraform_dir
        
    def init(self):
        """
        Inizializza Terraform nella directory specificata
        
        Returns:
            dict: Risultato dell'operazione
        """
        logger.info(f"Inizializzazione Terraform in {self.terraform_dir}")
        
        try:
            result = self._run_terraform_command("init", capture_output=True)
            return {
                "success": result["returncode"] == 0,
                "output": result["stdout"],
                "error": result["stderr"] if result["returncode"] != 0 else None
            }
        except Exception as e:
            logger.error(f"Errore durante l'inizializzazione Terraform: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def validate(self):
        """
        Valida la configurazione Terraform
        
        Returns:
            dict: Risultato della validazione
        """
        logger.info(f"Validazione configurazione Terraform in {self.terraform_dir}")
        
        try:
            result = self._run_terraform_command("validate", capture_output=True)
            return {
                "success": result["returncode"] == 0,
                "output": result["stdout"],
                "error": result["stderr"] if result["returncode"] != 0 else None
            }
        except Exception as e:
            logger.error(f"Errore durante la validazione Terraform: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def plan(self):
        """
        Esegue terraform plan e salva l'output
        
        Returns:
            dict: Risultato del plan con percorso del file di output
        """
        logger.info(f"Esecuzione terraform plan in {self.terraform_dir}")
        
        try:
            # Crea un file temporaneo per il piano
            plan_file = os.path.join(self.terraform_dir, "tfplan")
            
            # Comando plan con output in JSON
            result = self._run_terraform_command(
                "plan", 
                f"-out={plan_file}",
                "-detailed-exitcode",
                capture_output=True
            )
            
            # Converti il piano in JSON per l'interpretazione
            json_result = self._run_terraform_command(
                "show",
                "-json",
                plan_file,
                capture_output=True
            )
            
            # Parse del JSON (può essere molto grande)
            plan_json = {}
            if json_result["returncode"] == 0:
                try:
                    plan_json = json.loads(json_result["stdout"])
                except:
                    plan_json = {"error": "Impossibile analizzare l'output JSON"}
            
            # In Terraform, il codice 0 significa "nessuna modifica",
            # 1 significa "errore", 2 significa "modifiche pianificate"
            success = result["returncode"] in [0, 2]
            has_changes = result["returncode"] == 2
            
            return {
                "success": success,
                "has_changes": has_changes,
                "plan_file": plan_file if success else None,
                "plan_summary": self._extract_plan_summary(plan_json) if success else None,
                "output": result["stdout"],
                "error": result["stderr"] if not success else None
            }
            
        except Exception as e:
            logger.error(f"Errore durante l'esecuzione di terraform plan: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def apply(self, plan_file=None, auto_approve=False):
        """
        Esegue terraform apply
        
        Args:
            plan_file (str, optional): File del piano da applicare
            auto_approve (bool): Se approvare automaticamente il piano
            
        Returns:
            dict: Risultato dell'operazione apply
        """
        logger.info(f"Esecuzione terraform apply in {self.terraform_dir}")
        
        try:
            args = ["apply"]
            
            if auto_approve:
                args.append("-auto-approve")
                
            if plan_file:
                args.append(plan_file)
            
            result = self._run_terraform_command(*args, capture_output=True)
            
            return {
                "success": result["returncode"] == 0,
                "output": result["stdout"],
                "error": result["stderr"] if result["returncode"] != 0 else None
            }
        except Exception as e:
            logger.error(f"Errore durante l'esecuzione di terraform apply: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def destroy(self, auto_approve=False):
        """
        Esegue terraform destroy
        
        Args:
            auto_approve (bool): Se approvare automaticamente la distruzione
            
        Returns:
            dict: Risultato dell'operazione destroy
        """
        logger.info(f"Esecuzione terraform destroy in {self.terraform_dir}")
        
        try:
            args = ["destroy"]
            
            if auto_approve:
                args.append("-auto-approve")
                
            result = self._run_terraform_command(*args, capture_output=True)
            
            return {
                "success": result["returncode"] == 0,
                "output": result["stdout"],
                "error": result["stderr"] if result["returncode"] != 0 else None
            }
        except Exception as e:
            logger.error(f"Errore durante l'esecuzione di terraform destroy: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_outputs(self):
        """
        Ottiene gli output di Terraform
        
        Returns:
            dict: Output di Terraform
        """
        logger.info(f"Recupero output Terraform da {self.terraform_dir}")
        
        try:
            result = self._run_terraform_command("output", "-json", capture_output=True)
            
            if result["returncode"] == 0:
                try:
                    return {
                        "success": True,
                        "outputs": json.loads(result["stdout"])
                    }
                except json.JSONDecodeError:
                    return {
                        "success": True,
                        "outputs": {}
                    }
            else:
                return {
                    "success": False,
                    "error": result["stderr"]
                }
        except Exception as e:
            logger.error(f"Errore durante il recupero degli output Terraform: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _run_terraform_command(self, *args, capture_output=False):
        """
        Esegue un comando Terraform
        
        Args:
            *args: Argomenti del comando
            capture_output (bool): Se catturare l'output del comando
            
        Returns:
            dict: Risultato dell'esecuzione
        """
        cmd = ["terraform"] + list(args)
        logger.info(f"Esecuzione comando: {' '.join(cmd)}")
        
        env = os.environ.copy()
        # Impostazione variabili d'ambiente per Terraform
        env["TF_IN_AUTOMATION"] = "true"  # Riduce l'output per l'automazione
        
        process = subprocess.run(
            cmd,
            cwd=self.terraform_dir,
            text=True,
            capture_output=capture_output,
            env=env
        )
        
        if capture_output:
            return {
                "returncode": process.returncode,
                "stdout": process.stdout,
                "stderr": process.stderr
            }
        
        return {"returncode": process.returncode}
    
    def _extract_plan_summary(self, plan_json):
        """
        Estrae un sommario leggibile dal piano JSON
        
        Args:
            plan_json (dict): Piano Terraform in formato JSON
            
        Returns:
            dict: Sommario del piano
        """
        if not plan_json or "resource_changes" not in plan_json:
            return {"add": 0, "change": 0, "destroy": 0}
        
        summary = {"add": 0, "change": 0, "destroy": 0}
        
        for resource in plan_json.get("resource_changes", []):
            action = resource.get("change", {}).get("actions", [])
            
            if "create" in action:
                summary["add"] += 1
            elif "update" in action:
                summary["change"] += 1
            elif "delete" in action:
                summary["destroy"] += 1
        
        return summary