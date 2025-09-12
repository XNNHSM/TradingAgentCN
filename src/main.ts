import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AnalysisService } from "./modules/analysis/analysis.service";
import { MessageService } from "./modules/message/message.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 3000);
  const apiPrefix = configService.get<string>("API_PREFIX", "api/v1");

  // 设置全局前缀
  app.setGlobalPrefix(apiPrefix);

  // 启用CORS
  app.enableCors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API文档配置
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("TradingAgentCN API")
      .setDescription("基于LLM的智能交易决策系统API文档")
      .setVersion("1.0")
      .addTag("自选股管理", "自选股相关操作接口")
      .addTag("健康检查", "系统健康状态检查")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api-docs", app, document);
  }

  // 注册必要的服务到全局，供Temporal Activity使用
  try {
    const analysisService = app.get(AnalysisService);
    const messageService = app.get(MessageService);
    
    (global as any).analysisService = analysisService;
    (global as any).messageService = messageService;
    
    console.log('✅ 服务已注册到全局，供Temporal Activity使用');
  } catch (error) {
    console.warn('⚠️ 部分服务注册失败，Temporal Activity可能无法正常工作:', error.message);
  }

  await app.listen(port);
  console.log(
    `🚀 TradingAgentCN is running on: http://localhost:${port}/${apiPrefix}`,
  );
  console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
}

bootstrap();
