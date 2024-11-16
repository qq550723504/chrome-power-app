import type { IP } from '../../../shared/types/ip';
import { generateGPUInfo } from './gpu';

/**
 * 生成随机NVIDIA GPU信息
 */
export const generateRandomNvidiaGpu = () => {
  // 固定的厂商和引擎部分
  const vendor = 'Google Inc.';
  const engine = 'ANGLE';
  const gpuVendor = 'NVIDIA';

  // 定义NVIDIA显卡的RTX和GTX系列型号
  const rtxModels = [
    'NVIDIA GeForce RTX 4090', 'NVIDIA GeForce RTX 4080', 'NVIDIA GeForce RTX 4070',
    'NVIDIA GeForce RTX 4060', 'NVIDIA GeForce RTX 3060', 'NVIDIA GeForce RTX 3070',
  ];

  const gtxModels = [
    'NVIDIA GeForce GTX 1660 Ti', 'NVIDIA GeForce GTX 1650',
    'NVIDIA GeForce GTX 1080', 'NVIDIA GeForce GTX 1070',
    'NVIDIA GeForce GTX 1060', 'NVIDIA GeForce GTX 1050 Ti',
  ];

  const selectedModel = [...rtxModels, ...gtxModels][Math.floor(Math.random() * (rtxModels.length + gtxModels.length))];

  // 生成随机设备ID
  const deviceId = `0x0000${Math.floor(Math.random() * (8978 - 1514 + 1) + 1514).toString(16).toUpperCase().padStart(4, '0')}`;

  // 固定渲染API和着色器版本
  const renderApi = 'D3D11';
  const vsVersion = 'vs_5_0';
  const psVersion = 'ps_5_0';

  return `${vendor} (${gpuVendor}) ${engine} ` +
    `(${gpuVendor}, ${selectedModel} (${deviceId}) ` +
    `${renderApi} ${vsVersion} ${psVersion}, ${renderApi})`;
};

/**
 * 生成随机指纹信息
 */
export const generateRandomFingerprint = (ipInfo: IP) => {
  // 生成随机的 canvas toDataUrl 数组
  const canvasToDataUrl = Array(3).fill(0).map(() => Math.floor(Math.random() * 5));

  // 生成GPU渲染器信息
  const renderer = generateGPUInfo();

  // 生成随机私有IP地址
  const privateIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

  // 生成随机 clientRect 值
  const clientRect = Number((Math.random() * 0.0001).toFixed(8));

  // 生成随机 GPU 描述和设备信息
  const gpuDescription = Array(5).fill(0)
    .map(() => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)])
    .join('');
  const gpuDevice = Number((Math.random() * 2).toFixed(4));

  return {
    enable: true,
    canvas: { toDataUrl: canvasToDataUrl },
    webgl: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: renderer,
    },
    webrtc: {
      public: ipInfo.ip,
      private: privateIp,
    },
    clientRect: clientRect,
    gpu: {
      description: gpuDescription,
      device: gpuDevice.toString(),
    },
    languages: {
      http: 'en-US,en;q=0.9',
      js: 'en-US',
    },
    webaudio: Math.floor(Math.random() * 500) + 1,
    clientHint: {
      platform: 'Windows',
      platform_version: `${10 + Math.floor(Math.random() * 6)}.0.0`,
      ua_full_version: '130.0.6723.41',
      mobile: '?0',
      architecture: Math.random() > 0.5 ? 'x86' : 'arm',
      bitness: Math.random() > 0.2 ? '64' : '32',
    },
  };
};
