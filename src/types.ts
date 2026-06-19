export type UserRole = 'client_user' | 'l1_agent' | 'l2_agent' | 'l3_agent' | 'admin';
export type TicketStatus = 'new' | 'in_progress' | 'awaiting_client' | 'escalated' | 'resolved';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  branding: {
    logoUrl?: string;
    primaryColor: string; // Tailwind class color or hex
  };
  isActive: boolean;
  createdAt: string;
}

export interface Company {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  userType: 'client' | 'internal';
  tenantId: string;
  companyId?: string; // Optional for internal users, required for client users
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface SLAConfig {
  firstResponseMinutes: number;
  resolutionMinutes: number;
}

export interface SLAPolicies {
  low: SLAConfig;
  medium: SLAConfig;
  high: SLAConfig;
  urgent: SLAConfig;
}

export interface EscalationHistory {
  id: string;
  fromTier: 'l1' | 'l2' | 'l3';
  toTier: 'l1' | 'l2' | 'l3';
  agentId?: string;
  agentName?: string;
  reason: string;
  createdAt: string;
}

export interface StatusHistory {
  id: string;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  actorName: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface Message {
  id: string;
  ticketId: string;
  tenantId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  isInternal: boolean; // Yellow background for agent discussions
  source: 'portal' | 'email' | 'system';
  attachments: Attachment[];
  createdAt: string;
}

export interface Ticket {
  id: string;
  tenantId: string;
  companyId: string;
  companyName: string;
  reference: string; // TKT-ACME-0023
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  tier: 'l1' | 'l2' | 'l3';
  assignedToId?: string;
  assignedToName?: string;
  slaResponseBy: string; // ISO String
  slaResolveBy: string;  // ISO String
  isResponseBreached: boolean;
  isResolveBreached: boolean;
  isResponseMet: boolean;
  isResolveMet: boolean;
  customFields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

// Database schema exported as backup
export interface DatabaseBackup {
  exportTimestamp: string;
  version: string;
  tenants: Tenant[];
  companies: Company[];
  users: User[];
  tickets: Ticket[];
  messages: Message[];
  slaPolicies: Record<string, SLAPolicies>; // tenantId -> SLA defaults
}

// Shared API responses
export interface AuthResponse {
  user: User;
  token: string;
}
