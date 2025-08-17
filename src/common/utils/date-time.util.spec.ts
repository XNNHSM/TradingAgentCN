import { DateTimeUtil } from "./date-time.util";

describe("DateTimeUtil", () => {
  describe("日期格式验证", () => {
    it("应该正确验证有效的日期格式", () => {
      expect(DateTimeUtil.isValidDateFormat("2025-08-16")).toBe(true);
      expect(DateTimeUtil.isValidDateFormat("2024-02-29")).toBe(true); // 闰年
      expect(DateTimeUtil.isValidDateFormat("2023-12-31")).toBe(true);
    });

    it("应该拒绝无效的日期格式", () => {
      expect(DateTimeUtil.isValidDateFormat("2025/08/16")).toBe(false);
      expect(DateTimeUtil.isValidDateFormat("25-08-16")).toBe(false);
      expect(DateTimeUtil.isValidDateFormat("2025-8-16")).toBe(false);
      expect(DateTimeUtil.isValidDateFormat("2025-08-6")).toBe(false);
      expect(DateTimeUtil.isValidDateFormat("")).toBe(false);
      expect(DateTimeUtil.isValidDateFormat(null as any)).toBe(false);
      expect(DateTimeUtil.isValidDateFormat(undefined as any)).toBe(false);
    });
  });

  describe("日期时间格式验证", () => {
    it("应该正确验证有效的日期时间格式", () => {
      expect(DateTimeUtil.isValidDateTimeFormat("2025-08-16 14:30:25")).toBe(
        true,
      );
      expect(DateTimeUtil.isValidDateTimeFormat("2025-01-01 00:00:00")).toBe(
        true,
      );
      expect(DateTimeUtil.isValidDateTimeFormat("2025-12-31 23:59:59")).toBe(
        true,
      );
    });

    it("应该拒绝无效的日期时间格式", () => {
      expect(DateTimeUtil.isValidDateTimeFormat("2025-08-16 14:30")).toBe(
        false,
      );
      expect(
        DateTimeUtil.isValidDateTimeFormat("2025-08-16 14:30:25:123"),
      ).toBe(false);
      expect(DateTimeUtil.isValidDateTimeFormat("2025-08-16T14:30:25")).toBe(
        false,
      );
      expect(DateTimeUtil.isValidDateTimeFormat("")).toBe(false);
    });
  });

  describe("日期解析", () => {
    it("应该正确解析有效日期", () => {
      const date1 = DateTimeUtil.parseDate("2025-08-16");
      expect(date1.getFullYear()).toBe(2025);
      expect(date1.getMonth()).toBe(7); // 0-based
      expect(date1.getDate()).toBe(16);

      const date2 = DateTimeUtil.parseDate("2024-02-29"); // 闰年
      expect(date2.getFullYear()).toBe(2024);
      expect(date2.getMonth()).toBe(1);
      expect(date2.getDate()).toBe(29);
    });

    it("应该拒绝无效日期", () => {
      expect(() => DateTimeUtil.parseDate("2025-02-30")).toThrow("日期不存在");
      expect(() => DateTimeUtil.parseDate("2025-13-01")).toThrow(
        "月份超出有效范围",
      );
      expect(() => DateTimeUtil.parseDate("2025-00-01")).toThrow(
        "月份超出有效范围",
      );
      expect(() => DateTimeUtil.parseDate("2025-08-32")).toThrow(
        "日期超出有效范围",
      );
      expect(() => DateTimeUtil.parseDate("1899-08-16")).toThrow(
        "年份超出有效范围",
      );
      expect(() => DateTimeUtil.parseDate("2101-08-16")).toThrow(
        "年份超出有效范围",
      );
    });

    it("应该拒绝无效格式", () => {
      expect(() => DateTimeUtil.parseDate("2025/08/16")).toThrow(
        "日期格式必须为",
      );
      expect(() => DateTimeUtil.parseDate("25-08-16")).toThrow(
        "日期格式必须为",
      );
      expect(() => DateTimeUtil.parseDate("")).toThrow("日期格式必须为");
    });
  });

  describe("日期时间解析", () => {
    it("应该正确解析有效日期时间", () => {
      const dateTime = DateTimeUtil.parseDateTime("2025-08-16 14:30:25");
      expect(dateTime.getFullYear()).toBe(2025);
      expect(dateTime.getMonth()).toBe(7);
      expect(dateTime.getDate()).toBe(16);
      expect(dateTime.getHours()).toBe(14);
      expect(dateTime.getMinutes()).toBe(30);
      expect(dateTime.getSeconds()).toBe(25);
    });

    it("应该拒绝无效时间", () => {
      expect(() => DateTimeUtil.parseDateTime("2025-08-16 24:00:00")).toThrow(
        "小时超出有效范围",
      );
      expect(() => DateTimeUtil.parseDateTime("2025-08-16 14:60:00")).toThrow(
        "分钟超出有效范围",
      );
      expect(() => DateTimeUtil.parseDateTime("2025-08-16 14:30:60")).toThrow(
        "秒超出有效范围",
      );
    });
  });

  describe("日期格式化", () => {
    it("应该正确格式化日期", () => {
      const date = new Date(2025, 7, 16); // 注意月份是0-based
      expect(DateTimeUtil.formatDate(date)).toBe("2025-08-16");

      const date2 = new Date(2025, 0, 1);
      expect(DateTimeUtil.formatDate(date2)).toBe("2025-01-01");
    });

    it("应该正确格式化日期时间", () => {
      const dateTime = new Date(2025, 7, 16, 14, 30, 25);
      expect(DateTimeUtil.formatDateTime(dateTime)).toBe("2025-08-16 14:30:25");

      const dateTime2 = new Date(2025, 0, 1, 0, 0, 0);
      expect(DateTimeUtil.formatDateTime(dateTime2)).toBe(
        "2025-01-01 00:00:00",
      );
    });
  });

  describe("获取当前日期时间", () => {
    it("应该返回正确格式的当前日期", () => {
      const currentDate = DateTimeUtil.getCurrentDate();
      expect(DateTimeUtil.isValidDateFormat(currentDate)).toBe(true);
    });

    it("应该返回正确格式的当前日期时间", () => {
      const currentDateTime = DateTimeUtil.getCurrentDateTime();
      expect(DateTimeUtil.isValidDateTimeFormat(currentDateTime)).toBe(true);
    });
  });

  describe("安全解析（带默认值）", () => {
    it("应该在解析失败时返回当前日期", () => {
      const result = DateTimeUtil.safeParseDateWithDefault("invalid-date");
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeCloseTo(new Date().getTime(), -3); // 允许少量时间差
    });

    it("应该在解析失败时返回当前时间", () => {
      const result =
        DateTimeUtil.safeParseDateTimeWithDefault("invalid-datetime");
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeCloseTo(new Date().getTime(), -3);
    });

    it("应该在解析成功时返回正确日期", () => {
      const result = DateTimeUtil.safeParseDateWithDefault("2025-08-16");
      expect(DateTimeUtil.formatDate(result)).toBe("2025-08-16");
    });
  });

  describe("边界条件测试", () => {
    it("应该正确处理闰年", () => {
      // 2024年是闰年
      const leapYear = DateTimeUtil.parseDate("2024-02-29");
      expect(leapYear.getDate()).toBe(29);

      // 2023年不是闰年
      expect(() => DateTimeUtil.parseDate("2023-02-29")).toThrow("日期不存在");
    });

    it("应该正确处理月份天数", () => {
      // 1月有31天
      const jan31 = DateTimeUtil.parseDate("2025-01-31");
      expect(jan31.getDate()).toBe(31);

      // 4月只有30天
      expect(() => DateTimeUtil.parseDate("2025-04-31")).toThrow("日期不存在");

      // 2月只有28天（非闰年）
      expect(() => DateTimeUtil.parseDate("2025-02-29")).toThrow("日期不存在");
    });
  });
});
