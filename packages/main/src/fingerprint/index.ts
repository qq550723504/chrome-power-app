import { join } from 'path';
import { ProxyDB } from '../db/proxy';
import { WindowDB } from '../db/window';
// import {getChromePath} from './device';
import { BrowserWindow } from 'electron';
import puppeteer from 'puppeteer';
import { execSync, spawn } from 'child_process';
import * as portscanner from 'portscanner';
import { sleep } from '../utils/sleep';
import SocksServer from '../proxy-server/socks-server';
import type { DB } from '../../../shared/types/db';
import type { IP } from '../../../shared/types/ip';
import { type IncomingMessage, type Server, type ServerResponse } from 'http';
import { createLogger } from '../../../shared/utils/logger';
import { WINDOW_LOGGER_LABEL } from '../constants';
import { db } from '../db';
import { getProxyInfo } from './prepare';
import * as ProxyChain from 'proxy-chain';
import api from '../../../shared/api/api';
import { getSettings } from '../utils/get-settings';
import { getPort } from '../server/index';
//import { randomFingerprint } from '../services/window-service';
import { bridgeMessageToUI, getClientPort, getMainWindow } from '../mainWindow';
import { Mutex } from 'async-mutex';
import { presetCookie, timeZoneScript } from '../puppeteer/helpers';
import { modifyPageInfo } from '../puppeteer/helpers';
import { checkTimeZoneLeak } from './check';
import { getLangByCountry } from '../utils/language';
import { generateRandomFingerprint } from './generate';
const mutex = new Mutex();

const logger = createLogger(WINDOW_LOGGER_LABEL);

const HOST = '127.0.0.1';

async function connectBrowser(
  port: number,
  ipInfo: IP,
  windowId: number,
  openStartPage: boolean = false,
) {
  const windowData = await WindowDB.getById(windowId);
  const settings = getSettings();
  const browserURL = `http://${HOST}:${port}`;
  const { data } = await api.get(browserURL + '/json/version');
  if (data.webSocketDebuggerUrl) {
    const browser = await puppeteer.connect({
      browserWSEndpoint: data.webSocketDebuggerUrl,
      defaultViewport: null,
    });

    if (!windowData.opened_at) {
      await presetCookie(windowId, browser);
    }
    await WindowDB.update(windowId, {
      status: 2,
      port: port,
      opened_at: db.fn.now() as unknown as string,
    });

    browser.on('targetcreated', async target => {
      if (target.type() === 'page') {
        const newPage = await target.page();
        if (newPage) {
          await newPage.evaluateOnNewDocument(timeZoneScript(ipInfo.timeZone));
          await newPage.waitForNavigation({ waitUntil: 'networkidle0' });
          if (!settings.useLocalChrome) {
            await modifyPageInfo(windowId, newPage, ipInfo);
            // 进行时区泄露检查
            const checkResult = await checkTimeZoneLeak(newPage, ipInfo.timeZone);
            if (!checkResult.success) {
              logger.warn(`窗口 ${windowId} 存在时区泄露:`, checkResult.issues);
              bridgeMessageToUI({
                type: 'warning',
                text: `检测到时区泄露: ${(checkResult.issues || []).join(', ')}`,
              });
            }
          }
        }
      }
    });
    const pages = await browser.pages();
    const page =
      pages.length &&
        (pages?.[0]?.url() === 'about:blank' ||
          !pages?.[0]?.url() ||
          pages?.[0]?.url() === 'chrome://new-tab-page/')
        ? pages?.[0]
        : await browser.newPage();
    await page.evaluateOnNewDocument(timeZoneScript(ipInfo.timeZone));
    if (ipInfo?.timeZone) {
      await modifyPageInfo(windowId, page, ipInfo);
    }
    if (getClientPort() && openStartPage) {
      await page.goto(
        `http://localhost:${getClientPort()}/#/start?windowId=${windowId}&serverPort=${getPort()}`,
      );
    }
    return data;
  }
}

const getDriverPath = () => {
  const settings = getSettings();

  if (settings.useLocalChrome) {
    return settings.localChromePath;
  } else {
    return settings.chromiumBinPath;
  }
};

const getAvailablePort = async () => {
  for (let attempts = 0; attempts < 10; attempts++) {
    try {
      const port = await portscanner.findAPortNotInUse(9222, 40222);
      return port; // 成功绑定后返回
    } catch (error) {
      console.log('Port already in use, retrying...');
    }
  }
  throw new Error('Failed to find a free port after multiple attempts');
};

