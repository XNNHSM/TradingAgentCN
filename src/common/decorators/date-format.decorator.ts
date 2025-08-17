import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from "class-validator";
import { DateTimeUtil } from "../utils/date-time.util";

/**
 * 验证日期格式为 YYYY-MM-dd
 */
export function IsDateFormat(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "isDateFormat",
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: `${propertyName} 必须是有效的日期格式 YYYY-MM-dd (如: 2025-08-16)`,
        ...validationOptions,
      },
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== "string") {
            return false;
          }

          try {
            DateTimeUtil.parseDate(value);
            return true;
          } catch (error) {
            return false;
          }
        },
      },
    });
  };
}

/**
 * 验证日期时间格式为 YYYY-MM-dd HH:mm:ss
 */
export function IsDateTimeFormat(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "isDateTimeFormat",
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: `${propertyName} 必须是有效的日期时间格式 YYYY-MM-dd HH:mm:ss (如: 2025-08-16 14:30:25)`,
        ...validationOptions,
      },
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== "string") {
            return false;
          }

          try {
            DateTimeUtil.parseDateTime(value);
            return true;
          } catch (error) {
            return false;
          }
        },
      },
    });
  };
}
