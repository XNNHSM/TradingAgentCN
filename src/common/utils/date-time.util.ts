/**
 * 日期时间工具类
 * 统一项目中的日期时间格式处理
 */

export class DateTimeUtil {
  /** 标准日期格式 YYYY-MM-dd */
  static readonly DATE_FORMAT = "YYYY-MM-dd";

  /** 标准日期时间格式 YYYY-MM-dd HH:mm:ss */
  static readonly DATETIME_FORMAT = "YYYY-MM-dd HH:mm:ss";

  /** 日期格式正则表达式 */
  private static readonly DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  /** 日期时间格式正则表达式 */
  private static readonly DATETIME_REGEX =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

  /**
   * 验证日期格式 YYYY-MM-dd
   */
  static isValidDateFormat(dateString: string): boolean {
    if (!dateString || typeof dateString !== "string") {
      return false;
    }
    return this.DATE_REGEX.test(dateString);
  }

  /**
   * 验证日期时间格式 YYYY-MM-dd HH:mm:ss
   */
  static isValidDateTimeFormat(dateTimeString: string): boolean {
    if (!dateTimeString || typeof dateTimeString !== "string") {
      return false;
    }
    return this.DATETIME_REGEX.test(dateTimeString);
  }

  /**
   * 解析日期字符串为 Date 对象
   * 严格按照 YYYY-MM-dd 格式
   */
  static parseDate(dateString: string): Date {
    if (!this.isValidDateFormat(dateString)) {
      throw new Error(
        `日期格式必须为 ${this.DATE_FORMAT}，当前格式: ${dateString}`,
      );
    }

    const [year, month, day] = dateString.split("-").map(Number);

    // 验证日期范围
    if (year < 1900 || year > 2100) {
      throw new Error(`年份超出有效范围 (1900-2100): ${year}`);
    }
    if (month < 1 || month > 12) {
      throw new Error(`月份超出有效范围 (1-12): ${month}`);
    }
    if (day < 1 || day > 31) {
      throw new Error(`日期超出有效范围 (1-31): ${day}`);
    }

    const date = new Date(year, month - 1, day);

    // 验证日期是否真实存在
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new Error(`日期不存在: ${dateString}`);
    }

    return date;
  }

  /**
   * 解析日期时间字符串为 Date 对象
   * 严格按照 YYYY-MM-dd HH:mm:ss 格式
   */
  static parseDateTime(dateTimeString: string): Date {
    if (!this.isValidDateTimeFormat(dateTimeString)) {
      throw new Error(
        `日期时间格式必须为 ${this.DATETIME_FORMAT}，当前格式: ${dateTimeString}`,
      );
    }

    const [datePart, timePart] = dateTimeString.split(" ");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second] = timePart.split(":").map(Number);

    // 验证日期范围
    if (year < 1900 || year > 2100) {
      throw new Error(`年份超出有效范围 (1900-2100): ${year}`);
    }
    if (month < 1 || month > 12) {
      throw new Error(`月份超出有效范围 (1-12): ${month}`);
    }
    if (day < 1 || day > 31) {
      throw new Error(`日期超出有效范围 (1-31): ${day}`);
    }
    if (hour < 0 || hour > 23) {
      throw new Error(`小时超出有效范围 (0-23): ${hour}`);
    }
    if (minute < 0 || minute > 59) {
      throw new Error(`分钟超出有效范围 (0-59): ${minute}`);
    }
    if (second < 0 || second > 59) {
      throw new Error(`秒超出有效范围 (0-59): ${second}`);
    }

    const date = new Date(year, month - 1, day, hour, minute, second);
    return date;
  }

  /**
   * 将 Date 对象格式化为 YYYY-MM-dd 字符串
   */
  static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * 将 Date 对象格式化为 YYYY-MM-dd HH:mm:ss 字符串
   */
  static formatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  /**
   * 获取当前日期字符串 YYYY-MM-dd
   */
  static getCurrentDate(): string {
    return this.formatDate(new Date());
  }

  /**
   * 获取当前日期时间字符串 YYYY-MM-dd HH:mm:ss
   */
  static getCurrentDateTime(): string {
    return this.formatDateTime(new Date());
  }

  /**
   * 安全解析日期，失败时返回当前日期
   */
  static safeParseDateWithDefault(dateString: string): Date {
    try {
      return this.parseDate(dateString);
    } catch (error) {
      // 在测试环境中不输出警告，避免干扰测试输出
      if (process.env.NODE_ENV !== "test") {
        console.warn(`日期解析失败，使用当前日期: ${error.message}`);
      }
      return new Date();
    }
  }

  /**
   * 安全解析日期时间，失败时返回当前时间
   */
  static safeParseDateTimeWithDefault(dateTimeString: string): Date {
    try {
      return this.parseDateTime(dateTimeString);
    } catch (error) {
      // 在测试环境中不输出警告，避免干扰测试输出
      if (process.env.NODE_ENV !== "test") {
        console.warn(`日期时间解析失败，使用当前时间: ${error.message}`);
      }
      return new Date();
    }
  }

  /**
   * 验证日期字符串是否有效（兼容 isValidDateFormat）
   */
  static isValidDate(dateString: string): boolean {
    return this.isValidDateFormat(dateString);
  }

  /**
   * 计算两个日期之间的天数差
   */
  static getDaysDifference(startDate: string, endDate: string): number {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
