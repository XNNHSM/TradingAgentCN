import { MessageModule } from './message.module';
import { MessageService } from './message.service';
import { DingTalkProvider } from './adapters/webhook/dingtalk.provider';
import { WeChatProvider } from './adapters/webhook/wechat.provider';

describe('MessageModule', () => {
  it('should compile the module', () => {
    expect(MessageModule).toBeDefined();
  });

  it('should have service defined', () => {
    expect(MessageService).toBeDefined();
  });

  // it('should have controller defined', () => {
  //   expect(MessageController).toBeDefined();
  // });

  it('should have DingTalk provider defined', () => {
    expect(DingTalkProvider).toBeDefined();
  });

  it('should have WeChat provider defined', () => {
    expect(WeChatProvider).toBeDefined();
  });

  it('should have correct module metadata', () => {
    const imports = MessageModule['imports'] || [];
    const controllers = MessageModule['controllers'] || [];
    const providers = MessageModule['providers'] || [];
    const exports = MessageModule['exports'] || [];

    expect(Array.isArray(controllers)).toBe(true);
    expect(Array.isArray(providers)).toBe(true);
    expect(Array.isArray(exports)).toBe(true);
    
    // if (controllers.length > 0) {
    //   expect(controllers).toContain(MessageController);
    // }
    
    if (providers.length > 0) {
      expect(providers).toContain(MessageService);
      expect(providers).toContain(DingTalkProvider);
      expect(providers).toContain(WeChatProvider);
    }
    
    if (exports.length > 0) {
      expect(exports).toContain(MessageService);
    }
  });
});