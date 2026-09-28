import { EventEmitter } from 'events';

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
      removeRepeatableByKey: jest.fn().mockResolvedValue(true),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation((_name, processor) => {
      return {
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
        processor,
      };
    }),
  };
});

const redisEmitter = new EventEmitter();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: (event: string, listener: (...args: any[]) => void) => {
        redisEmitter.on(event, listener);
      },
      subscribe: (_channel: string, callback?: (err: Error | null, count?: number) => void) => {
        if (callback) callback(null, 1);
      },
      publish: (channel: string, message: string) => {
        redisEmitter.emit('message', channel, message);
        return Promise.resolve(1);
      },
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
  });
});

