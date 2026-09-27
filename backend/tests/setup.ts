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

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn().mockResolvedValue(undefined),
  }));
});
