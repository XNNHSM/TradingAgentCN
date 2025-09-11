import { Injectable } from '@nestjs/common';
import { BusinessLogger, LogCategory } from '../../common/utils/business-logger.util';
import {
  ContentSegmentationConfig,
  ContentSegment,
  SegmentationResult,
  DEFAULT_SEGMENTATION_CONFIG,
  CONTENT_PRIORITIES
} from './content-segmentation.types';

/**
 * 内容分段处理器
 * 智能地将长内容分段以适应不同LLM的长度限制
 */
@Injectable()
export class ContentSegmentationService {
  private readonly logger = new BusinessLogger(ContentSegmentationService.name);

  /**
   * 分段处理内容
   */
  async segmentContent(
    content: string,
    config: Partial<ContentSegmentationConfig> = {}
  ): Promise<SegmentationResult> {
    const finalConfig = { ...DEFAULT_SEGMENTATION_CONFIG, ...config };
    
    this.logger.debug(LogCategory.SERVICE_INFO, '开始内容分段处理', '', {
      contentLength: content.length,
      config: finalConfig
    });

    // 估算token数量
    const estimatedTokens = this.estimateTokens(content);
    
    // 检查是否需要分段
    if (estimatedTokens <= finalConfig.maxInputTokens * (1 - finalConfig.safetyMargin)) {
      this.logger.debug(LogCategory.SERVICE_INFO, '内容长度在限制范围内，无需分段', '', {
        estimatedTokens,
        maxTokens: finalConfig.maxInputTokens
      });
      
      return {
        segments: [{
          id: 'single-segment',
          content,
          metadata: {
            segmentIndex: 0,
            totalSegments: 1,
            priority: 'high',
            contentType: 'full_content',
            charCount: content.length,
            tokenEstimate: estimatedTokens,
            hasContext: false
          }
        }],
        summary: '完整内容，无需分段',
        metadata: {
          totalChars: content.length,
          totalTokens: estimatedTokens,
          segmentCount: 1,
          strategy: 'none',
          truncationRequired: false,
          truncatedContent: ''
        }
      };
    }

    // 执行分段
    const segments = await this.performSegmentation(content, finalConfig);
    
    // 生成分段摘要
    const summary = this.generateSegmentationSummary(segments, finalConfig);
    
    this.logger.debug(LogCategory.SERVICE_INFO, '内容分段完成', '', {
      originalLength: content.length,
      segmentCount: segments.length,
      strategy: finalConfig.strategy
    });

    return {
      segments,
      summary,
      metadata: {
        totalChars: content.length,
        totalTokens: estimatedTokens,
        segmentCount: segments.length,
        strategy: finalConfig.strategy,
        truncationRequired: true,
        truncatedContent: content.length > finalConfig.maxInputChars * 4 ? 
          content.substring(finalConfig.maxInputChars * 4) : ''
      }
    };
  }

  /**
   * 执行内容分段
   */
  private async performSegmentation(
    content: string,
    config: ContentSegmentationConfig
  ): Promise<ContentSegment[]> {
    switch (config.strategy) {
      case 'semantic':
        return this.semanticSegmentation(content, config);
      case 'size':
        return this.sizeBasedSegmentation(content, config);
      case 'hybrid':
      default:
        return this.hybridSegmentation(content, config);
    }
  }

  /**
   * 语义分段 - 基于内容逻辑进行分段
   */
  private semanticSegmentation(
    content: string,
    config: ContentSegmentationConfig
  ): ContentSegment[] {
    const segments: ContentSegment[] = [];
    
    // 识别内容结构
    const sections = this.identifyContentSections(content);
    
    // 按优先级排序
    const prioritizedSections = this.prioritizeSections(sections, config);
    
    // 构建分段
    let currentSegment = '';
    let segmentIndex = 0;
    let currentTokens = 0;
    const maxTokensPerSegment = config.maxInputTokens * (1 - config.safetyMargin);
    
    for (const section of prioritizedSections) {
      const sectionTokens = this.estimateTokens(section.content);
      
      // 如果单个段落超过限制，需要进一步分割
      if (sectionTokens > maxTokensPerSegment) {
        if (currentSegment) {
          segments.push(this.createSegment(currentSegment, segmentIndex++, segments.length, config));
          currentSegment = '';
          currentTokens = 0;
        }
        
        // 对大段落进行智能分割
        const subSegments = this.splitLargeSection(section.content, maxTokensPerSegment);
        for (const subSegment of subSegments) {
          segments.push(this.createSegment(subSegment, segmentIndex++, segments.length, config));
        }
        continue;
      }
      
      // 检查添加当前段落是否会超出限制
      if (currentTokens + sectionTokens > maxTokensPerSegment) {
        if (currentSegment) {
          segments.push(this.createSegment(currentSegment, segmentIndex++, segments.length, config));
          currentSegment = '';
          currentTokens = 0;
        }
      }
      
      currentSegment += section.content + '\n\n';
      currentTokens += sectionTokens;
    }
    
    // 添加最后一个分段
    if (currentSegment) {
      segments.push(this.createSegment(currentSegment, segmentIndex++, segments.length, config));
    }
    
    return segments.slice(0, config.maxSegments);
  }

  /**
   * 基于大小的分段 - 简单按字符数分割
   */
  private sizeBasedSegmentation(
    content: string,
    config: ContentSegmentationConfig
  ): ContentSegment[] {
    const segments: ContentSegment[] = [];
    const maxCharsPerSegment = config.maxInputChars * (1 - config.safetyMargin);
    const chunkSize = Math.floor(maxCharsPerSegment / config.maxSegments);
    
    for (let i = 0; i < config.maxSegments; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, content.length);
      const segmentContent = content.substring(start, end);
      
      if (segmentContent.trim()) {
        segments.push(this.createSegment(segmentContent, i, config.maxSegments, config));
      }
    }
    
