# Terraform Manager per AutonetGen
# Gestisce le operazioni Terraform da API

import os
import subprocess
import json
import tempfile
import shutil
from config import logger

class TerraformManager:
    """Gestisce le operazioni Terraform"""
    
    def __init__(self, terraform_dir):
        """
        Inizializza il TerraformManager
        
        Args:
            terraform_dir (str): Directory contenente i file Terraform
        """
        self.terraform_dir = terraform_dir
        
    def init(self):
        """
        Inizializza Terraform
        
        Returns:
            dict: Risultato dell'operazione
        """
        try:
            result = self._run_terraform_command(["init"])
            return {
                "success": True,
                "output": result
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
            dict: Risultato dell'operazione
        """
        try:
            result = self._run_terraform_command(["validate"])
            return {
                "success": True,
                "output": result
            }
        except Exception as e:
            logger.error(f"Errore durante la validazione Terraform: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def plan(self):
        """
        Esegue terraform plan
        
        Returns:
            dict: Risultato dell'operazione
        """
        try:
            # Crea un file per il piano
            plan_file = os.path.join(self.terraform_dir, "terraform.plan")
            
            # Esegue terraform plan
            result = self._run_terraform_command(["plan", "-detailed-exitcode", "-out", plan_file])
            
            # Analizza l'output per determinare se ci sono cambiamenti
            has_changes = False
            
            # Determina il numero di risorse da creare/modificare/eliminare
            add_count = result.count("+ resource")
            change_count = result.count("~ resource")
            destroy_count = result.count("- resource")
            
            # Determina se ci sono cambiamenti
            has_changes = add_count > 0 or change_count > 0 or destroy_count > 0
            
            return {
                "success": True,
                "has_changes": has_changes,
                "plan_summary": {
                    "add": add_count,
                    "change": change_count,
                    "destroy": destroy_count
                },
                "plan_file": plan_file if has_changes else None,
                "output": result
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
            plan_file (str, optional): File del piano Terraform
            auto_approve (bool, optional): Auto-approvazione
            
        Returns:
            dict: Risultato dell'operazione
        """
        try:
            command = ["apply"]
            
            if auto_approve:
                command.append("-auto-approve")
                
            if plan_file and os.path.exists(plan_file):
                command.append(plan_file)
            
            result = self._run_terraform_command(command)
            
            # Ottiene gli output dopo l'applicazione
            outputs = self.get_outputs()
            
            return {
                "success": True,
                "output": result,
                "outputs": outputs.get("outputs", {}) if outputs["success"] else {}
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
            auto_approve (bool, optional): Auto-approvazione
            
        Returns:
            dict: Risultato dell'operazione
        """
        try:
            command = ["destroy"]
            
            if auto_approve:
                command.append("-auto-approve")
            
            result = self._run_terraform_command(command)
            
            return {
                "success": True,
                "output": result
            }
        except Exception as e:
            logger.error(f"Errore durante l'esecuzione di terraform destroy: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_outputs(self):
        """
        Ottiene gli output Terraform
        
        Returns:
            dict: Output Terraform
        """
        try:
            result = self._run_terraform_command(["output", "-json"])
            
            # Parsa il JSON degli output
            outputs = json.loads(result)
            
            # Formatta gli output
            formatted_outputs = {}
            for key, value in outputs.items():
                formatted_outputs[key] = {
                    "value": value.get("value"),
                    "description": value.get("description", "")
                }
            
            return {
                "success": True,
                "outputs": formatted_outputs
            }
        except Exception as e:
            logger.error(f"Errore durante l'ottenimento degli output Terraform: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _run_terraform_command(self, args):
        """
        Esegue un comando Terraform
        
        Args:
            args (list): Argomenti del comando Terraform
            
        Returns:
            str: Output del comando
            
        Raises:
            Exception: Se il comando fallisce
        """
        command = ["terraform"] + args
        logger.info(f"Esecuzione del comando: {' '.join(command)}")
        
        # Esegue il comando
        process = subprocess.Popen(
            command,
            cwd=self.terraform_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True
        )
        
        stdout, stderr = process.communicate()
        
        if process.returncode != 0 and not (args[0] == "plan" and process.returncode == 2):
            # Il codice 2 è normale per 'terraform plan' quando ci sono cambiamenti
            raise Exception(f"Comando Terraform fallito: {stderr}")
        
        return stdout