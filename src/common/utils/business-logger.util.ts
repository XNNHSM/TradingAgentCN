import { Logger } from '@nestjs/common';

/**
 * 业务日志级别
 */
export enum LogLevel {
  INFO = 'info',
  DEBUG = 'debug',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 业务日志类别
 */
export enum LogCategory {
  HTTP_REQUEST = 'HTTP_REQUEST',
  HTTP_RESPONSE = 'HTTP_RESPONSE',
  HTTP_ERROR = 'HTTP_ERROR',
  SERVICE_INFO = 'SERVICE_INFO',
  SERVICE_ERROR = 'SERVICE_ERROR',
  BUSINESS_ERROR = 'BUSINESS_ERROR',
  API_CALL = 'API_CALL',
  API_SUCCESS = 'API_SUCCESS',
  API_ERROR = 'API_ERROR',
  DATABASE_QUERY = 'DATABASE_QUERY',
  DATABASE_ERROR = 'DATABASE_ERROR',
  AGENT_INFO = 'AGENT_INFO',
  AGENT_ERROR = 'AGENT_ERROR',
}

/**
 * 业务日志数据结构
 */
export interface BusinessLogData {
  category: LogCategory;
  message: string;
  url?: string;
  context?: Record<string, any>;
  duration?: string;
  error?: string;
  stack?: string;
}

/**
 * 业务日志工具类
 * 提供统一的日志记录格式和方法
 */
export class BusinessLogger {
  private readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  /**
   * 记录信息日志
   */
  info(category: LogCategory, message: string, url?: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, {
      category,
      message,
      url,
      context,
    });
  }

  /**
   * 记录调试日志
   */
  debug(category: LogCategory, message: string, url?: string, context?: Record<string, any>): void;
  debug(message: string): void;
  debug(categoryOrMessage: LogCategory | string, message?: string, url?: string, context?: Record<string, any>): void {
    if (typeof categoryOrMessage === 'string') {
      // 简化调用 debug(message)
      this.log(LogLevel.DEBUG, {
        category: LogCategory.SERVICE_INFO,
        message: categoryOrMessage,
      });
    } else {
      // 标准调用 debug(category, message, ...)
      this.log(LogLevel.DEBUG, {
        category: categoryOrMessage,
        message: message!,
        url,
        context,
      });
    }
  }

  /**
   * 记录警告日志
   */
  warn(category: LogCategory, message: string, url?: string, context?: Record<string, any>): void;
  warn(message: string): void;
  warn(categoryOrMessage: LogCategory | string, message?: string, url?: string, context?: Record<string, any>): void {
    if (typeof categoryOrMessage === 'string') {
      // 简化调用 warn(message)
      this.log(LogLevel.WARN, {
        category: LogCategory.SERVICE_ERROR,
        message: categoryOrMessage,
      });
    } else {
      // 标准调用 warn(category, message, ...)
      this.log(LogLevel.WARN, {
        category: categoryOrMessage,
        message: message!,
        url,
        context,
      });
    }
  }

  /**
   * 记录错误日志
   */
  error(
    category: LogCategory,
    message: string,
    error?: Error | string,
    url?: string,
    context?: Record<string, any>
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.log(LogLevel.ERROR, {
      category,
      message,
      url,
      context,
      error: errorMessage,
      stack: errorStack,
    });
  }

  /**
   * 记录API调用日志
   */
  apiCall(
    method: string,
    url: string,
    params?: Record<string, any>,
    headers?: Record<string, string>
  ): void {
    const message = `API调用 ${method} ${url}`;
    const context = {
      ...(params && { params }),
      ...(headers && { headers: this.sanitizeHeaders(headers) })
    };
    this.info(LogCategory.API_CALL, message, url, context);
  }

  /**
   * 记录API成功响应日志
   */
  apiSuccess(
    url: string,
    status: number,
    data?: any,
    duration?: string
  ): void {
    const message = `API调用成功 ${status}`;
    const context = {
      ...(data && { data }),
      ...(duration && { duration })
    };
    this.info(LogCategory.API_SUCCESS, message, url, context);
  }

