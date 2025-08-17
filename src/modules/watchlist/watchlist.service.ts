import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";

import { Watchlist } from "./entities/watchlist.entity";
import { CreateWatchlistDto } from "./dto/create-watchlist.dto";
import { UpdateWatchlistDto } from "./dto/update-watchlist.dto";
import { GetWatchlistDto } from "./dto/get-watchlist.dto";
import { PaginatedResult } from "@/common/dto/result.dto";

@Injectable()
export class WatchlistService {
  private readonly CACHE_PREFIX = "watchlist:";
  private readonly CACHE_TTL = 300; // 5分钟缓存

  constructor(
    @InjectRepository(Watchlist)
    private readonly watchlistRepository: Repository<Watchlist>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * 获取自选股列表（分页）
   */
  async findAll(dto: GetWatchlistDto): Promise<PaginatedResult<Watchlist>> {
    const { page, limit } = dto;
    const cacheKey = `${this.CACHE_PREFIX}list:${page}:${limit}`;

    // 尝试从缓存获取
    const cached =
      await this.cacheManager.get<PaginatedResult<Watchlist>>(cacheKey);
    if (cached) {
      return cached;
    }

    // 从数据库查询
    const [items, total] = await this.watchlistRepository.findAndCount({
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const result = new PaginatedResult(items, total, page, limit);

    // 缓存结果
    await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);

    return result;
  }

  /**
   * 根据股票代码查找自选股
   */
  async findByStockCode(stockCode: string): Promise<Watchlist | null> {
    const cacheKey = `${this.CACHE_PREFIX}${stockCode}`;

    // 尝试从缓存获取
    const cached = await this.cacheManager.get<Watchlist>(cacheKey);
    if (cached) {
      return cached;
    }

    // 从数据库查询
    const watchlist = await this.watchlistRepository.findOne({
      where: { stockCode },
    });

    if (watchlist) {
      // 缓存结果
      await this.cacheManager.set(cacheKey, watchlist, this.CACHE_TTL);
    }

    return watchlist;
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

    // 验证持仓信息的一致性
    if (dto.isHolding && (dto.holdingQuantity <= 0 || dto.holdingPrice <= 0)) {
      throw new BadRequestException("持仓状态下，持仓数量和价格必须大于0");
    }

    // 创建新记录
    const watchlist = this.watchlistRepository.create(dto);
    const saved = await this.watchlistRepository.save(watchlist);

    // 清除相关缓存
    await this.clearCache();

    return saved;
  }

  /**
   * 更新自选股信息
   */
  async update(dto: UpdateWatchlistDto): Promise<Watchlist> {
    const existing = await this.findByStockCode(dto.stockCode);
    if (!existing) {
      throw new NotFoundException(`股票代码 ${dto.stockCode} 不存在于自选股中`);
    }

    // 验证持仓信息的一致性
    const isHolding =
      dto.isHolding !== undefined ? dto.isHolding : existing.isHolding;
    const holdingQuantity =
      dto.holdingQuantity !== undefined
        ? dto.holdingQuantity
        : existing.holdingQuantity;
    const holdingPrice =
      dto.holdingPrice !== undefined ? dto.holdingPrice : existing.holdingPrice;

    if (isHolding && (holdingQuantity <= 0 || holdingPrice <= 0)) {
      throw new BadRequestException("持仓状态下，持仓数量和价格必须大于0");
    }

    // 更新记录
    const updateData = { ...dto };
    delete updateData.stockCode; // 移除股票代码，不允许修改

    await this.watchlistRepository.update(
      { stockCode: dto.stockCode },
      updateData,
    );

    const updated = await this.watchlistRepository.findOne({
      where: { stockCode: dto.stockCode },
    });

    // 清除相关缓存
    await this.clearCache(dto.stockCode);

    return updated;
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

    // 清除相关缓存
    await this.clearCache(stockCode);

    return result.affected > 0;
  }

  /**
   * 获取持仓的自选股
   */
  async getHoldings(): Promise<Watchlist[]> {
    const cacheKey = `${this.CACHE_PREFIX}holdings`;

    // 尝试从缓存获取
    const cached = await this.cacheManager.get<Watchlist[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // 从数据库查询
    const holdings = await this.watchlistRepository.find({
      where: { isHolding: true },
      order: { createdAt: "DESC" },
    });

    // 缓存结果
    await this.cacheManager.set(cacheKey, holdings, this.CACHE_TTL);

    return holdings;
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

  /**
   * 清除相关缓存
   */
  private async clearCache(stockCode?: string): Promise<void> {
    const keys = [`${this.CACHE_PREFIX}holdings`];

    if (stockCode) {
      keys.push(`${this.CACHE_PREFIX}${stockCode}`);
    }

    // 清除列表缓存（需要清除所有分页的缓存）
    // 这里简化处理，实际生产环境可以使用模式匹配删除
    for (let page = 1; page <= 10; page++) {
      for (let limit = 10; limit <= 100; limit += 10) {
        keys.push(`${this.CACHE_PREFIX}list:${page}:${limit}`);
      }
    }

    await Promise.all(keys.map((key) => this.cacheManager.del(key)));
  }
}
