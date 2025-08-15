import { ApiProperty } from '@nestjs/swagger';

export class Result<T = any> {
  @ApiProperty({ description: '状态码，0表示成功，非0表示失败' })
  code: number;

  @ApiProperty({ description: '响应数据' })
  data: T;

  @ApiProperty({ description: '响应消息' })
  message: string;

  @ApiProperty({ description: '响应时间戳' })
  timestamp: string;

  constructor(code: number, data: T, message: string) {
    this.code = code;
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data: T, message = '操作成功'): Result<T> {
    return new Result(0, data, message);
  }

  static error<T = null>(message: string, code = 1, data: T = null): Result<T> {
    return new Result(code, data, message);
  }

  static badRequest<T = null>(message = '请求参数错误', data: T = null): Result<T> {
    return new Result(400, data, message);
  }

  static unauthorized<T = null>(message = '未授权访问', data: T = null): Result<T> {
    return new Result(401, data, message);
  }

  static forbidden<T = null>(message = '权限不足', data: T = null): Result<T> {
    return new Result(403, data, message);
  }

  static notFound<T = null>(message = '资源不存在', data: T = null): Result<T> {
    return new Result(404, data, message);
  }

  static serverError<T = null>(message = '服务器内部错误', data: T = null): Result<T> {
    return new Result(500, data, message);
  }
}

// 分页结果数据结构
export class PaginatedResult<T> {
  @ApiProperty({ description: '当前页数据列表', isArray: true })
  items: T[];

  @ApiProperty({ description: '总记录数' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页限制数量' })
  limit: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;

  @ApiProperty({ description: '是否有下一页' })
  hasNext: boolean;

  @ApiProperty({ description: '是否有上一页' })
  hasPrev: boolean;

  constructor(items: T[], total: number, page: number, limit: number) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrev = page > 1;
  }
}