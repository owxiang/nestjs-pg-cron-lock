import { AdvisoryLockService } from '../src/advisory-lock.service';
import { WithAdvisoryLock } from '../src/advisory-lock.decorator';

describe('WithAdvisoryLock decorator', () => {
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