export async function openFingerprintWindow(id: number, headless = false) {
  const release = await mutex.acquire();
  try {
    const windowData = await WindowDB.getById(id);
    const proxyData = await ProxyDB.getById(windowData.proxy_id);
    const proxyType = proxyData?.proxy_type?.toLowerCase();
    const settings = getSettings();

    const cachePath = settings.profileCachePath;

    const win = BrowserWindow.getAllWindows()[0];
    const windowDataDir = join(
      cachePath,
      settings.useLocalChrome ? 'chrome' : 'chromium',
      windowData.profile_id,
    );
    const driverPath = getDriverPath();

    let ipInfo = { timeZone: '', ip: '', ll: [], country: '', lang: '' };
    if (windowData.proxy_id && proxyData.ip) {
      ipInfo = await getProxyInfo(proxyData);
      ipInfo.lang = ipInfo.lang || getLangByCountry(ipInfo.country) || 'en-US';
      if (!ipInfo?.ip) {
        logger.error('ipInfo is empty');
      }
    }

    if (driverPath) {
      const chromePort = await getAvailablePort();
      let finalProxy;
      let proxyServer: Server<typeof IncomingMessage, typeof ServerResponse> | ProxyChain.Server;
      if (proxyData && proxyType === 'socks5' && proxyData.proxy) {
        const proxyInstance = await createSocksProxy(proxyData);
        finalProxy = proxyInstance.proxyUrl;
        proxyServer = proxyInstance.proxyServer;
      } else if (proxyData && proxyType === 'http' && proxyData.proxy) {
        const proxyInstance = await createHttpProxy(proxyData);
        finalProxy = proxyInstance.proxyUrl;
        proxyServer = proxyInstance.proxyServer;
      }
      const launchOptions = async () => {
        return [
          '--force-color-profile=srgb',
          '--no-first-run',
          '--no-default-browser-check',
          '--metrics-recording-only',
          '--disable-background-mode',
          `--remote-debugging-port=${chromePort}`,
          `--user-data-dir=${windowDataDir}`,
          `--kfingerprint=${JSON.stringify(generateRandomFingerprint(ipInfo))}`,
        ];
      };

      const launchParamter = await launchOptions();

      if (finalProxy) {
        launchParamter.push(`--proxy-server=${finalProxy}`);
      }
      if (ipInfo?.timeZone) {
        launchParamter.push(`--lang=${ipInfo.lang}`);
        launchParamter.push(`--timezone=${ipInfo?.timeZone || 'America/Los_Angeles'}`);
      }
      if (headless) {
        launchParamter.push('--headless');
        launchParamter.push('--disable-gpu');
      }
      let chromeInstance;
      try {
        chromeInstance = spawn(driverPath, launchParamter);
      } catch (error) {
        logger.error(error);
      }
      if (!chromeInstance) {
        return;
      }
      await sleep(1);
      win.webContents.send('window-opened', id);
      chromeInstance.stdout.on('data', _chunk => {
        // const str = _chunk.toString();
        // console.error('stderr: ', str);
      });
      // 这个地方需要监听 stderr，否则在某些网站会出现卡死的情况
      chromeInstance.stderr.on('data', _chunk => {
        // const str = _chunk.toString();
        // console.error('stderr: ', str);
      });

      chromeInstance.on('close', async () => {
        logger.info(`Chrome process exited at port ${chromePort}, closed time: ${new Date()}`);
        if (proxyType === 'socks5') {
          (proxyServer as Server<typeof IncomingMessage, typeof ServerResponse>)?.close(() => {
            logger.info('Socks5 Proxy server was closed.');
          });
        } else if (proxyType === 'http') {
          (proxyServer as ProxyChain.Server).close(true, () => {
            logger.info('Http Proxy server was closed.');
          });
        }
        await closeFingerprintWindow(id, true);
      });

      await sleep(1);

      try {
        if (!settings.useLocalChrome || settings.automationConnect) {
          return connectBrowser(chromePort, ipInfo, windowData.id, !!windowData.proxy_id);
        } else {
          await WindowDB.update(windowData.id, {
            status: 2,
            port: undefined,
            opened_at: db.fn.now() as unknown as string,
          });
          return {
            window: windowData,
            browser: { message: 'Automation connect is disabled' },
          };
        }
      } catch (error) {
        logger.error(error);
        execSync(`taskkill /PID ${chromeInstance.pid} /F`);
        await closeFingerprintWindow(id, true);
        return null;
      }
    } else {
      bridgeMessageToUI({
        type: 'error',
        text: 'Driver path is empty',
      });
      logger.error('Driver path is empty');
      return null;
    }
  } finally {
    release();
  }
}

async function createHttpProxy(proxyData: DB.Proxy) {
  const listenPort = await portscanner.findAPortNotInUse(30000, 40000);
  const [httpHost, httpPort, username, password] = proxyData.proxy!.split(':');

  const oldProxyUrl = `http://${username}:${password}@${httpHost}:${httpPort}`;
  const newProxyUrl = await ProxyChain.anonymizeProxy({
    url: oldProxyUrl,
    port: listenPort,
  });
  const proxyServer = new ProxyChain.Server({
    port: listenPort,
  });

  return {
    proxyServer,
    proxyUrl: newProxyUrl,
  };
}

async function createSocksProxy(proxyData: DB.Proxy) {
  const listenHost = HOST;
  const listenPort = await portscanner.findAPortNotInUse(30000, 40000);
  const [socksHost, socksPort, socksUsername, socksPassword] = proxyData.proxy!.split(':');

  const proxyServer = SocksServer({
    listenHost,
    listenPort,
    socksHost,
    socksPort: +socksPort,
    socksUsername,
    socksPassword,
  });

  proxyServer.on('connect:error', err => {
    logger.error(err);
  });
  proxyServer.on('request:error', err => {
    logger.error(err);
  });

  return {
    proxyServer,
    proxyUrl: `http://${listenHost}:${listenPort}`,
  };
}

export async function resetWindowStatus(id: number) {
  await WindowDB.update(id, { status: 1, port: undefined });
}

export async function closeFingerprintWindow(id: number, force = false) {
  const window = await WindowDB.getById(id);
  const port = window.port;
  const status = window.status;
  if (status > 1) {
    if (force && port) {
      try {
        const browserURL = `http://${HOST}:${port}`;
        const browser = await puppeteer.connect({ browserURL, defaultViewport: null });
        logger.info('close browser', browserURL);
        await browser?.close();
      } catch (error) {
        logger.error(error);
      }
    }
    await WindowDB.update(id, { status: 1, port: undefined });
    const win = getMainWindow();
    if (win) {
      win.webContents.send('window-closed', id);
    }
  }
}

export default {
  openFingerprintWindow,

  closeFingerprintWindow,
};
