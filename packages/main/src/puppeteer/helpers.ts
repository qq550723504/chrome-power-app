import type {Browser, Page} from 'puppeteer';
import type {ICookie} from '../types/cookie';
import {WindowDB} from '../db/window';
import type {IP} from '../../../shared/types/ip';
import {bridgeMessageToUI} from '../mainWindow';

type CookieDomain = string;

const cookieMap: Map<number, Map<CookieDomain, ICookie[]>> = new Map();

// const cookieToMap = (windowId: number, cookies: ICookie[]) => {
//   const map = new Map<CookieDomain, ICookie[]>();
//   cookies.forEach(cookie => {
//     console.log(cookie.domain);
//     let domain;
//     if (cookie.domain?.startsWith('.')) {
//       domain = cookie.domain.slice(1);
//     }
//     if (!map.get(domain!)) {
//       map.set(domain!, [cookie]);
//     } else {
//       const domainCookies = map.get(domain!);
//       domainCookies?.push(cookie);
//       map.set(domain!, domainCookies!);
//     }
//   });
//   cookieMap.set(windowId, map);
// };

const getCookie = (windowId: number, domain: CookieDomain) => {
  const map = cookieMap.get(windowId);
  if (map) {
    return map.get(domain);
  }
  return null;
};

const parseCookie = (cookie: string) => {
  //   const correctedCookie = cookie.replace(/(\w+)(?=:)/g, '"$1"');
  try {
    const jsonArray = JSON.parse(cookie);
    return jsonArray;
  } catch (error) {
    console.error('解析错误:', error);
    bridgeMessageToUI({
      type: 'error',
      text: 'Cookie JSON 解析错误',
    });
  }
};

export const setCookieToPage = async (windowId: number, page: Page) => {
  const url = page.url();
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  const cookie = getCookie(windowId, domain);
  const pageCookies = await page.cookies();
  console.log(domain, typeof pageCookies, pageCookies.length, cookie?.length);
  if (!pageCookies.length) {
    if (cookie?.length) {
      console.log('set cookie:', cookie);
      await page.setCookie(...cookie);
    }
  }
};

// 限流函数，限制同时执行的任务数
// function limitConcurrency(maxConcurrentTasks: number) {
//   let activeTasks = 0;
//   const taskQueue: (() => Promise<void>)[] = [];

//   function next() {
//     if (activeTasks < maxConcurrentTasks && taskQueue.length > 0) {
//       activeTasks++;
//       const task = taskQueue.shift();
//       task!().finally(() => {
//         activeTasks--;
//         next();
//       });
//     }
//   }

//   return (task: () => Promise<void>) => {
//     taskQueue.push(task);
//     next();
//   };
// }

export const presetCookie = async (windowId: number, browser: Browser) => {
  const window = await WindowDB.getById(windowId);
  if (window?.cookie) {
    if (typeof window.cookie === 'string') {
      const correctedCookie = parseCookie(window.cookie);
      const page = await browser.newPage();
      const client = await page.target().createCDPSession();
      await client.send('Network.enable');
      await client.send('Network.setCookies', {
        cookies: correctedCookie,
      });
      await page.close();
    }
  }
  return true;
};

// export const pageRequestInterceptor = async (windowId: number, page: Page) => {
//   const url = page.url();
//   const urlObj = new URL(url);
//   page.on('request', async request => {

//     request.continue();
//   });
// };

export const modifyPageInfo = async (windowId: number, page: Page, ipInfo: IP) => {
  page.on('framenavigated', async _msg => {
    try {
      const title = await page.title();
      if (!title.includes('By WND')) {
        await page.evaluate(title => {
          document.title = title + ' By WND';
        }, title);
      }

      await page.setGeolocation({latitude: ipInfo.ll?.[0], longitude: ipInfo.ll?.[1]});
      await page.emulateTimezone(ipInfo.timeZone);
    } catch (error) {
      console.error(error);
    }
  });
  await page.evaluateOnNewDocument(
    'navigator.mediaDevices.getUserMedia = navigator.webkitGetUserMedia = navigator.mozGetUserMedia = navigator.getUserMedia = webkitRTCPeerConnection = RTCPeerConnection = MediaStreamTrack = undefined;',
  );
  try { 
    await page.evaluateOnNewDocument(timeZoneScript(ipInfo.timeZone));
  } catch (error) {
    console.error('| Puppeteer | modifyPageInfo | error:', error);
  }
};

// 修改时区脚本，使用动态时区
export const timeZoneScript = (timezone: string) => {
  if (!timezone) {
    console.error('时区参数无效');
    return '';
  }

  return `
  (function() {
    const originalDate = Date;
    const originalDateTimeFormat = Intl.DateTimeFormat;

    // 重写 Intl.DateTimeFormat
    Intl.DateTimeFormat = function(...args) {
      const instance = new originalDateTimeFormat(...args);
      
      // 添加 resolvedOptions 方法
      instance.resolvedOptions = function() {
        return {
          ...new originalDateTimeFormat().resolvedOptions(),
          timeZone: '${timezone}'
        };
      };
      
      return instance;
    };

    // 保持原型链
    Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;

    Date = class extends originalDate {
      constructor(...args) {
        if (args.length === 0) {
          super();
        } else {
          super(...args);
        }
      }

      getTimezoneOffset() {
        const date = new originalDate();
        const timeString = date.toLocaleString('en-US', { timeZone: '${timezone}' });
        const localTime = new originalDate(timeString);
        const utcTime = new originalDate(date.toLocaleString('en-US', { timeZone: 'UTC' }));
        return -(localTime - utcTime) / (60 * 1000);
      }
    }

    const offset = new Date().getTimezoneOffset() * 60 * 1000;
    Date.prototype = originalDate.prototype;
    Date.now = () => new originalDate().getTime() - offset;
  })();
  `;
};