#!/usr/bin/env node

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDir = path.resolve(__dirname, '..');

console.log('🔍 Recherche des serveurs du projet convention-de-jonglerie...\n');

async function killServers() {
  const processesToKill = [];
  
  try {
    // Recherche des processus Node.js liés au projet
    let stdout;
    
    if (process.platform === 'win32') {
      // Windows
      try {
        const { stdout: winstdout } = await execAsync('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine /format:csv');
        stdout = winstdout;
      } catch (error) {
        console.log('⚠️  Erreur lors de la recherche des processus Windows:', error.message);
        return;
      }
    } else {
      // Unix/Linux/macOS
      try {
        const { stdout: unixstdout } = await execAsync('ps aux | grep node');
        stdout = unixstdout;
      } catch (error) {
        console.log('⚠️  Erreur lors de la recherche des processus Unix:', error.message);
        return;
      }
    }

    const lines = stdout.split('\n');
    
    for (const line of lines) {
      // Rechercher les processus liés à ce projet
      if (line.includes('convention-de-jonglerie') || 
          line.includes('nuxt dev') || 
          line.includes('nuxt build') ||
          line.includes('nuxt preview') ||
          (line.includes('node') && line.includes(projectDir.replace(/\\/g, '/')))) {
        
        let pid;
        
        if (process.platform === 'win32') {
          // Format CSV Windows: Node,CommandLine,ProcessId
          const parts = line.split(',');
          if (parts.length >= 3) {
            pid = parts[2]?.trim();
          }
        } else {
          // Format Unix: user pid %cpu %mem ...
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            pid = parts[1];
          }
        }
        
        if (pid && !isNaN(pid) && pid !== '0') {
          processesToKill.push({
            pid: parseInt(pid),
            command: line.trim()
          });
        }
      }
    }

    // Recherche spécifique des ports utilisés par Nuxt (3000-3010)
    for (let port = 3000; port <= 3010; port++) {
      try {
        let portCmd;
        if (process.platform === 'win32') {
          portCmd = `netstat -ano | findstr :${port}`;
        } else {
          portCmd = `lsof -ti:${port}`;
        }
        
        const { stdout: portStdout } = await execAsync(portCmd);
        
        if (portStdout.trim()) {
          if (process.platform === 'win32') {
            // Extraire le PID de netstat sur Windows
            const lines = portStdout.split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5) {
                const pid = parseInt(parts[4]);
                if (pid && !processesToKill.some(p => p.pid === pid)) {
                  processesToKill.push({
                    pid,
                    command: `Port ${port} (PID: ${pid})`
                  });
                }
              }
            }
          } else {
            // Unix/Linux - lsof retourne directement les PIDs
            const pids = portStdout.trim().split('\n');
            for (const pid of pids) {
              const pidNum = parseInt(pid);
              if (pidNum && !processesToKill.some(p => p.pid === pidNum)) {
                processesToKill.push({
                  pid: pidNum,
                  command: `Port ${port} (PID: ${pidNum})`
                });
              }
            }
          }
        }
      } catch (error) {
        // Port pas utilisé, continuer
      }
    }

    // Supprimer les doublons
    const uniqueProcesses = processesToKill.filter((proc, index, self) => 
      index === self.findIndex(p => p.pid === proc.pid)
    );

    if (uniqueProcesses.length === 0) {
      console.log('✅ Aucun serveur du projet trouvé en cours d\'exécution.');
      return;
    }

    console.log(`🎯 ${uniqueProcesses.length} processus trouvé(s):\n`);
    
    uniqueProcesses.forEach((proc, index) => {
      console.log(`${index + 1}. PID ${proc.pid}: ${proc.command}`);
    });

    console.log('\n💀 Arrêt des processus...\n');

    // Arrêter les processus
    let killed = 0;
    for (const proc of uniqueProcesses) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /PID ${proc.pid} /F`, { stdio: 'pipe' });
        } else {
          execSync(`kill -9 ${proc.pid}`, { stdio: 'pipe' });
        }
        console.log(`✅ Processus ${proc.pid} arrêté avec succès`);
        killed++;
      } catch (error) {
        console.log(`❌ Impossible d'arrêter le processus ${proc.pid}: ${error.message}`);
      }
    }

    console.log(`\n🎉 ${killed}/${uniqueProcesses.length} processus arrêté(s) avec succès.`);
    
    if (killed > 0) {
      console.log('\n⚠️  Note: Les ports peuvent prendre quelques secondes à se libérer.');
    }

  } catch (error) {
    console.error('❌ Erreur lors de l\'arrêt des serveurs:', error.message);
    process.exit(1);
  }
}

// Gestion des signaux d'interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Arrêt du script...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Arrêt du script...');
  process.exit(0);
});

// Exécution du script
killServers().catch((error) => {
  console.error('❌ Erreur critique:', error.message);
  process.exit(1);
});