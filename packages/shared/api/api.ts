import axios from 'axios';


const api = axios.create();

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    if (config.url?.startsWith('https') && config.proxy && config.proxy.protocol === 'http') {
      config.proxy = {
        ...config.proxy,
        protocol: 'https',
      };
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);


api.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    return Promise.reject(error);
  },
);

export default api;
