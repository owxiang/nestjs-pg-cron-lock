import {
  Module,
  Global,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ModulesContainer, DiscoveryService } from '@nestjs/core';
import { AdvisoryLockService } from './advisory-lock.service';
import { ADVISORY_LOCK_KEY } from './advisory-lock.constants';

@Global()
@Module({
  providers: [AdvisoryLockService, DiscoveryService],
  exports: [AdvisoryLockService],
})
export class AdvisoryLockModule implements OnModuleInit {
  private readonly logger = new Logger(AdvisoryLockModule.name);

  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly advisoryLockService: AdvisoryLockService,
  ) {}

  onModuleInit() {
    for (const module of this.modulesContainer.values()) {
      for (const wrapper of module.providers.values()) {
        const instance = wrapper.instance;
        if (!instance || typeof instance !== 'object') continue;

        const proto = Object.getPrototypeOf(instance);
        if (!proto) continue;

        const methodNames = Object.getOwnPropertyNames(proto).filter(
          (name) => name !== 'constructor' && typeof proto[name] === 'function',
        );

        for (const methodName of methodNames) {
          const lockId = Reflect.getMetadata(
            ADVISORY_LOCK_KEY,
            proto,
            methodName,
          );

          if (lockId !== undefined) {
            (instance as any).__advisoryLockService = this.advisoryLockService;
            this.logger.log(
              `Registered advisory lock on ${wrapper.name}.${methodName} (lockId=${lockId})`,
            );
            break;
          }
        }
      }
    }
  }
}
