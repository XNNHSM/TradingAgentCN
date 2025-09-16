import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Watchlist } from "./entities/watchlist.entity";
import { CreateWatchlistDto } from "./dto/create-watchlist.dto";
import { UpdateWatchlistDto } from "./dto/update-watchlist.dto";
import { GetWatchlistDto } from "./dto/get-watchlist.dto";
import { PaginatedResult } from "@/common/dto/result.dto";

@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(Watchlist)
    private readonly watchlistRepository: Repository<Watchlist>,
  ) {}

  /**
   * 获取自选股列表（分页）
   */
  async findAll(dto: GetWatchlistDto): Promise<PaginatedResult<Watchlist>> {
    const { page, limit } = dto;

    // 从数据库查询
    const [items, total] = await this.watchlistRepository.findAndCount({
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResult(items, total, page, limit);
  }

  /**
   * 根据股票代码查找自选股
   */
  async findByStockCode(stockCode: string): Promise<Watchlist | null> {
    // 从数据库查询
    return await this.watchlistRepository.findOne({
      where: { stockCode },
    });
  }

  /**
   * 添加自选股
   */
  async create(dto: CreateWatchlistDto): Promise<Watchlist> {
    // 检查股票代码是否已存在
    const existing = await this.findByStockCode(dto.stockCode);
    if (existing) {
      throw new BadRequestException(
        `股票代码 ${dto.stockCode} 已存在于自选股中`,
      );
    }

    // 验证股票代码格式
    if (!this.isValidStockCode(dto.stockCode)) {
      throw new BadRequestException(
        "股票代码格式不正确，必须是6位数字且符合A股规范",
      );
    }

    // 设置交易所信息
    if (!dto.exchange) {
      dto.exchange = this.getExchangeByStockCode(dto.stockCode);
    }


    // 创建新记录
    const watchlist = this.watchlistRepository.create(dto);
    return await this.watchlistRepository.save(watchlist);
  }

  /**
   * 更新自选股信息
   */
  async update(dto: UpdateWatchlistDto): Promise<Watchlist> {
    const existing = await this.findByStockCode(dto.stockCode);
    if (!existing) {
      throw new NotFoundException(`股票代码 ${dto.stockCode} 不存在于自选股中`);
    }


    // 更新记录
    const updateData = { ...dto };
    delete updateData.stockCode; // 移除股票代码，不允许修改

    await this.watchlistRepository.update(
      { stockCode: dto.stockCode },
      updateData,
    );

    return await this.watchlistRepository.findOne({
      where: { stockCode: dto.stockCode },
    });
  }

  /**
   * 删除自选股
   */
  async remove(stockCode: string): Promise<boolean> {
    const existing = await this.findByStockCode(stockCode);
    if (!existing) {
      throw new NotFoundException(`股票代码 ${stockCode} 不存在于自选股中`);
    }

    // 软删除
    const result = await this.watchlistRepository.softDelete({ stockCode });
    return result.affected > 0;
  }


  /**
   * 验证股票代码是否符合A股规范
   */
  private isValidStockCode(stockCode: string): boolean {
    // A股代码规范：6位数字
    // 600xxx - 上海主板
    // 000xxx, 002xxx - 深圳主板
    // 300xxx - 创业板
    // 688xxx - 科创板
    const pattern = /^(600|000|002|300|688)\d{3}$/;
    return pattern.test(stockCode);
  }

  /**
   * 根据股票代码判断交易所
   */
  private getExchangeByStockCode(stockCode: string): string {
    if (stockCode.startsWith("6")) {
      return "SSE"; // 上海证券交易所
    } else if (stockCode.startsWith("0") || stockCode.startsWith("3")) {
      return "SZSE"; // 深圳证券交易所
    }
    return "UNKNOWN";
  }

  }
