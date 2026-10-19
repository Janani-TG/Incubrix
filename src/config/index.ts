import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  isTest: boolean;
  port: number;
  host: string;
  apiPrefix: string;
  logLevel: string;
}

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  logLevel: process.env.LOG_LEVEL || 'info',
};
