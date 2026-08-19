export interface ApiResponse<T = any> {
  statusCode: number;
  data: T | null;
  error: string | Record<string, any> | null;
}
