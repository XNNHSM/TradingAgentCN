# News Module - 新闻爬虫模块

新闻模块提供了一个基于抽象工厂模式的新闻爬虫系统，专注于从多个权威新闻源自动采集新闻数据。

## 🎯 核心特性

- **🏭 抽象工厂模式**: 支持不同新闻源的统一接口，便于扩展
- **📰 多数据源支持**: 内置经济日报、新华每日电讯、新闻联播三大权威媒体
- **🌍 地域标记**: 自动标记新闻为国内或国外来源
- **🔄 智能去重**: 基于URL的新闻去重机制，避免重复存储
- **📅 日期范围爬取**: 灵活指定起止日期进行批量采集
- **⚡ 并发处理**: 多数据源并发爬取，大幅提升采集效率
- **📊 详细反馈**: 提供每个数据源的爬取结果统计和错误信息
- **🛡️ 错误容错**: 单个源失败不影响其他源的正常工作

## 📰 支持的新闻源

| 新闻源代码 | 新闻源名称 | 描述 | 地域 |
|-----------|------------|------|------|
| `jjrb` | 经济日报 | 国家级经济类权威报纸，专注经济政策和商业资讯 | 🇨🇳 国内 |
| `xhmrdx` | 新华每日电讯 | 新华社发行的综合性日报，权威时政新闻 | 🇨🇳 国内 |
| `xwlb` | 新闻联播 | 央视新闻联播，国家重要新闻发布平台 | 🇨🇳 国内 |

## 🔗 API 接口文档

### 📥 新闻爬取接口

#### 1. 批量爬取新闻数据

**接口地址：** `POST /news/crawl`

**功能描述：** 根据指定的日期范围和数据源批量爬取新闻数据，支持并发处理多个数据源。

**请求参数：**
```typescript
{
  startDate: string;    // 开始日期，格式：YYYY-MM-DD
  endDate: string;      // 结束日期，格式：YYYY-MM-DD  
  sources?: string[];   // 可选，指定数据源数组，不传则爬取所有源
}
```

**请求示例：**
```http
POST /news/crawl
Content-Type: application/json

{
  "startDate": "2025-08-01",
  "endDate": "2025-08-21",
  "sources": ["jjrb", "xhmrdx"]
}
```

**响应格式：**
```json
{
  "code": 0,
  "message": "操作成功",
  "data": {
    "totalCrawled": 156,
    "sourceResults": [
      {
        "source": "jjrb",
        "count": 45,
        "success": true
      },
      {
        "source": "xhmrdx", 
        "count": 67,
        "success": true
      },
      {
        "source": "xwlb",
        "count": 44,
        "success": true
      }
    ]
  },
  "timestamp": "2025-08-21T10:30:00.000Z"
}
```

**响应字段说明：**
- `totalCrawled`: 总共成功爬取的新闻数量
- `sourceResults`: 各数据源的详细结果
  - `source`: 数据源代码
  - `count`: 该数据源爬取的新闻数量
  - `success`: 是否成功
  - `error`: 失败时的错误信息（可选）

#### 2. 获取支持的数据源

**接口地址：** `POST /news/supported-sources`

**功能描述：** 获取当前系统支持的所有新闻数据源列表。

**请求示例：**
```http
POST /news/supported-sources
Content-Type: application/json
```

**响应示例：**
```json
{
  "code": 0,
  "message": "操作成功", 
  "data": ["jjrb", "xhmrdx", "xwlb"],
  "timestamp": "2025-08-21T10:30:00.000Z"
}
```

## 🗄️ 数据库设计

### 表结构 (PostgreSQL)

```sql
CREATE TABLE raw_news (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  url VARCHAR(2048) NOT NULL UNIQUE,
  source_code VARCHAR(50) NOT NULL,
  source_name VARCHAR(50),
  news_date DATE NOT NULL,
  analyzed BOOLEAN DEFAULT FALSE,
  region VARCHAR(20) DEFAULT 'domestic' CHECK (region IN ('domestic', 'international')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  version INT DEFAULT 1
);

-- 创建索引
CREATE INDEX idx_raw_news_news_date ON raw_news (news_date);
CREATE INDEX idx_raw_news_analyzed ON raw_news (analyzed);  
CREATE INDEX idx_raw_news_news_date_analyzed ON raw_news (news_date, analyzed);
CREATE INDEX idx_raw_news_region ON raw_news (region);
```

