import type { Page } from 'puppeteer';
import { createLogger } from '../../../shared/utils';

const logger = createLogger('TimeZone-Check');

export const checkTimeZoneLeak = async (page: Page, targetTimeZone: string) => {
  try {
    const leaks = await page.evaluate(() => {
      return {
        // 检查时区偏移
        dateOffset: new Date().getTimezoneOffset(),
        
        // 检查 Intl API 返回的时区
        intlTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        
        // 检查日期字符串中的时区信息
        dateString: new Date().toString(),
        
        // 检查语言设置
        language: navigator.language,
        languages: navigator.languages,
        
        // 检查 HTTP 请求头（需要单独处理）
        headers: {
          'accept-language': navigator.languages.join(','),
        },
      };
    });

    // 检查结果分析
    const issues = [];
    
    // 检查时区偏移是否匹配
    const expectedOffset = getExpectedOffset(targetTimeZone);
    if (leaks.dateOffset !== expectedOffset) {
      issues.push(`时区偏移不匹配: 期望 ${expectedOffset}, 实际 ${leaks.dateOffset}`);
    }

    // 检查时区名称
    if (leaks.intlTimeZone !== targetTimeZone) {
      issues.push(`时区名称不匹配: 期望 ${targetTimeZone}, 实际 ${leaks.intlTimeZone}`);
    }

    // 记录检查结果
    if (issues.length > 0) {
      logger.warn('发现时区泄露:', issues);
      return {
        success: false,
        issues,
        leaks,
      };
    }

    return {
      success: true,
      leaks,
    };
    
  } catch (error) {
    logger.error('时区检查失败:', error);
    throw error;
  }
};

// 根据时区计算预期的偏移量
function getExpectedOffset(timeZone: string): number {
  const date = new Date();
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  return (tzDate.getTime() - utcDate.getTime()) / (60 * 1000);
}
 