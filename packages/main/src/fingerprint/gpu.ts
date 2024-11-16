interface GPUInfo {
  vendor: string;
  renderer: string;
  vendorId: string;
  deviceId: string;
}

// NVIDIA GPU配置
const NVIDIA_CONFIG = {
  vendorId: '0x10de',  // NVIDIA标准供应商ID
  vendor: 'Google Inc. (NVIDIA)',
  rtxModels: [
    'NVIDIA GeForce RTX 4090', 
    'NVIDIA GeForce RTX 4080', 
    'NVIDIA GeForce RTX 4070 Ti', 
    'NVIDIA GeForce RTX 4070',
    'NVIDIA GeForce RTX 4060 Ti', 
    'NVIDIA GeForce RTX 4060',
    'NVIDIA GeForce RTX 3090 Ti', 
    'NVIDIA GeForce RTX 3090',
    'NVIDIA GeForce RTX 3080 Ti', 
    'NVIDIA GeForce RTX 3080',
    'NVIDIA GeForce RTX 3070 Ti', 
    'NVIDIA GeForce RTX 3070',
    'NVIDIA GeForce RTX 3060 Ti', 
    'NVIDIA GeForce RTX 3060',
  ],
  gtxModels: [
    'NVIDIA GeForce GTX 1660 SUPER', 
    'NVIDIA GeForce GTX 1660 Ti', 
    'NVIDIA GeForce GTX 1660', 
    'NVIDIA GeForce GTX 1650 SUPER',
    'NVIDIA GeForce GTX 1650', 
    'NVIDIA GeForce GTX 1080 Ti',
    'NVIDIA GeForce GTX 1080', 
    'NVIDIA GeForce GTX 1070 Ti',
    'NVIDIA GeForce GTX 1070', 
    'NVIDIA GeForce GTX 1060 6GB',
    'NVIDIA GeForce GTX 1060 3GB', 
    'NVIDIA GeForce GTX 1050 Ti',
  ],
  // 设备ID范围
  deviceIdRange: {
    min: 1514,
    max: 8978,
  },
};

// 生成随机GPU信息
export const generateGPUInfo = (): GPUInfo => {
  const vendor = NVIDIA_CONFIG.vendor;
  const engine = 'ANGLE';
  
  // 随机选择显卡型号
  const allModels = [...NVIDIA_CONFIG.rtxModels, ...NVIDIA_CONFIG.gtxModels];
  const selectedModel = allModels[Math.floor(Math.random() * allModels.length)];
  
  // 生成设备ID
  const deviceId = `0x0000${Math.floor(
    Math.random() * (NVIDIA_CONFIG.deviceIdRange.max - NVIDIA_CONFIG.deviceIdRange.min + 1) + 
    NVIDIA_CONFIG.deviceIdRange.min,
  ).toString(16).toUpperCase().padStart(4, '0')}`;

  // 构建渲染器字符串
  const renderer = `${vendor} ${engine} (NVIDIA, ${selectedModel} (${deviceId}) Direct3D11 vs_5_0 ps_5_0, Direct3D11)`;

  return {
    vendor,
    renderer,
    vendorId: NVIDIA_CONFIG.vendorId,
    deviceId,
  };
};

// 生成WebGL注入脚本
export const generateWebGLScript = (gpuInfo: GPUInfo): string => {
  return `
    (() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, attributes) {
        const context = getContext.call(this, type, attributes);
        if (type === 'webgl' || type === 'webgl2') {
          const getParameter = context.getParameter.bind(context);
          context.getParameter = function(parameter) {
            // UNMASKED_VENDOR_WEBGL
            if (parameter === 0x9245) {
              return "${gpuInfo.vendor}";
            }
            // UNMASKED_RENDERER_WEBGL
            if (parameter === 0x9246) {
              return "${gpuInfo.renderer}";
            }
            return getParameter(parameter);
          };
        }
        return context;
      };
      
      // 覆盖 navigator.getGPUDescription
      if (navigator.gpu) {
        Object.defineProperty(navigator.gpu, 'getGPUDescription', {
          value: () => "${gpuInfo.renderer}",
          writable: false
        });
      }
    })();
  `;
};

// 获取Chrome启动参数
export const getGPULaunchArgs = (gpuInfo: GPUInfo): string[] => {
  return [
    '--disable-gpu-driver-bug-workarounds',
    '--disable-gpu-vsync',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
    '--disable-gpu-compositing',
    '--use-gl=desktop',
    '--use-angle=default',
    `--gpu-vendor-id=${gpuInfo.vendorId}`,
    `--gpu-device-id=${gpuInfo.deviceId}`,
  ];
};

// 检测当前GPU信息
// export const detectCurrentGPU = async (page: any): Promise<GPUInfo | null> => {
//   try {
//     const gpuInfo = await page.evaluate(() => {
//       const canvas = document.createElement('canvas');
//       const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
//       if (!gl) return null;
      
//       const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
//       if (!debugInfo) return null;
      
//       return {
//         vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
//         renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
//       };
//     });
    
//     return gpuInfo;
//   } catch (error) {
//     console.error('GPU检测失败:', error);
//     return null;
//   }
// };
