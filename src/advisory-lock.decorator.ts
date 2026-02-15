import { SetMetadata } from '@nestjs/common';
import { ADVISORY_LOCK_KEY } from './advisory-lock.constants';
import { AdvisoryLockService } from './advisory-lock.service';

/**
 * Wraps a method with a PostgreSQL advisory lock. When multiple instances
 * are running, only one will execute the method body. The rest skip silently.
 *
 * @param key - A string key (auto-hashed to a lock ID) or a numeric lock ID
 *
 * @example
 * ```ts
 * @Cron(CronExpression.EVERY_MINUTE)
 * @WithAdvisoryLock('process-pending-orders')
 * async processPendingOrders() {
 *   // only one instance runs this
 * }
 * ```
 */
export function WithAdvisoryLock(key: string | number): MethodDecorator {
  const lockId = typeof key === 'string' ? AdvisoryLockService.hashKey(key) : key;

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) => {
    SetMetadata(ADVISORY_LOCK_KEY, lockId)(target, propertyKey, descriptor);

    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const advisoryLockService: AdvisoryLockService | undefined =
        this.__advisoryLockService;

      if (!advisoryLockService) {
        return originalMethod.apply(this, args);
      }

      await advisoryLockService.withLock(lockId, () =>
        originalMethod.apply(this, args),
      );
    };

    return descriptor;
  };
}
