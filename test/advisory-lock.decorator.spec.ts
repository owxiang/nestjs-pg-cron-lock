import { AdvisoryLockService } from '../src/advisory-lock.service';
import { WithAdvisoryLock } from '../src/advisory-lock.decorator';
import { ADVISORY_LOCK_KEY } from '../src/advisory-lock.constants';

describe('WithAdvisoryLock decorator', () => {
  describe('metadata storage', () => {
    it('should store lock ID on prototype so module discovery can find it', () => {
      class TestService {
        @WithAdvisoryLock(839271)
        async myJob() {}
      }

      const lockId = Reflect.getMetadata(
        ADVISORY_LOCK_KEY,
        TestService.prototype,
        'myJob',
      );
      expect(lockId).toBe(839271);
    });

    it('should hash string keys and store the hash as metadata', () => {
      class TestService {
        @WithAdvisoryLock('process-orders')
        async myJob() {}
      }

      const lockId = Reflect.getMetadata(
        ADVISORY_LOCK_KEY,
        TestService.prototype,
        'myJob',
      );
      expect(lockId).toBe(AdvisoryLockService.hashKey('process-orders'));
    });
  });

  it('should wrap method to call withLock on the injected service', async () => {
    const mockWithLock = jest.fn().mockImplementation((_id, fn) => fn());

    class TestService {
      __advisoryLockService = { withLock: mockWithLock } as any;

      @WithAdvisoryLock('test-job')
      async myJob() {
        return 'executed';
      }
    }

    const instance = new TestService();
    await instance.myJob();

    expect(mockWithLock).toHaveBeenCalledWith(
      AdvisoryLockService.hashKey('test-job'),
      expect.any(Function),
    );
  });

  it('should accept numeric lock IDs', async () => {
    const mockWithLock = jest.fn().mockImplementation((_id, fn) => fn());

    class TestService {
      __advisoryLockService = { withLock: mockWithLock } as any;

      @WithAdvisoryLock(839271)
      async myJob() {
        return 'executed';
      }
    }

    const instance = new TestService();
    await instance.myJob();

    expect(mockWithLock).toHaveBeenCalledWith(839271, expect.any(Function));
  });

  it('should call original method without lock if service not injected', async () => {
    class TestService {
      @WithAdvisoryLock('test-job')
      async myJob() {
        return 'executed';
      }
    }

    const instance = new TestService();
    const result = await instance.myJob();

    expect(result).toBe('executed');
  });
});
