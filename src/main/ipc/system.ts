import { app, ipcMain } from 'electron';
import { execSync } from 'child_process';
import os from 'os';

export function registerSystemHandlers(): void {
  ipcMain.handle('app:getInfo', async () => {
    const platform = process.platform;
    const arch = process.arch;
    const release = os.release();
    const version = app.getVersion();
    
    let isAur = false;
    if (platform === 'linux') {
      try {
        // pacman -Qm lists foreign packages (AUR)
        const output = execSync('pacman -Qm gero 2>/dev/null', { encoding: 'utf8' });
        if (output.includes('gero')) {
          isAur = true;
        }
      } catch {
        // Fallback or just ignore if pacman is not present
      }
    }

    return {
      platform,
      arch,
      release,
      version,
      isAur,
      osName: getOsName(platform),
    };
  });

  ipcMain.handle('app:checkForUpdates', async () => {
    // For a real app, you'd use electron-updater here.
    // For this prototype, we'll simulate the update process.
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ available: true, version: '1.0.1' });
      }, 1500);
    });
  });

  ipcMain.handle('app:performUpdate', async () => {
    // Simulated update process
    return new Promise((resolve) => {
      // In a real app: autoUpdater.downloadUpdate() then autoUpdater.quitAndInstall()
      setTimeout(() => {
        resolve({ success: true });
      }, 3000);
    });
  });
}

function getOsName(platform: string): string {
  switch (platform) {
    case 'win32': return 'Windows';
    case 'darwin': return 'macOS';
    case 'linux': return 'Linux';
    default: return platform;
  }
}
