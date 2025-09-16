import { Controller, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { HealthService } from "./health.service";
import { Result } from "@/common/dto/result.dto";

@ApiTags("健康检查")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Post("check")
  @ApiOperation({ summary: "系统健康检查" })
  @ApiResponse({
    status: 200,
    description: "健康检查结果",
    type: Result,
  })
  async check(): Promise<Result> {
    const healthInfo = await this.healthService.getHealthInfo();
    return Result.success(healthInfo, "系统运行正常");
  }

  @Post("database")
  @ApiOperation({ summary: "数据库连接检查" })
  @ApiResponse({
    status: 200,
    description: "数据库连接状态",
    type: Result,
  })
  async checkDatabase(): Promise<Result> {
    const dbStatus = await this.healthService.checkDatabase();
    return Result.success(dbStatus, "数据库连接正常");
  }
}
