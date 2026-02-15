import 'reflect-metadata';
import { AdvisoryLockModule } from '../src/advisory-lock.module';
import { AdvisoryLockService } from '../src/advisory-lock.service';
import { ADVISORY_LOCK_KEY } from '../src/advisory-lock.constants';

function createModule(
  providers: Array<{ name: string; instance: any }>,
  advisoryLockService = {} as AdvisoryLockService,
): AdvisoryLockModule {
  const providerMap = new Map(
    providers.map((p) => [
      p.name,
      { name: p.name, instance: p.instance },
    ]),
  );

  const modulesContainer = new Map([
    ['TestModule', { providers: providerMap }],
  ]) as any;

  return new AdvisoryLockModule(modulesContainer, advisoryLockService);
}

describe('AdvisoryLockModule.onModuleInit', () => {
  it('should inject __advisoryLockService into providers with decorated methods', () => {
    class MyService {
      async myJob() {}
    }
    Reflect.defineMetadata(
      ADVISORY_LOCK_KEY,
      12345,
      MyService.prototype,
      'myJob',
    );

    const instance = new MyService();
    const mockService = { withLock: jest.fn() } as any;
    const mod = createModule(
      [{ name: 'MyService', instance }],
      mockService,
    );

    mod.onModuleInit();

    expect((instance as any).__advisoryLockService).toBe(mockService);
  });

  it('should skip providers without decorated methods', () => {
    class PlainService {
      async doStuff() {}
    }

    const instance = new PlainService();
    const mod = createModule([{ name: 'PlainService', instance }]);

    mod.onModuleInit();

    expect((instance as any).__advisoryLockService).toBeUndefined();
  });

  it('should skip null/undefined instances', () => {
    const mod = createModule([
      { name: 'NullProvider', instance: null },
      { name: 'UndefinedProvider', instance: undefined },
    ]);

    expect(() => mod.onModuleInit()).not.toThrow();
  });

  it('should not crash on prototypes with getters', () => {
    class ServiceWithGetter {
      private _value: any;

      get listen$() {
        return this._value.asObservable();
      }

      async myJob() {}
    }

    const instance = new ServiceWithGetter();
    const mod = createModule([
      { name: 'ServiceWithGetter', instance },
    ]);

    expect(() => mod.onModuleInit()).not.toThrow();
  });

  it('should not crash on prototypes with getters that throw', () => {
    class Dangerous {
      get boom(): never {
        throw new Error('getter invoked on prototype');
      }

      async safeMethod() {}
    }

    Reflect.defineMetadata(
      ADVISORY_LOCK_KEY,
      99,
      Dangerous.prototype,
      'safeMethod',
    );

    const instance = new Dangerous();
    const mockService = { withLock: jest.fn() } as any;
    const mod = createModule(
      [{ name: 'Dangerous', instance }],
      mockService,
    );

    expect(() => mod.onModuleInit()).not.toThrow();
    expect((instance as any).__advisoryLockService).toBe(mockService);
  });
});
