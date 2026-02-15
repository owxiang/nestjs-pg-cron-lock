# nestjs-pg-cron-lock

Distributed cron job locking for NestJS using PostgreSQL advisory locks. Ensures only one instance runs a cron job across multiple servers. No Redis required.

## The Problem

When running multiple instances of a NestJS app (e.g. behind a load balancer), every instance executes every `@Cron()` job. This means duplicate emails, double-processing, and race conditions.

**Without this package**, you write this in every service:

```ts
@Cron(CronExpression.EVERY_MINUTE)
async processOrders() {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    await queryRunner.startTransaction();
    const [{ locked }] = await queryRunner.query(
      `SELECT pg_try_advisory_xact_lock($1) AS locked`,
      [839271],
    );
    if (!locked) {
      await queryRunner.commitTransaction();
      return;
    }
    // ... actual business logic ...
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
  } finally {
    await queryRunner.release();
  }
}
```

**With this package**, one decorator:

```ts
@Cron(CronExpression.EVERY_MINUTE)
@WithAdvisoryLock('process-orders')
async processOrders() {
  // just your business logic
}
```

## Installation

```bash
npm install nestjs-pg-cron-lock
```

## Setup

Import `AdvisoryLockModule` in your root module. It auto-discovers the TypeORM `DataSource` from your app:

```ts
import { AdvisoryLockModule } from 'nestjs-pg-cron-lock';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ... }),
    AdvisoryLockModule,
  ],
})
export class AppModule {}
```

## Usage

### Decorator (recommended)

Add `@WithAdvisoryLock()` to any method, typically alongside `@Cron()`:

```ts
import { Cron, CronExpression } from '@nestjs/schedule';
import { WithAdvisoryLock } from 'nestjs-pg-cron-lock';

@Injectable()
export class OrdersService {
  @Cron(CronExpression.EVERY_MINUTE)
  @WithAdvisoryLock('process-pending-orders')
  async processPendingOrders() {
    // Only one instance runs this, even with 10 replicas
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  @WithAdvisoryLock('send-reminder-emails')
  async sendReminderEmails() {
    // Same here, no duplicates
  }
}
```

String keys are auto-hashed to PostgreSQL lock IDs. You can also pass a numeric ID directly:

```ts
@WithAdvisoryLock(839271)  // explicit lock ID
```

### Programmatic

For more control, inject `AdvisoryLockService` directly:

```ts
import { AdvisoryLockService } from 'nestjs-pg-cron-lock';

@Injectable()
export class PaymentsService {
  constructor(private readonly advisoryLockService: AdvisoryLockService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPayments() {
    await this.advisoryLockService.withLock(
      AdvisoryLockService.hashKey('process-payments'),
      async () => {
        // protected logic
      },
    );
  }
}
```

## How It Works

1. Before your method runs, a PostgreSQL transaction is started
2. `pg_try_advisory_xact_lock(lockId)` attempts to acquire the lock. This is **non-blocking**
3. If the lock is held by another instance, the method is skipped silently
4. If acquired, your method runs. The lock is released when the transaction ends

Advisory locks are scoped to the database connection, so they work across any number of app instances connected to the same PostgreSQL database. No additional infrastructure needed.

## API

### `@WithAdvisoryLock(key: string | number)`

Method decorator. Wraps the method in an advisory lock.

- **String key**: Auto-hashed to a 32-bit integer using FNV-1a
- **Numeric key**: Used directly as the PostgreSQL advisory lock ID

### `AdvisoryLockService`

Injectable service for programmatic usage.

- `withLock(lockId: number, fn: () => Promise<void>): Promise<void>` - Acquire lock and run callback
- `static hashKey(key: string): number` - Hash a string to a lock ID

### `AdvisoryLockModule`

Global module. Import once in your root module. Requires TypeORM `DataSource` to be available.

## Requirements

- NestJS 10+ or 11+
- TypeORM 0.3+
- PostgreSQL

## License

MIT
