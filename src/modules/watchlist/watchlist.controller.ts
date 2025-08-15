import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { WatchlistService } from './watchlist.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { UpdateWatchlistDto } from './dto/update-watchlist.dto';
import { DeleteWatchlistDto } from './dto/delete-watchlist.dto';
import { GetWatchlistDto } from './dto/get-watchlist.dto';
import { Result, PaginatedResult } from '@/common/dto/result.dto';
import { Watchlist } from './entities/watchlist.entity';

@ApiTags('自选股管理')
@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Post('list')
  @ApiOperation({ summary: '获取自选股列表' })
  @ApiResponse({ 
    status: 200, 
    description: '自选股列表获取成功', 
    type: Result<PaginatedResult<Watchlist>>
  })
  async getWatchlist(@Body() dto: GetWatchlistDto): Promise<Result<PaginatedResult<Watchlist>>> {
    try {
      const result = await this.watchlistService.findAll(dto);
      return Result.success(result, '自选股列表获取成功');
    } catch (error) {
      return Result.error(error.message);
    }
  }

  @Post('add')
  @ApiOperation({ summary: '添加自选股' })
  @ApiResponse({ 
    status: 200, 
    description: '自选股添加成功', 
    type: Result<Watchlist>
  })
  async addWatchlist(@Body() dto: CreateWatchlistDto): Promise<Result<Watchlist>> {
    try {
      const result = await this.watchlistService.create(dto);
      return Result.success(result, '自选股添加成功');
    } catch (error) {
      if (error.message.includes('已存在')) {
        return Result.badRequest(error.message);
      }
      return Result.error(error.message);
    }
  }

  @Post('update')
  @ApiOperation({ summary: '更新自选股信息' })
  @ApiResponse({ 
    status: 200, 
    description: '自选股更新成功', 
    type: Result<Watchlist>
  })
  async updateWatchlist(@Body() dto: UpdateWatchlistDto): Promise<Result<Watchlist>> {
    try {
      const result = await this.watchlistService.update(dto);
      return Result.success(result, '自选股更新成功');
    } catch (error) {
      if (error.message.includes('不存在')) {
        return Result.notFound(error.message);
      }
      return Result.error(error.message);
    }
  }

  @Post('delete')
  @ApiOperation({ summary: '删除自选股' })
  @ApiResponse({ 
    status: 200, 
    description: '自选股删除成功', 
    type: Result<boolean>
  })
  async deleteWatchlist(@Body() dto: DeleteWatchlistDto): Promise<Result<boolean>> {
    try {
      const result = await this.watchlistService.remove(dto.stockCode);
      return Result.success(result, '自选股删除成功');
    } catch (error) {
      if (error.message.includes('不存在')) {
        return Result.notFound(error.message);
      }
      return Result.error(error.message);
    }
  }

  @Post('holdings')
  @ApiOperation({ summary: '获取持仓的自选股' })
  @ApiResponse({ 
    status: 200, 
    description: '持仓自选股获取成功', 
    type: Result<Watchlist[]>
  })
  async getHoldings(): Promise<Result<Watchlist[]>> {
    try {
      const result = await this.watchlistService.getHoldings();
      return Result.success(result, '持仓自选股获取成功');
    } catch (error) {
      return Result.error(error.message);
    }
  }
}