  /**
   * 记录API错误日志
   */
  apiError(
    url: string,
    error: Error | string,
    status?: number,
    duration?: string
  ): void {
    const message = `API调用失败${status ? ` ${status}` : ''}`;
    const context = {
      ...(status && { status }),
      ...(duration && { duration })
    };
    this.error(LogCategory.API_ERROR, message, error, url, context);
  }

  /**
   * 记录HTTP请求日志
   */
  httpRequest(
    method: string,
    url: string,
    params?: Record<string, any>,
    headers?: Record<string, string>
  ): void {
    const message = `HTTP请求 ${method} ${url}`;
    const context = {
      ...(params && { params }),
      ...(headers && { headers: this.sanitizeHeaders(headers) })
    };
    this.info(LogCategory.HTTP_REQUEST, message, url, context);
  }

  /**
   * 记录HTTP响应日志
   */
  httpResponse(
    url: string,
    status: number,
    data?: any,
    duration?: string
  ): void {
    const message = `HTTP响应 ${status}`;
    const context = {
      ...(data && { data }),
      ...(duration && { duration })
    };
    this.info(LogCategory.HTTP_RESPONSE, message, url, context);
  }

  /**
   * 记录HTTP错误日志
   */
  httpError(
    url: string,
    error: Error | string,
    status?: number,
    duration?: string
  ): void {
    const message = `HTTP请求失败${status ? ` ${status}` : ''}`;
    const context = {
      ...(status && { status }),
      ...(duration && { duration })
    };
    this.error(LogCategory.HTTP_ERROR, message, error, url, context);
  }

  /**
   * 记录业务错误日志
   */
  businessError(
    operation: string,
    error: Error | string,
    context?: Record<string, any>
  ): void {
    const message = `业务操作失败: ${operation}`;
    this.error(LogCategory.BUSINESS_ERROR, message, error, '', context);
  }

  /**
   * 记录服务信息日志
   */
  serviceInfo(message: string, context?: Record<string, any>): void {
    this.info(LogCategory.SERVICE_INFO, message, '', context);
  }

  /**
   * 记录服务错误日志
   */
  serviceError(message: string, error?: Error | string, context?: Record<string, any>): void {
    this.error(LogCategory.SERVICE_ERROR, message, error, '', context);
  }

  /**
   * 统一日志记录方法
   */
  public log(level: LogLevel, data: BusinessLogData): void {
    // 构建简单的日志消息，不使用JSON格式
    let logMessage = `[${data.category}] ${data.message}`;
    
    // 添加URL信息
    if (data.url) {
      logMessage += ` | URL: ${data.url}`;
    }
    
    // 添加持续时间
    if (data.duration) {
      logMessage += ` | Duration: ${data.duration}`;
    }
    
    // 添加错误信息
    if (data.error) {
      logMessage += ` | Error: ${data.error}`;
    }
    
    // 添加上下文信息（简化格式）
    if (data.context && Object.keys(data.context).length > 0) {
      const contextStr = Object.entries(data.context)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(', ');
      logMessage += ` | Context: ${contextStr}`;
    }

    switch (level) {
      case LogLevel.DEBUG:
        this.logger.debug(logMessage);
        break;
      case LogLevel.WARN:
        this.logger.warn(logMessage);
        break;
      case LogLevel.ERROR:
        if (data.stack) {
          this.logger.error(logMessage + `\nStack: ${data.stack}`);
        } else {
          this.logger.error(logMessage);
        }
        break;
      case LogLevel.INFO:
      default:
        this.logger.log(logMessage);
        break;
    }
  }

  /**
   * 清理敏感的请求头信息
   */
  private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
    if (!headers) return undefined;

    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'api-key'];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '***';
      }
      if (sanitized[header.toLowerCase()]) {
        sanitized[header.toLowerCase()] = '***';
      }
    });

    return sanitized;
  }
}