    return segments;
  }

  /**
   * 混合分段 - 结合语义和大小策略
   */
  private hybridSegmentation(
    content: string,
    config: ContentSegmentationConfig
  ): ContentSegment[] {
    // 首先尝试语义分段
    const semanticSegments = this.semanticSegmentation(content, config);
    
    // 如果语义分段数量仍然过多，进行优化
    if (semanticSegments.length > config.maxSegments) {
      return this.optimizeSegments(semanticSegments, config);
    }
    
    return semanticSegments;
  }

  /**
   * 识别内容结构
   */
  private identifyContentSections(content: string): Array<{
    type: string;
    content: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const sections: Array<{
      type: string;
      content: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];
    
    // 按段落分割
    const paragraphs = content.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;
      
      // 根据内容判断类型和优先级
      let type = 'general';
      let priority: 'high' | 'medium' | 'low' = 'medium';
      
      // 检查高优先级内容
      if (trimmed.includes('分析请求') || trimmed.includes('股票代码') || trimmed.includes('基本信息')) {
        type = 'analysis_request';
        priority = 'high';
      } else if (trimmed.includes('财务数据') || trimmed.includes('关键指标')) {
        type = 'financial_data';
        priority = 'high';
      } else if (trimmed.includes('技术指标') || trimmed.includes('市场趋势')) {
        type = 'technical_indicators';
        priority = 'medium';
      } else if (trimmed.includes('历史数据') || trimmed.includes('详细记录')) {
        type = 'historical_data';
        priority = 'low';
      }
      
      sections.push({ type, content: trimmed, priority });
    }
    
    return sections;
  }

  /**
   * 按优先级排序段落
   */
  private prioritizeSections(
    sections: Array<{ type: string; content: string; priority: 'high' | 'medium' | 'low' }>,
    config: ContentSegmentationConfig
  ): Array<{ type: string; content: string; priority: 'high' | 'medium' | 'low' }> {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    return sections.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // 相同优先级时，保持原有顺序
      return 0;
    });
  }

  /**
   * 分割大段落
   */
  private splitLargeSection(content: string, maxTokens: number): string[] {
    const segments: string[] = [];
    const sentences = content.split(/[.!?。！？]/);
    let currentSegment = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);
      
      if (currentTokens + sentenceTokens > maxTokens && currentSegment) {
        segments.push(currentSegment.trim());
        currentSegment = '';
        currentTokens = 0;
      }
      
      currentSegment += sentence + (sentence.endsWith('.') ? '' : '.');
      currentTokens += sentenceTokens;
    }
    
    if (currentSegment) {
      segments.push(currentSegment.trim());
    }
    
    return segments;
  }

  /**
   * 创建分段对象
   */
  private createSegment(
    content: string,
    index: number,
    total: number,
    config: ContentSegmentationConfig
  ): ContentSegment {
    const tokens = this.estimateTokens(content);
    
    return {
      id: `segment-${index + 1}`,
      content,
      metadata: {
        segmentIndex: index,
        totalSegments: total,
        priority: index === 0 ? 'high' : 'medium',
        contentType: 'segmented_content',
        charCount: content.length,
        tokenEstimate: tokens,
        hasContext: config.preserveContext && index > 0,
        previousSegmentSummary: index > 0 ? `上一分段内容摘要...` : undefined
      }
    };
  }

  /**
   * 优化分段数量
   */
  private optimizeSegments(
    segments: ContentSegment[],
    config: ContentSegmentationConfig
  ): ContentSegment[] {
    // 如果分段数量超过限制，合并低优先级分段
    if (segments.length <= config.maxSegments) {
      return segments;
    }
    
    const optimizedSegments: ContentSegment[] = [];
    let currentContent = '';
    let currentTokens = 0;
    const maxTokensPerSegment = config.maxInputTokens * (1 - config.safetyMargin);
    
    for (const segment of segments) {
      const segmentTokens = this.estimateTokens(segment.content);
      
      if (currentTokens + segmentTokens > maxTokensPerSegment && currentContent) {
        optimizedSegments.push(this.createSegment(currentContent, optimizedSegments.length, config.maxSegments, config));
        currentContent = '';
        currentTokens = 0;
      }
      
      currentContent += segment.content + '\n\n';
      currentTokens += segmentTokens;
      
      if (optimizedSegments.length >= config.maxSegments - 1) {
        break;
      }
    }
    
    if (currentContent) {
      optimizedSegments.push(this.createSegment(currentContent, optimizedSegments.length, config.maxSegments, config));
    }
    
    return optimizedSegments;
  }

  /**
   * 估算token数量
   */
  private estimateTokens(content: string): number {
    // 简单估算：中文字符按1.5 token，英文按0.25 token
    const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishChars = (content.match(/[a-zA-Z]/g) || []).length;
    const otherChars = content.length - chineseChars - englishChars;
    
    return Math.ceil(chineseChars * 1.5 + englishChars * 0.25 + otherChars * 0.5);
  }

  /**
   * 生成分段处理摘要
   */
  private generateSegmentationSummary(segments: ContentSegment[], config: ContentSegmentationConfig): string {
    const totalTokens = segments.reduce((sum, segment) => sum + segment.metadata.tokenEstimate, 0);
    const avgTokens = Math.round(totalTokens / segments.length);
    
    return `内容已分段处理：共${segments.length}个分段，总计${totalTokens} tokens，平均${avgTokens} tokens/分段。使用${config.strategy}策略，保留${config.preserveContext ? '上下文' : '独立'}处理模式。`;
  }
}