### 字段说明

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | BIGSERIAL | 主键ID，自增 | PRIMARY KEY |
| `title` | VARCHAR(500) | 新闻标题 | NOT NULL |
| `content` | TEXT | 新闻正文内容 | NOT NULL |
| `url` | VARCHAR(2048) | 新闻原链接 | NOT NULL, UNIQUE |
| `source_code` | VARCHAR(50) | 数据源代码 (jjrb/xhmrdx/xwlb) | NOT NULL |
| `source_name` | VARCHAR(50) | 数据源名称 | - |
| `news_date` | DATE | 新闻发布日期 | NOT NULL |
| `analyzed` | BOOLEAN | 是否已分析 | DEFAULT FALSE |
| `region` | VARCHAR(20) | 地域标记 (domestic/international) | DEFAULT 'domestic' |
| `created_at` | TIMESTAMP | 创建时间 | NOT NULL |
| `updated_at` | TIMESTAMP | 更新时间 | NOT NULL |
| `deleted_at` | TIMESTAMP | 软删除时间 | NULL |
| `version` | INT | 版本号（乐观锁） | DEFAULT 1 |

## ⚙️ 环境配置

### 数据源配置

在 `.env` 文件中配置各新闻源的基础URL和代码：

```bash
# 经济日报配置
CRAWLER_JJRB_BASE_URL=https://paper.ce.cn/pc
CRAWLER_JJRB_CODE=jjrb

# 新华每日电讯配置  
CRAWLER_XHMRDX_BASE_URL=https://mrdx.cn
CRAWLER_XHMRDX_CODE=xhmrdx

# 新闻联播配置
CRAWLER_XWLB_BASE_URL=https://tv.cctv.com/lm/xwlb
CRAWLER_XWLB_CODE=xwlb
```

### 数据库配置

确保 PostgreSQL 数据库连接配置正确：

```bash
# 数据库配置
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
DATABASE_NAME=trading_agent_cn
DATABASE_SSL=false
DATABASE_SYNCHRONIZE=true  # 开发环境使用，生产环境请设为false
```

## 🔧 扩展新数据源

### 快速添加新数据源

按以下步骤可快速扩展新的新闻数据源：

#### 1️⃣ 创建爬虫服务类

```typescript
// src/modules/news/crawlers/sina-finance-crawler.service.ts
@Injectable()
export class SinaFinanceCrawlerService extends AbstractNewsCrawlerService {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  getSourceCode(): string {
    return 'sina_finance';
  }

  getSourceName(): string {
    return '新浪财经';
  }

  getRegion(): NewsRegion {
    return NewsRegion.DOMESTIC;
  }

  async getTargetUrls(date: string): Promise<string[]> {
    // 实现获取目标URL逻辑
  }

  async getDocument(url: string): Promise<string> {
    // 实现网页内容获取
  }

  protected extractTitle(document: string): string | null {
    // 实现标题提取逻辑
  }

  protected extractContent(document: string): string | null {
    // 实现内容提取逻辑
  }
}
```

#### 2️⃣ 更新枚举和工厂

```typescript
// 在 interfaces/news-crawler-factory.interface.ts 中添加
export enum NewsSource {
  JJRB = 'jjrb',
  XHMRDX = 'xhmrdx', 
  XWLB = 'xwlb',
  SINA_FINANCE = 'sina_finance',  // 新增
}

// 在 factories/news-crawler.factory.ts 中添加
createCrawler(source: NewsSource): AbstractNewsCrawlerService {
  switch (source) {
    case NewsSource.JJRB:
      return this.jjrbCrawlerService;
    case NewsSource.XHMRDX:
      return this.xhmrdxCrawlerService;
    case NewsSource.XWLB:
      return this.xwlbCrawlerService;
    case NewsSource.SINA_FINANCE:  // 新增
      return this.sinaFinanceCrawlerService;
    default:
      throw new Error(`Unsupported news source: ${source}`);
  }
}
```

