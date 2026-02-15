import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdvisoryLockService {
  private readonly logger = new Logger(AdvisoryLockService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Hash a string key into a 32-bit integer for use as a pg advisory lock ID.
   */
  static hashKey(key: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = (hash * 0x01000193) | 0;
    }
    return hash;
  }

  /**
   * Try to acquire a transaction-scoped advisory lock and run the callback.
   * If another instance holds the lock, the callback is skipped silently.
   *
   * @param lockId - Numeric lock ID (use AdvisoryLockService.hashKey() for string keys)
   * @param fn - Callback to run while holding the lock
   */
  async withLock(lockId: number, fn: () => Promise<void>): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();
      const [{ locked }] = await queryRunner.query(
        `SELECT pg_try_advisory_xact_lock($1) AS locked`,
        [lockId],
      );

      if (!locked) {
        await queryRunner.commitTransaction();
        return;
      }

      await fn();
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Advisory lock job failed (lockId=${lockId}): ${(error as Error).message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
