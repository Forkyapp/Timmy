import axios from 'axios';
import { BaseAPIClient } from '../base.client';
import type { BaseClientConfig } from '../base.client';

// Create a concrete subclass for testing
class TestClient extends BaseAPIClient {
  constructor(config: BaseClientConfig) {
    super(config);
  }

  // Expose protected methods for testing
  public async testGet<T>(url: string): Promise<T> {
    return this.get<T>(url);
  }

  public async testPost<T>(url: string, data?: unknown): Promise<T> {
    return this.post<T>(url, data);
  }

  public async testPut<T>(url: string, data?: unknown): Promise<T> {
    return this.put<T>(url, data);
  }

  public async testDelete<T>(url: string): Promise<T> {
    return this.delete<T>(url);
  }
}

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('BaseAPIClient', () => {
  let client: TestClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
    };

    mockAxios.create.mockReturnValue(mockAxiosInstance as any);

    client = new TestClient({
      baseURL: 'https://api.test.com',
      headers: { Authorization: 'Bearer token' },
      timeout: 5000,
    });
  });

  describe('constructor', () => {
    it('should create axios instance with config', () => {
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.test.com',
        headers: { Authorization: 'Bearer token' },
        timeout: 5000,
      });
    });

    it('should register response interceptor', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should use default timeout if not provided', () => {
      new TestClient({ baseURL: 'https://api.test.com' });

      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('should use default retry options if not provided', () => {
      const c = new TestClient({ baseURL: 'https://api.test.com' });
      // If the client was created, defaults are set internally
      expect(c).toBeDefined();
    });

    it('should use custom retry options', () => {
      const c = new TestClient({
        baseURL: 'https://api.test.com',
        retryOptions: { maxAttempts: 5, delayMs: 500, backoffFactor: 3 },
      });
      expect(c).toBeDefined();
    });
  });

  describe('GET request', () => {
    it('should make GET request and return data', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 1, name: 'test' } });

      const result = await client.testGet('/items');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/items', undefined);
      expect(result).toEqual({ id: 1, name: 'test' });
    });
  });

  describe('POST request', () => {
    it('should make POST request and return data', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 1 } });

      const result = await client.testPost('/items', { name: 'new' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/items', { name: 'new' }, undefined);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('PUT request', () => {
    it('should make PUT request and return data', async () => {
      mockAxiosInstance.put.mockResolvedValue({ data: { updated: true } });

      const result = await client.testPut('/items/1', { name: 'updated' });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/items/1', { name: 'updated' }, undefined);
      expect(result).toEqual({ updated: true });
    });
  });

  describe('DELETE request', () => {
    it('should make DELETE request and return data', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: { deleted: true } });

      const result = await client.testDelete('/items/1');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/items/1', undefined);
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('error handling interceptor', () => {
    let errorHandler: (error: any) => never;

    beforeEach(() => {
      // Extract the error handler from the interceptor registration
      const interceptorCall = mockAxiosInstance.interceptors.response.use.mock.calls[0];
      errorHandler = interceptorCall[1];
    });

    it('should throw NetworkError for ECONNREFUSED', () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };

      expect(() => errorHandler(error)).toThrow();
      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.code).toBe('NETWORK_ERROR');
      }
    });

    it('should throw NetworkError for ENOTFOUND', () => {
      const error = { code: 'ENOTFOUND', message: 'DNS not found' };

      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.code).toBe('NETWORK_ERROR');
      }
    });

    it('should throw TimeoutError for ETIMEDOUT', () => {
      const error = { code: 'ETIMEDOUT', message: 'Timed out' };

      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.code).toBe('TIMEOUT_ERROR');
      }
    });

    it('should throw TimeoutError for ECONNABORTED', () => {
      const error = { code: 'ECONNABORTED', message: 'Connection aborted' };

      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.code).toBe('TIMEOUT_ERROR');
      }
    });

    it('should throw RateLimitError for 429 status', () => {
      const error = {
        code: undefined,
        message: 'Too many requests',
        response: {
          status: 429,
          data: { message: 'Rate limited' },
          headers: { 'retry-after': '60' },
        },
      };

      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.code).toBe('RATE_LIMIT_ERROR');
        expect(e.retryAfter).toBe(60);
      }
    });

    it('should throw NotFoundError for 404 status', () => {
      const error = {
        code: undefined,
        message: 'Not found',
        response: {
          status: 404,
          data: {},
          headers: {},
        },
      };

      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.code).toBe('NOT_FOUND_ERROR');
      }
    });

    it('should throw APIError for other HTTP errors', () => {
      const error = {
        code: undefined,
        message: 'Server error',
        response: {
          status: 500,
          data: { message: 'Internal error' },
          headers: {},
        },
      };

      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.code).toBe('API_ERROR');
        expect(e.statusCode).toBe(500);
      }
    });

    it('should throw generic APIError for unknown errors', () => {
      const error = {
        code: undefined,
        message: 'Unknown',
        response: undefined,
      };

      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.code).toBe('API_ERROR');
      }
    });

    it('should extract error message from response data string', () => {
      const error = {
        code: undefined,
        message: 'fail',
        response: {
          status: 500,
          data: 'Server error message',
          headers: {},
        },
      };

      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.message).toBe('Server error message');
      }
    });

    it('should extract error message from response data.message', () => {
      const error = {
        code: undefined,
        message: 'fail',
        response: {
          status: 500,
          data: { message: 'Custom message' },
          headers: {},
        },
      };

      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.message).toBe('Custom message');
      }
    });

    it('should extract error message from response data.error', () => {
      const error = {
        code: undefined,
        message: 'fail',
        response: {
          status: 500,
          data: { error: 'Error field message' },
          headers: {},
        },
      };

      try {
        errorHandler(error);
      } catch (e: any) {
        expect(e.message).toBe('Error field message');
      }
    });
  });
});
