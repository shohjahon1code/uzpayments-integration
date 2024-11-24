import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

export class HttpClient {
  private readonly timeout: number;
  private readonly retries: number;
  private readonly retryDelay: number;

  constructor(timeout = 30000, retries = 3, retryDelay = 1000) {
    this.timeout = timeout;
    this.retries = retries;
    this.retryDelay = retryDelay;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      return (
        error.code === 'ECONNABORTED' ||
        error.message.includes('timeout') ||
        error.message.includes('Network Error') ||
        (status && status >= 500) ||
        status === 429
      );
    }
    return false;
  }

  async request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await axios({
          ...config,
          timeout: this.timeout,
        });
        return response;
      } catch (error) {
        lastError = error as Error;
        
        if (
          attempt < this.retries &&
          this.isRetryableError(error)
        ) {
          await this.delay(this.retryDelay * Math.pow(2, attempt)); // Exponential backoff
          continue;
        }
        break;
      }
    }

    throw lastError;
  }
}
