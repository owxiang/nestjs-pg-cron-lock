import { AdvisoryLockService } from '../src/advisory-lock.service';
import { DataSource, QueryRunner } from 'typeorm';

describe('AdvisoryLockService', () => {
  let service: AdvisoryLockService;
  let mockQueryRunner: jest.Mocked<QueryRunner>;
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    } as any;

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as any;

    service = new AdvisoryLockService(mockDataSource);
  });

  describe('hashKey', () => {
    it('should return a 32-bit integer for any string', () => {
      const hash = AdvisoryLockService.hashKey('process-escalations');
      expect(typeof hash).toBe('number');
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('should return consistent hashes for the same key', () => {
      const a = AdvisoryLockService.hashKey('my-cron-job');
      const b = AdvisoryLockService.hashKey('my-cron-job');
      expect(a).toBe(b);
    });

    it('should return different hashes for different keys', () => {
      const a = AdvisoryLockService.hashKey('job-a');
      const b = AdvisoryLockService.hashKey('job-b');
      expect(a).not.toBe(b);
    });
  });

  describe('withLock', () => {
    it('should execute callback when lock is acquired', async () => {
      mockQueryRunner.query.mockResolvedValue([{ locked: true }]);
      const callback = jest.fn().mockResolvedValue(undefined);

      await service.withLock(12345, callback);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        'SELECT pg_try_advisory_xact_lock($1) AS locked',
        [12345],
      );
      expect(callback).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should skip callback when lock is not acquired', async () => {
      mockQueryRunner.query.mockResolvedValue([{ locked: false }]);
      const callback = jest.fn();

      await service.withLock(12345, callback);

      expect(callback).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback and release on callback error', async () => {
      mockQueryRunner.query.mockResolvedValue([{ locked: true }]);
      const callback = jest.fn().mockRejectedValue(new Error('boom'));

      await service.withLock(12345, callback);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should always release the query runner', async () => {
      mockQueryRunner.startTransaction.mockRejectedValue(
        new Error('connection lost'),
      );

      await service.withLock(12345, jest.fn());

      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
