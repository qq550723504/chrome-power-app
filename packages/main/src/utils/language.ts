// 语言映射表
export const COUNTRY_LANG_MAP: Record<string, string> = {
  // 东亚
  'CN': 'zh-CN',  // 中国
  'TW': 'zh-TW',  // 台湾
  'HK': 'zh-HK',  // 香港
  'JP': 'ja-JP',  // 日本
  'KR': 'ko-KR',  // 韩国

  // 英语国家
  'US': 'en-US',  // 美国
  'GB': 'en-GB',  // 英国
  'AU': 'en-AU',  // 澳大利亚
  'CA': 'en-CA',  // 加拿大
  'NZ': 'en-NZ',  // 新西兰
  'IE': 'en-IE',  // 爱尔兰

  // 欧洲
  'DE': 'de-DE',  // 德国
  'FR': 'fr-FR',  // 法国
  'IT': 'it-IT',  // 意大利
  'ES': 'es-ES',  // 西班牙
  'PT': 'pt-PT',  // 葡萄牙
  'RU': 'ru-RU',  // 俄罗斯
  'NL': 'nl-NL',  // 荷兰
  'PL': 'pl-PL',  // 波兰
  'SE': 'sv-SE',  // 瑞典

  // 其他亚洲
  'IN': 'hi-IN',  // 印度
  'TH': 'th-TH',  // 泰国
  'VN': 'vi-VN',  // 越南
  'ID': 'id-ID',  // 印度尼西亚
  'MY': 'ms-MY',  // 马来西亚
  'SG': 'en-SG',  // 新加坡

  // 中东
  'TR': 'tr-TR',  // 土耳其
  'SA': 'ar-SA',  // 沙特阿拉伯
  'AE': 'ar-AE',  // 阿联酋

  // 南美
  'BR': 'pt-BR',  // 巴西
  'MX': 'es-MX',  // 墨西哥
  'AR': 'es-AR',  // 阿根廷
};

/**
 * 根据国家代码获取对应的语言代码
 * @param countryCode - 国家代码(大写)
 * @returns 语言代码,如果没找到对应关系则返回 en-US
 */
export const getLangByCountry = (countryCode: string): string => {
  if (!countryCode) return 'en-US';
  return COUNTRY_LANG_MAP[countryCode.toUpperCase()] || 'en-US';
};