#### 3️⃣ 注册到模块

```typescript
// 在 news.module.ts 中添加
@Module({
  imports: [TypeOrmModule.forFeature([RawNews]), ConfigModule],
  controllers: [NewsController],
  providers: [
    NewsService,
    NewsCrawlerFactory,
    JJRBCrawlerService,
    XHMRDXCrawlerService,
    XWLBCrawlerService,
    SinaFinanceCrawlerService,  // 新增
  ],
  exports: [NewsService, NewsCrawlerFactory],
})
export class NewsModule {}
```

#### 4️⃣ 添加配置

```bash
# 在 .env 中添加配置
CRAWLER_SINA_FINANCE_BASE_URL=https://finance.sina.com.cn
CRAWLER_SINA_FINANCE_CODE=sina_finance
```

## 💻 使用示例

### 服务端调用

```typescript
import { NewsService } from './modules/news/news.service';

@Injectable()
export class MyService {
  constructor(private readonly newsService: NewsService) {}

  // 爬取所有数据源的新闻（最近一周）
  async crawlAllSources() {
    const result = await this.newsService.crawlNewsWithSources({
      startDate: '2025-08-15',
      endDate: '2025-08-21'
      // sources 不传，默认爬取所有数据源
    });
    
    console.log(`总共爬取: ${result.data.totalCrawled} 条新闻`);
    return result;
  }

  // 爬取指定数据源的新闻
  async crawlSpecificSources() {
    const result = await this.newsService.crawlNewsWithSources({
      startDate: '2025-08-21',
      endDate: '2025-08-21',
      sources: ['jjrb', 'xhmrdx']
    });
    
    return result;
  }

  // 获取支持的数据源
  async getSources() {
    return await this.newsService.getSupportedSources();
  }
}
```

### 客户端调用 (HTTP)

```bash
# 爬取所有数据源的新闻
curl -X POST http://localhost:3000/news/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-08-15",
    "endDate": "2025-08-21"
  }'

# 爬取指定数据源的新闻
curl -X POST http://localhost:3000/news/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-08-21", 
    "endDate": "2025-08-21",
    "sources": ["jjrb", "xhmrdx"]
  }'

# 获取支持的数据源
curl -X POST http://localhost:3000/news/supported-sources \
  -H "Content-Type: application/json"
```

### 定时任务示例

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NewsScheduleService {
  constructor(private readonly newsService: NewsService) {}

  // 每天早上8点自动爬取昨日新闻
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async dailyNewsCrawl() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    await this.newsService.crawlNewsWithSources({
      startDate: dateStr,
      endDate: dateStr
    });
  }
}

```

## ⚠️ 注意事项

### 🚀 性能优化
- **并发处理**: 多数据源并发爬取，提升整体效率
- **请求延迟**: 默认每次请求间隔1秒，避免对目标网站造成压力
- **连接池**: 使用HTTP连接池，减少连接开销

### 🛡️ 错误处理
- **容错机制**: 单个数据源失败不影响其他源的正常工作
- **重试机制**: 内置网络请求重试逻辑
- **详细日志**: 完整记录每个步骤的成功/失败状态

### 📊 数据管理
- **智能去重**: 基于URL自动去重，避免重复存储相同新闻
- **软删除**: 删除操作为软删除，保留历史数据便于审计
- **版本控制**: 支持乐观锁，防止并发更新冲突

### 🔧 开发建议
- **日志规范**: 遵循项目统一的JSON格式日志标准
- **环境隔离**: 开发/测试/生产环境使用不同的数据源配置
- **监控告警**: 建议对爬取失败率进行监控和告警

### 🔒 安全考虑
- **请求头伪装**: 使用真实浏览器请求头避免被反爬虫
- **IP限制**: 注意目标网站的访问频率限制
- **robots.txt**: 遵守目标网站的robots.txt协议

### 📈 扩展性
- **水平扩展**: 支持部署多个实例进行负载均衡
- **数据源扩展**: 基于抽象工厂模式，便于添加新的数据源
- **存储扩展**: 支持分表分库，应对大数据量存储需求