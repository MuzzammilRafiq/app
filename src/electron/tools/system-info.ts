import { Type, FunctionDeclaration } from '@google/genai';
import os from 'os';
import { app } from 'electron';

export const getSystemInfo = () => {
  try {
    const info = {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      appVersion: app.getVersion(),
      totalMemory: `${Math.round((os.totalmem() / 1024 / 1024 / 1024) * 100) / 100} GB`,
      freeMemory: `${Math.round((os.freemem() / 1024 / 1024 / 1024) * 100) / 100} GB`,
      uptime: `${Math.round((os.uptime() / 3600) * 100) / 100} hours`,
      hostname: os.hostname(),
      userInfo: os.userInfo().username,
    };

    return `System Information:
Platform: ${info.platform} (${info.arch})
Node.js: ${info.nodeVersion}
Electron: ${info.electronVersion}
App Version: ${info.appVersion}
Memory: ${info.freeMemory} free of ${info.totalMemory}
Uptime: ${info.uptime}
Hostname: ${info.hostname}
User: ${info.userInfo}`;
  } catch (error) {
    return `Error getting system information: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

export const getSystemInfoFunctionDeclaration: FunctionDeclaration = {
  name: 'get_system_info',
  description:
    'Get basic system information including platform, memory, versions, etc.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};
