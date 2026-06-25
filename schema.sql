-- PostgreSQL Schema for SupportNexus Helpdesk

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    branding JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL, -- 'client' | 'internal'
    tenant_id VARCHAR(100) REFERENCES tenants(id) ON DELETE CASCADE,
    company_id VARCHAR(100) REFERENCES companies(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL, -- 'client_user' | 'l1_agent' | 'l2_agent' | 'l3_agent' | 'admin'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) REFERENCES tenants(id) ON DELETE CASCADE,
    company_id VARCHAR(100) REFERENCES companies(id) ON DELETE SET NULL,
    company_name VARCHAR(255) NOT NULL,
    reference VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'new', -- 'new' | 'in_progress' | 'awaiting_client' | 'escalated' | 'resolved'
    priority VARCHAR(50) NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'urgent'
    tier VARCHAR(10) NOT NULL DEFAULT 'l1', -- 'l1' | 'l2' | 'l3'
    assigned_to_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_name VARCHAR(255),
    sla_response_by TIMESTAMP WITH TIME ZONE NOT NULL,
    sla_resolve_by TIMESTAMP WITH TIME ZONE NOT NULL,
    is_response_breached BOOLEAN NOT NULL DEFAULT FALSE,
    is_resolve_breached BOOLEAN NOT NULL DEFAULT FALSE,
    is_response_met BOOLEAN NOT NULL DEFAULT FALSE,
    is_resolve_met BOOLEAN NOT NULL DEFAULT FALSE,
    custom_fields JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 5. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(100) PRIMARY KEY,
    ticket_id VARCHAR(100) REFERENCES tickets(id) ON DELETE CASCADE,
    tenant_id VARCHAR(100) REFERENCES tenants(id) ON DELETE CASCADE,
    author_id VARCHAR(100) NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(50) NOT NULL DEFAULT 'portal', -- 'portal' | 'email' | 'system'
    attachments JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SLA Policies Table
CREATE TABLE IF NOT EXISTS sla_policies (
    tenant_id VARCHAR(100) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    policies JSONB NOT NULL
);
