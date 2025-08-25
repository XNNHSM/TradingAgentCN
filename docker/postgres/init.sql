-- PostgreSQL Initialization Script for TradingAgentCN
-- This script sets up the initial database configuration

-- Enable UUID extension for primary key generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone (PostgreSQL equivalent of MySQL timezone setting)
ALTER DATABASE trading_agent SET timezone TO 'Asia/Shanghai';

-- Create any additional setup here as needed
-- Note: TypeORM will handle table creation through synchronize=true in development

-- Log the initialization
DO $$
BEGIN
    RAISE NOTICE 'TradingAgentCN PostgreSQL database initialized successfully';
END $$;