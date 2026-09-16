import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'medellinshow',
  entities: ['src/modules/**/entities/*.entity.ts'],
  migrations: ['../../infra/db/migrations/*.ts'],
  synchronize: false,
  logging: true,
});
