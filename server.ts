import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { query, pool } from "./db";
import { 
  Tenant, Company, User, Ticket, Message, Attachment, 
  SLAPolicies, DatabaseBackup, TicketStatus, TicketPriority, UserRole
} from "./src/types";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3008;
const DB_FILE = path.join(process.cwd(), "db.json");

app.use(express.json({ limit: '20mb' }));

// SLA defaults per priority level (Low, Medium, High, Urgent)
const DEFAULT_SLA_POLICIES: SLAPolicies = {
  low: { firstResponseMinutes: 480, resolutionMinutes: 1440 },       // 8 hours / 24 hours
  medium: { firstResponseMinutes: 240, resolutionMinutes: 720 },     // 4 hours / 12 hours
  high: { firstResponseMinutes: 60, resolutionMinutes: 240 },        // 1 hour / 4 hours
  urgent: { firstResponseMinutes: 15, resolutionMinutes: 60 }        // 15 mins / 1 hour
};

// Seed initial database
const createInitialSeedData = (): DatabaseBackup => {
  const tenants: Tenant[] = [
    {
      id: "tenant-acme-id",
      name: "Acme Support Portal",
      subdomain: "acme",
      branding: { primaryColor: "indigo" },
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: "tenant-globex-id",
      name: "Globex Enterprise Customer Hub",
      subdomain: "globex",
      branding: { primaryColor: "emerald" },
      isActive: true,
      createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
    }
  ];

  const companies: Company[] = [
    {
      id: "company-roadrunner-id",
      tenantId: "tenant-acme-id",
      name: "Roadrunner Delivery Services",
      createdAt: new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: "company-globex-client-id",
      tenantId: "tenant-globex-id",
      name: "Globex Retail Division",
      createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
    }
  ];

  const users: User[] = [
    // Standard Platform Admin
    {
      id: "user-admin-id",
      email: "admin@supportnexus.app",
      fullName: "Alex Rivera",
      userType: "internal",
      tenantId: "tenant-acme-id", // Can manage other tenants too as admin
      role: "admin",
      isActive: true,
      createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
    },
    // Acme L1 Agent
    {
      id: "user-l1-id",
      email: "l1@supportnexus.app",
      fullName: "Sarah Connor (L1 Support)",
      userType: "internal",
      tenantId: "tenant-acme-id",
      role: "l1_agent",
      isActive: true,
      createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
    },
    // Acme L2 Agent
    {
      id: "user-l2-id",
      email: "l2@supportnexus.app",
      fullName: "Marcus Wright (L2 Specialist)",
      userType: "internal",
      tenantId: "tenant-acme-id",
      role: "l2_agent",
      isActive: true,
      createdAt: new Date(Date.now() - 19 * 24 * 3600 * 1000).toISOString()
    },
    // Acme L3 Agent
    {
      id: "user-l3-id",
      email: "l3@supportnexus.app",
      fullName: "Dr. John Connor (L3 Expert)",
      userType: "internal",
      tenantId: "tenant-acme-id",
      role: "l3_agent",
      isActive: true,
      createdAt: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString()
    },
    // Acme Customer
    {
      id: "user-cust-acme-id",
      email: "customer@acme.com",
      fullName: "Wile E. Coyote",
      userType: "client",
      tenantId: "tenant-acme-id",
      companyId: "company-roadrunner-id",
      role: "client_user",
      isActive: true,
      createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    },
    // Globex Customer
    {
      id: "user-cust-globex-id",
      email: "customer@globex.com",
      fullName: "Hank Scorpio",
      userType: "client",
      tenantId: "tenant-globex-id",
      companyId: "company-globex-client-id",
      role: "client_user",
      isActive: true,
      createdAt: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString()
    }
  ];

  const tickets: Ticket[] = [
    {
      id: "ticket-1",
      tenantId: "tenant-acme-id",
      companyId: "company-roadrunner-id",
      companyName: "Roadrunner Delivery Services",
      reference: "TKT-ACME-0001",
      subject: "Rocket Skates fail to ignite under load",
      description: "Upon activating the dual-rocket boosters at maximum foot extension, ignition fails and produces only dark smoke. This is causing significant operational delay while chasing prey.",
      status: "new",
      priority: "high",
      tier: "l1",
      slaResponseBy: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour response
      slaResolveBy: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours resolution
      isResponseBreached: false,
      isResolveBreached: false,
      isResponseMet: false,
      isResolveMet: false,
      customFields: {
        deviceType: "Ankle Accel-800",
        serialNumber: "ACME-9981-RWT",
        operatingSystem: "N/A"
      },
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    },
    {
      id: "ticket-2",
      tenantId: "tenant-acme-id",
      companyId: "company-roadrunner-id",
      companyName: "Roadrunner Delivery Services",
      reference: "TKT-ACME-0002",
      subject: "S3 Attachment uploads throwing 415 errors manually",
      description: "When using the web interface to upload critical testing records (PNG files, ~3MB), we receive a 415 HTTP invalid mimetype error response on the client console. Need L2 check on fileserver MIME sniffing config.",
      status: "escalated",
      priority: "medium",
      tier: "l2",
      slaResponseBy: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // Missed response target (Breached!)
      slaResolveBy: new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString(),
      isResponseBreached: true,
      isResolveBreached: false,
      isResponseMet: false,
      isResolveMet: false,
      customFields: {
        deviceType: "Client Desktop",
        serialNumber: "REF-PORTAL-WEB",
        operatingSystem: "Debian 12"
      },
      createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
    },
    {
      id: "ticket-3",
      tenantId: "tenant-globex-id",
      companyId: "company-globex-client-id",
      companyName: "Globex Retail Division",
      reference: "TKT-GLOBEX-0001",
      subject: "Central Server Nuclear Power Regulator temperature anomalies",
      description: "Our core regulatory metrics indicate a sudden thermal spike in reactor module 4 during compile cycles. We need priority L3 override to review compiler instruction scheduling blocks.",
      status: "in_progress",
      priority: "urgent",
      tier: "l3",
      slaResponseBy: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      slaResolveBy: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      isResponseBreached: false,
      isResolveBreached: false,
      isResponseMet: true, // Marked as met on first work
      isResolveMet: false,
      customFields: {
        deviceType: "Atomic Core Controller",
        serialNumber: "SN-99120-X",
        operatingSystem: "ScorpioOS v4"
      },
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString()
    }
  ];

  const messages: Message[] = [
    {
      id: "msg-1-1",
      ticketId: "ticket-1",
      tenantId: "tenant-acme-id",
      authorId: "user-cust-acme-id",
      authorName: "Wile E. Coyote",
      authorRole: "client_user",
      content: "This client portal has surprisingly fast responses. I am uploading the telemetry from the boots. It blew a hole in my desert runway, please check ASAP.",
      isInternal: false,
      source: "portal",
      attachments: [],
      createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString()
    },
    {
      id: "msg-2-1",
      ticketId: "ticket-2",
      tenantId: "tenant-acme-id",
      authorId: "user-cust-acme-id",
      authorName: "Wile E. Coyote",
      authorRole: "client_user",
      content: "Here is the error screenshot captured directly from Chrome DevTools console showing mime-sniff block on line 234.",
      isInternal: false,
      source: "portal",
      attachments: [
        {
          id: "attached-1",
          filename: "console_error_photo.png",
          mimeType: "image/png",
          sizeBytes: 154020,
          url: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=400",
          createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
        }
      ],
      createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
    },
    {
      id: "msg-2-2",
      ticketId: "ticket-2",
      tenantId: "tenant-acme-id",
      authorId: "user-l1-id",
      authorName: "Sarah Connor (L1 Support)",
      authorRole: "l1_agent",
      content: "INTERNAL DISCUSSIONS ONLY: Verified that the client gets blocked because our file upload gateway scans client-reported Content-Type and triggers strict security reject because Wile's operating system doesn't set standard PNG signatures. I am escalating to Marcus (L2) to inspect the server-side Sniffer whitelist.",
      isInternal: true,
      source: "portal",
      attachments: [],
      createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
    },
    {
      id: "msg-3-1",
      ticketId: "ticket-3",
      tenantId: "tenant-globex-id",
      authorId: "user-cust-globex-id",
      authorName: "Hank Scorpio",
      authorRole: "client_user",
      content: "If the reactor goes above 4000 Kelvins, Cypress Creek might be vaporized. Please do not delay, johnny on the spot!",
      isInternal: false,
      source: "email",
      attachments: [],
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
    },
    {
      id: "msg-3-2",
      ticketId: "ticket-3",
      tenantId: "tenant-globex-id",
      authorId: "user-l1-id",
      authorName: "Sarah Connor (L1 Support)",
      authorRole: "l1_agent",
      content: "This is a serious emergency. Handing off immediately to John Connor for senior level code execution.",
      isInternal: false,
      source: "portal",
      attachments: [],
      createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString()
    }
  ];

  const slaPolicies: Record<string, SLAPolicies> = {
    "tenant-acme-id": { ...DEFAULT_SLA_POLICIES },
    "tenant-globex-id": { ...DEFAULT_SLA_POLICIES }
  };

  return {
    exportTimestamp: new Date().toISOString(),
    version: "1.0",
    tenants,
    companies,
    users,
    tickets,
    messages,
    slaPolicies
  };
};

// Safe DB Read/Write mapping functions
const mapUser = (dbUser: any): User => ({
  id: dbUser.id,
  email: dbUser.email,
  fullName: dbUser.full_name,
  userType: dbUser.user_type,
  tenantId: dbUser.tenant_id,
  companyId: dbUser.company_id || undefined,
  role: dbUser.role,
  isActive: dbUser.is_active,
  createdAt: dbUser.created_at
});

const mapTicket = (dbTicket: any): Ticket => ({
  id: dbTicket.id,
  tenantId: dbTicket.tenant_id,
  companyId: dbTicket.company_id,
  companyName: dbTicket.company_name,
  reference: dbTicket.reference,
  subject: dbTicket.subject,
  description: dbTicket.description,
  status: dbTicket.status,
  priority: dbTicket.priority,
  tier: dbTicket.tier,
  assignedToId: dbTicket.assigned_to_id || undefined,
  assignedToName: dbTicket.assigned_to_name || undefined,
  slaResponseBy: dbTicket.sla_response_by,
  slaResolveBy: dbTicket.sla_resolve_by,
  isResponseBreached: dbTicket.is_response_breached,
  isResolveBreached: dbTicket.is_resolve_breached,
  isResponseMet: dbTicket.is_response_met,
  isResolveMet: dbTicket.is_resolve_met,
  customFields: dbTicket.custom_fields,
  createdAt: dbTicket.created_at,
  updatedAt: dbTicket.updated_at,
  resolvedAt: dbTicket.resolved_at || undefined
});

const mapMessage = (dbMsg: any): Message => ({
  id: dbMsg.id,
  ticketId: dbMsg.ticket_id,
  tenantId: dbMsg.tenant_id,
  authorId: dbMsg.author_id,
  authorName: dbMsg.author_name,
  authorRole: dbMsg.author_role,
  content: dbMsg.content,
  isInternal: dbMsg.is_internal,
  source: dbMsg.source,
  attachments: typeof dbMsg.attachments === 'string' ? JSON.parse(dbMsg.attachments) : dbMsg.attachments || [],
  createdAt: dbMsg.created_at
});

const seedDatabase = async () => {
  const seed = createInitialSeedData();
  
  for (const t of seed.tenants) {
    await query(
      `INSERT INTO tenants (id, name, subdomain, branding, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.name, t.subdomain, t.branding, t.isActive, t.createdAt]
    );
  }

  for (const c of seed.companies) {
    await query(
      `INSERT INTO companies (id, tenant_id, name, created_at)
       VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [c.id, c.tenantId, c.name, c.createdAt]
    );
  }

  for (const u of seed.users) {
    await query(
      `INSERT INTO users (id, email, full_name, user_type, tenant_id, company_id, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [u.id, u.email, u.fullName, u.userType, u.tenantId, u.companyId || null, u.role, u.isActive, u.createdAt]
    );
  }

  for (const t of seed.tickets) {
    await query(
      `INSERT INTO tickets (id, tenant_id, company_id, company_name, reference, subject, description, status, priority, tier, assigned_to_id, assigned_to_name, sla_response_by, sla_resolve_by, is_response_breached, is_resolve_breached, is_response_met, is_resolve_met, custom_fields, created_at, updated_at, resolved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) ON CONFLICT (id) DO NOTHING`,
      [
        t.id, t.tenantId, t.companyId, t.companyName, t.reference, t.subject, t.description, t.status, t.priority, t.tier,
        t.assignedToId || null, t.assignedToName || null, t.slaResponseBy, t.slaResolveBy, t.isResponseBreached, t.isResolveBreached,
        t.isResponseMet, t.isResolveMet, t.customFields, t.createdAt, t.updatedAt, t.resolvedAt || null
      ]
    );
  }

  for (const m of seed.messages) {
    await query(
      `INSERT INTO messages (id, ticket_id, tenant_id, author_id, author_name, author_role, content, is_internal, source, attachments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.ticketId, m.tenantId, m.authorId, m.authorName, m.authorRole, m.content, m.isInternal, m.source, JSON.stringify(m.attachments || []), m.createdAt]
    );
  }

  for (const [tenantId, policies] of Object.entries(seed.slaPolicies)) {
    await query(
      `INSERT INTO sla_policies (tenant_id, policies)
       VALUES ($1, $2) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, policies]
    );
  }

  console.log("Database seeded successfully!");
};

const initializeDatabase = async () => {
  try {
    const schemaPath = path.join(process.cwd(), "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await query(schemaSql);
    console.log("Database schema applied successfully.");

    const tenantsCheck = await query("SELECT count(*) FROM tenants");
    const count = parseInt(tenantsCheck.rows[0].count, 10);
    if (count === 0) {
      console.log("Database empty. Seeding initial demo data...");
      await seedDatabase();
    }
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
};

// Lazy initialize Gemini SDK
let genAI: GoogleGenAI | null = null;
const getGeminiClient = (): GoogleGenAI => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is missing.");
    }
    // Set standard httpOptions for real-world telemetry
    genAI = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return genAI;
};

// Simple Mock Auth verification
const authenticateUserByEmail = async (email: string): Promise<User | null> => {
  const result = await query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
  if (result.rows.length === 0) return null;
  return mapUser(result.rows[0]);
};

// API Router
// 1. Authenticate user (for mock login sessions)
app.post("/api/auth/login", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  try {
    const user = await authenticateUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid user credentials. Please check seed accounts." });
    }
    return res.json({ user, token: `mock-token-${user.id}` });
  } catch (err) {
    return res.status(500).json({ error: "Auth database query failed" });
  }
});

// 2. Fetch active databases/tickets
app.get("/api/tickets", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] as string;
  const userRole = req.headers["x-user-role"] as string;
  const userId = req.headers["x-user-id"] as string;

  let queryText = "SELECT * FROM tickets WHERE 1=1";
  const params: any[] = [];

  if (tenantId) {
    params.push(tenantId);
    queryText += ` AND tenant_id = $${params.length}`;
  }

  if (userRole === "client_user" && userId) {
    try {
      const userRes = await query("SELECT company_id FROM users WHERE id = $1", [userId]);
      const companyId = userRes.rows[0]?.company_id;
      if (companyId) {
        params.push(companyId);
        queryText += ` AND company_id = $${params.length}`;
      } else {
        return res.json({ data: [] });
      }
    } catch (err) {
      return res.status(500).json({ error: "RLS isolation query failed" });
    }
  }

  const status = req.query.status as string;
  if (status) {
    params.push(status);
    queryText += ` AND status = $${params.length}`;
  }

  const priority = req.query.priority as string;
  if (priority) {
    params.push(priority);
    queryText += ` AND priority = $${params.length}`;
  }

  const search = req.query.search as string;
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    queryText += ` AND (LOWER(subject) LIKE $${params.length} OR LOWER(description) LIKE $${params.length} OR LOWER(reference) LIKE $${params.length})`;
  }

  queryText += " ORDER BY created_at DESC";

  try {
    const result = await query(queryText, params);
    const mapped = result.rows.map(mapTicket);
    return res.json({ data: mapped });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// 3. Get ticket details with authentic messages
app.get("/api/tickets/:id", async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers["x-user-role"] as string;

  try {
    const ticketRes = await query("SELECT * FROM tickets WHERE id = $1", [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    const ticket = mapTicket(ticketRes.rows[0]);

    if (userRole === "client_user") {
      const clientUserEmail = req.headers["x-user-email"] as string;
      const userRes = await query("SELECT company_id FROM users WHERE email = $1", [clientUserEmail]);
      const companyId = userRes.rows[0]?.company_id;
      if (companyId && ticket.companyId !== companyId) {
        return res.status(403).json({ error: "Forbidden: Cross-tenant data leakage prevented by RLS" });
      }
    }

    let msgQuery = "SELECT * FROM messages WHERE ticket_id = $1";
    const msgParams = [id];
    if (userRole === "client_user") {
      msgQuery += " AND is_internal = FALSE";
    }
    msgQuery += " ORDER BY created_at ASC";

    const msgRes = await query(msgQuery, msgParams);
    const messages = msgRes.rows.map(mapMessage);

    return res.json({ ticket, messages });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch ticket details" });
  }
});

// 4. Create single tickets (with Dynamic SLA generation & Idempotent tracker simulation)
app.post("/api/tickets", async (req, res) => {
  const { subject, description, priority, companyId, tenantId, customFields } = req.body;
  const authorEmail = req.headers["x-user-email"] as string || "customer@acme.com";

  if (!subject || !description || !priority || !tenantId) {
    return res.status(400).json({ error: "Please input high constraints: subject, description, priority, and tenant" });
  }

  try {
    const tenantRes = await query("SELECT * FROM tenants WHERE id = $1", [tenantId]);
    if (tenantRes.rows.length === 0) {
      return res.status(404).json({ error: "Invalid Tenant" });
    }
    const tenant = tenantRes.rows[0];

    let companyRes = await query("SELECT * FROM companies WHERE id = $1", [companyId]);
    if (companyRes.rows.length === 0) {
      companyRes = await query("SELECT * FROM companies WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    }
    const company = companyRes.rows[0];

    const authorRes = await query("SELECT * FROM users WHERE email = $1", [authorEmail]);
    const author = authorRes.rows[0];

    const slaRes = await query("SELECT policies FROM sla_policies WHERE tenant_id = $1", [tenantId]);
    const policies = slaRes.rows[0]?.policies || DEFAULT_SLA_POLICIES;
    const slaRule = policies[priority] || policies.medium;

    const respTarget = new Date(Date.now() + slaRule.firstResponseMinutes * 60 * 1000).toISOString();
    const resolveTarget = new Date(Date.now() + slaRule.resolutionMinutes * 60 * 1000).toISOString();

    const tenantSub = tenant.subdomain.toUpperCase();
    const countRes = await query("SELECT COUNT(*) FROM tickets WHERE tenant_id = $1", [tenantId]);
    const tCount = parseInt(countRes.rows[0].count, 10) + 101;
    const reference = `TKT-${tenantSub}-${tCount}`;

    const newTicketId = `ticket-gen-${Date.now()}`;
    const nowStr = new Date().toISOString();

    await query(
      `INSERT INTO tickets (id, tenant_id, company_id, company_name, reference, subject, description, status, priority, tier, sla_response_by, sla_resolve_by, is_response_breached, is_resolve_breached, is_response_met, is_resolve_met, custom_fields, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        newTicketId, tenantId, company.id, company.name, reference, subject, description, "new", priority, "l1",
        respTarget, resolveTarget, false, false, false, false, customFields || {}, nowStr, nowStr
      ]
    );

    const newMsgId = `msg-gen-${Date.now()}`;
    await query(
      `INSERT INTO messages (id, ticket_id, tenant_id, author_id, author_name, author_role, content, is_internal, source, attachments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        newMsgId, newTicketId, tenantId, author ? author.id : "guest-id", author ? author.full_name : "Guest Submitter",
        author ? author.role : "client_user", description, false, "portal", JSON.stringify([]), nowStr
      ]
    );

    const createdTicketRes = await query("SELECT * FROM tickets WHERE id = $1", [newTicketId]);
    return res.status(201).json(mapTicket(createdTicketRes.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Failed to create ticket" });
  }
});

// 5. Submit Message to Thread (Validates strict internal note separation & customer safety)
app.post("/api/tickets/:id/messages", async (req, res) => {
  const { id } = req.params;
  const { content, isInternal, source, attachments } = req.body;
  const authorEmail = req.headers["x-user-email"] as string;

  try {
    const ticketRes = await query("SELECT * FROM tickets WHERE id = $1", [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    const ticket = ticketRes.rows[0];

    const authorRes = await query("SELECT * FROM users WHERE email = $1", [authorEmail]);
    if (authorRes.rows.length === 0) {
      return res.status(404).json({ error: "Author not found" });
    }
    const author = authorRes.rows[0];

    const finalIsInternal = author.role === "client_user" ? false : !!isInternal;
    const newMsgId = `msg-gen-${Date.now()}`;
    const nowStr = new Date().toISOString();

    await query(
      `INSERT INTO messages (id, ticket_id, tenant_id, author_id, author_name, author_role, content, is_internal, source, attachments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        newMsgId, id, ticket.tenant_id, author.id, author.full_name, author.role,
        content, finalIsInternal, source || "portal", JSON.stringify(attachments || []), nowStr
      ]
    );

    let nextStatus = ticket.status;
    if (author.role === "client_user" && ticket.status === "awaiting_client") {
      nextStatus = "in_progress";
    }

    let isResponseMet = ticket.is_response_met;
    let isResponseBreached = ticket.is_response_breached;
    if (author.role !== "client_user" && !isResponseMet) {
      isResponseMet = true;
      const now = new Date();
      const limit = new Date(ticket.sla_response_by);
      if (now > limit) {
        isResponseBreached = true;
      }
    }

    await query(
      `UPDATE tickets SET status = $1, is_response_met = $2, is_response_breached = $3, updated_at = $4 WHERE id = $5`,
      [nextStatus, isResponseMet, isResponseBreached, nowStr, id]
    );

    const insertedMsgRes = await query("SELECT * FROM messages WHERE id = $1", [newMsgId]);
    return res.status(201).json(mapMessage(insertedMsgRes.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Failed to post message" });
  }
});

// 6. Transition Ticket Status (Validates explicit state machine routes!)
app.post("/api/tickets/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userRole = req.headers["x-user-role"] as string;

  try {
    const ticketRes = await query("SELECT * FROM tickets WHERE id = $1", [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    const ticket = ticketRes.rows[0];

    const currentStatus = ticket.status;
    const nextStatus = status as TicketStatus;

    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      new: ["in_progress", "resolved"],
      in_progress: ["awaiting_client", "escalated", "resolved"],
      awaiting_client: ["in_progress", "resolved"],
      escalated: ["in_progress", "resolved", "awaiting_client"],
      resolved: ["in_progress"]
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      return res.status(422).json({ 
        error: `INVALID_STATUS_TRANSITION: Cannot transition ticket from ${currentStatus} to ${nextStatus}.` 
      });
    }

    const nowStr = new Date().toISOString();
    let resolvedAt = ticket.resolved_at;
    let isResolveMet = ticket.is_resolve_met;
    let isResolveBreached = ticket.is_resolve_breached;

    if (nextStatus === "resolved") {
      resolvedAt = nowStr;
      isResolveMet = true;
      if (new Date() > new Date(ticket.sla_resolve_by)) {
        isResolveBreached = true;
      }
    }

    await query(
      `UPDATE tickets SET status = $1, updated_at = $2, resolved_at = $3, is_resolve_met = $4, is_resolve_breached = $5 WHERE id = $6`,
      [nextStatus, nowStr, resolvedAt, isResolveMet, isResolveBreached, id]
    );

    const systemMsgId = `msg-system-${Date.now()}`;
    await query(
      `INSERT INTO messages (id, ticket_id, tenant_id, author_id, author_name, author_role, content, is_internal, source, attachments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        systemMsgId, id, ticket.tenant_id, "system", "Nexus Engine", "admin",
        `Ticket status updated from ${currentStatus.toUpperCase()} to ${nextStatus.toUpperCase()}`,
        false, "system", JSON.stringify([]), nowStr
      ]
    );

    const updatedTicket = await query("SELECT * FROM tickets WHERE id = $1", [id]);
    return res.json(mapTicket(updatedTicket.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Failed to update ticket status" });
  }
});

// 7. Tiered Escalation Endpoint (L1 -> L2 -> L3 sequentially)
app.post("/api/tickets/:id/escalate", async (req, res) => {
  const { id } = req.params;
  const { reason, targetTier } = req.body;
  const authorEmail = req.headers["x-user-email"] as string;

  try {
    const ticketRes = await query("SELECT * FROM tickets WHERE id = $1", [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    const ticket = ticketRes.rows[0];

    const agentRes = await query("SELECT * FROM users WHERE email = $1", [authorEmail]);
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ error: "Agent check failed" });
    }
    const agent = agentRes.rows[0];

    if (!reason || reason.length < 10) {
      return res.status(400).json({ error: "An escalation requires an internal note reason of at least 10 characters." });
    }

    let nextTier = targetTier;
    if (agent.role === "l1_agent") {
      nextTier = "l2";
    } else if (agent.role === "l2_agent") {
      nextTier = "l3";
    } else if (!nextTier) {
      nextTier = "l2";
    }

    const nowStr = new Date().toISOString();
    await query(
      `UPDATE tickets SET tier = $1, status = 'escalated', updated_at = $2 WHERE id = $3`,
      [nextTier, nowStr, id]
    );

    const noteContent = `**[ESCALATION NOTICE L1→${nextTier.toUpperCase()}]** Reason: ${reason}. Escalated by ${agent.full_name}.`;
    const internalEscalationMsgId = `msg-escalate-${Date.now()}`;

    await query(
      `INSERT INTO messages (id, ticket_id, tenant_id, author_id, author_name, author_role, content, is_internal, source, attachments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        internalEscalationMsgId, id, ticket.tenant_id, agent.id, agent.full_name, agent.role,
        noteContent, true, "portal", JSON.stringify([]), nowStr
      ]
    );

    const updatedTicket = await query("SELECT * FROM tickets WHERE id = $1", [id]);
    return res.json(mapTicket(updatedTicket.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Failed to escalate ticket" });
  }
});

// 8. SLA Breach Scanner background trigger (Simulate cron ticks on demand)
app.post("/api/sla/trigger-check", async (req, res) => {
  try {
    const now = new Date();
    const ticketsRes = await query("SELECT * FROM tickets WHERE status != 'resolved'");
    let updatedCount = 0;

    for (const t of ticketsRes.rows) {
      const respDate = new Date(t.sla_response_by);
      const resolveDate = new Date(t.sla_resolve_by);
      let tUpdated = false;
      let isResponseBreached = t.is_response_breached;
      let isResolveBreached = t.is_resolve_breached;

      if (now > respDate && !t.is_response_met && !isResponseBreached) {
        isResponseBreached = true;
        tUpdated = true;
      }
      if (now > resolveDate && !t.is_resolve_met && !isResolveBreached) {
        isResolveBreached = true;
        tUpdated = true;
      }

      if (tUpdated) {
        await query(
          `UPDATE tickets SET is_response_breached = $1, is_resolve_breached = $2 WHERE id = $3`,
          [isResponseBreached, isResolveBreached, t.id]
        );
        updatedCount++;
      }
    }

    return res.json({ status: "success", checkedAt: now.toISOString(), breachedRowsTriggered: updatedCount });
  } catch (err) {
    return res.status(500).json({ error: "Failed to run SLA check" });
  }
});
// 9. Operational dashboard metrics queries
app.get("/api/reports/dashboard", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] as string;

  try {
    let ticketsQuery = "SELECT * FROM tickets";
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      ticketsQuery += " WHERE tenant_id = $1";
    }
    const ticketsRes = await query(ticketsQuery, params);
    const tickets = ticketsRes.rows;

    const openTickets = tickets.filter(t => t.status !== "resolved");
    const resolvedTickets = tickets.filter(t => t.status === "resolved");

    const newCount = tickets.filter(t => t.status === "new").length;
    const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
    const awaitingCount = tickets.filter(t => t.status === "awaiting_client").length;
    const escalatedCount = tickets.filter(t => t.status === "escalated").length;

    const breachedResponseCount = tickets.filter(t => t.is_response_breached).length;
    const breachedResolveCount = tickets.filter(t => t.is_resolve_breached).length;

    const totalSlaCalculable = tickets.length;
    const metSlaCount = tickets.filter(t => !t.is_response_breached && !t.is_resolve_breached).length;
    const slaCompliancePct = totalSlaCalculable > 0 ? Math.round((metSlaCount / totalSlaCalculable) * 100) : 100;

    return res.json({
      summary: {
        totalTickets: tickets.length,
        openCount: openTickets.length,
        resolvedCount: resolvedTickets.length,
        slaCompliancePct
      },
      byStatus: {
        new: newCount,
        in_progress: inProgressCount,
        awaiting_client: awaitingCount,
        escalated: escalatedCount,
        resolved: resolvedTickets.length
      },
      slaBreaches: {
        responseBreaches: breachedResponseCount,
        resolveBreaches: breachedResolveCount
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate dashboard report" });
  }
});

// 10. Inbound Email webhook emulator
app.post("/api/webhook/email/inbound", async (req, res) => {
  const { from, subject, body } = req.body;

  if (!from || !subject || !body) {
    return res.status(400).json({ error: "Email must include values for: from, subject, and body." });
  }

  try {
    const matchRef = subject.match(/(TKT-\w+-\d+)/i);
    let resolvedTicket: any = undefined;

    if (matchRef) {
      const matchedRefString = matchRef[0].toUpperCase();
      const ticketRes = await query("SELECT * FROM tickets WHERE reference = $1", [matchedRefString]);
      if (ticketRes.rows.length > 0) {
        resolvedTicket = ticketRes.rows[0];
      }
    }

    let userRes = await query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [from]);
    let user = userRes.rows[0];
    const nowStr = new Date().toISOString();

    if (!user) {
      const newUserId = `user-guest-${Date.now()}`;
      const fullName = from.split("@")[0].toUpperCase();
      await query(
        `INSERT INTO users (id, email, full_name, user_type, tenant_id, company_id, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newUserId, from, fullName, "client", "tenant-acme-id", "company-roadrunner-id", "client_user", true, nowStr]
      );
      userRes = await query("SELECT * FROM users WHERE id = $1", [newUserId]);
      user = userRes.rows[0];
    }

    if (resolvedTicket) {
      const ticketId = resolvedTicket.id;
      const originalStatus = resolvedTicket.status;
      const emailMsgId = `msg-email-${Date.now()}`;

      await query(
        `INSERT INTO messages (id, ticket_id, tenant_id, author_id, author_name, author_role, content, is_internal, source, attachments, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [emailMsgId, ticketId, resolvedTicket.tenant_id, user.id, user.full_name, user.role, body, false, "email", JSON.stringify([]), nowStr]
      );

      let nextStatus = resolvedTicket.status;
      if (resolvedTicket.status === "resolved" || resolvedTicket.status === "awaiting_client") {
        nextStatus = "in_progress";
      }

      await query(
        `UPDATE tickets SET status = $1, updated_at = $2 WHERE id = $3`,
        [nextStatus, nowStr, ticketId]
      );

      return res.json({
        status: "appended_to_thread",
        reference: resolvedTicket.reference,
        previousStatus: originalStatus,
        currentStatus: nextStatus
      });
    } else {
      const tenantRes = await query("SELECT policies FROM sla_policies WHERE tenant_id = 'tenant-acme-id'");
      const policies = tenantRes.rows[0]?.policies || DEFAULT_SLA_POLICIES;
      const slaRule = policies.medium;

      const respTarget = new Date(Date.now() + slaRule.firstResponseMinutes * 60 * 1000).toISOString();
      const resolveTarget = new Date(Date.now() + slaRule.resolutionMinutes * 60 * 1000).toISOString();

      const countRes = await query("SELECT COUNT(*) FROM tickets");
      const tCount = parseInt(countRes.rows[0].count, 10) + 101;
      const reference = `TKT-ACME-${tCount}`;
      const newTicketId = `ticket-email-${Date.now()}`;

      await query(
        `INSERT INTO tickets (id, tenant_id, company_id, company_name, reference, subject, description, status, priority, tier, sla_response_by, sla_resolve_by, is_response_breached, is_resolve_breached, is_response_met, is_resolve_met, custom_fields, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          newTicketId, "tenant-acme-id", "company-roadrunner-id", "Roadrunner Delivery Services", reference,
          subject, body, "new", "medium", "l1", respTarget, resolveTarget, false, false, false, false,
          { channel: "Inbound Email" }, nowStr, nowStr
        ]
      );

      const emailMsgId = `msg-email-init-${Date.now()}`;
      await query(
        `INSERT INTO messages (id, ticket_id, tenant_id, author_id, author_name, author_role, content, is_internal, source, attachments, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [emailMsgId, newTicketId, "tenant-acme-id", user.id, user.full_name, user.role, body, false, "email", JSON.stringify([]), nowStr]
      );

      return res.json({ status: "ticket_created_from_email", reference });
    }
  } catch (err) {
    return res.status(500).json({ error: "Failed to process inbound email" });
  }
});

// 11. Built-in Server-Side Gemini API Triage & AI Copilot
app.post("/api/copilot/triage", async (req, res) => {
  const { subject, description, priority } = req.body;

  if (!subject || !description) {
    return res.status(400).json({ error: "Provide a subject and description to invoke the triage copilot." });
  }

  const prompt = `
  You are an expert Help Desk Triage Co-Pilot named SupportNexus AI.
  Analyzing the incoming customer support ticket:
  ---
  Subject: ${subject}
  Description: ${description}
  Original priority: ${priority || "medium"}
  ---

  Please output a JSON object containing:
  1. "suggestedCategory": string (e.g., "Hardware Failures", "MIME Verification", "Cloud Infrastructure", "VPN Security", "Database Query Check")
  2. "safetyReassessment": string (either "Match original priority" or "Escalate immediate urgency due to production downtime risk")
  3. "suggestedPriority": "low" | "medium" | "high" | "urgent" (re-assessed based on telemetry description)
  4. "draftReplyPattern": string (A highly professional, greeting-rich, canned template reply to the user addressing the specific issues mentioned)
  5. "suggestedTier": "l1" | "l2" | "l3"
  6. "confidenceScore": number (value between 1 and 100 based on standard accuracy variables)

  Respond strictly with the valid JSON object payload only, no prose markdown wrappers outside.
  `;

  try {
    const ai = getGeminiClient();
    if (process.env.GEMINI_API_KEY) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const rawJson = response.text || "{}";
      const cleaned = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();
      return res.json(JSON.parse(cleaned));
    } else {
      throw new Error("Missing key");
    }
  } catch (err) {
    const isS3Fail = subject.toLowerCase().includes("s3") || description.toLowerCase().includes("415");
    const isNuclear = subject.toLowerCase().includes("nuclear") || description.toLowerCase().includes("kelvin");

    let suggestedCategory = "Application Administration";
    let suggestedPriority = priority || "medium";
    let suggestedTier = "l1";
    let draftReplyPattern = `Hi there,\n\nThank you for reaching out to SupportNexus. We have received your query regarding "${subject}". An engineer has been allocated to inspect this immediately.`;

    if (isS3Fail) {
      suggestedCategory = "Cloud Snif-Snapping / MIME Security Check";
      suggestedPriority = "medium";
      suggestedTier = "l2";
      draftReplyPattern = `Hi there,\n\nIt look like your upload throws MIME-sniffing conflicts (HTTP 415). Our senior Level 2 engineering specialist will review the binary signatures to exclude standard safe extensions. Thanks!`;
    } else if (isNuclear) {
      suggestedCategory = "Core Nuclear Regulation / Instruction Scheduling";
      suggestedPriority = "urgent";
      suggestedTier = "l3";
      draftReplyPattern = `CRITICAL ALERT HANDLED:\nOur high priority Level 3 specialists are logging into Gemini Instruction Schedulers to regulate the nuclear power spikes. Stand by for real-time status updates.`;
    }

    return res.json({
      suggestedCategory,
      safetyReassessment: "Match original priority",
      suggestedPriority,
      draftReplyPattern,
      suggestedTier,
      confidenceScore: 89,
      note: "Running local heuristic module (Install GEMINI_API_KEY in Secrets for live Generative AI Analysis)"
    });
  }
});

// 12. Backup entire state (Download JSON DB)
app.get("/api/backup", async (req, res) => {
  try {
    const tenants = (await query("SELECT * FROM tenants")).rows.map(t => ({
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      branding: t.branding,
      isActive: t.is_active,
      createdAt: t.created_at
    }));

    const companies = (await query("SELECT * FROM companies")).rows.map(c => ({
      id: c.id,
      tenantId: c.tenant_id,
      name: c.name,
      createdAt: c.created_at
    }));

    const users = (await query("SELECT * FROM users")).rows.map(mapUser);
    const tickets = (await query("SELECT * FROM tickets")).rows.map(mapTicket);
    const messages = (await query("SELECT * FROM messages")).rows.map(mapMessage);

    const slaRows = (await query("SELECT * FROM sla_policies")).rows;
    const slaPolicies: Record<string, SLAPolicies> = {};
    slaRows.forEach(row => {
      slaPolicies[row.tenant_id] = row.policies;
    });

    const backupData: DatabaseBackup = {
      exportTimestamp: new Date().toISOString(),
      version: "1.0",
      tenants,
      companies,
      users,
      tickets,
      messages,
      slaPolicies
    };

    res.setHeader("Content-Disposition", 'attachment; filename="supportnexus-backup.json"');
    res.setHeader("Content-Type", "application/json");
    return res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate database backup" });
  }
});

// 13. Restore entire state (Upload JSON DB)
app.post("/api/restore", async (req, res) => {
  const { backupData } = req.body;
  if (!backupData || !backupData.tenants || !backupData.users || !backupData.tickets) {
    return res.status(400).json({ error: "Invalid backup format. Must contain tenants, users, and tickets structures." });
  }

  try {
    await query("TRUNCATE messages, tickets, users, companies, sla_policies, tenants CASCADE");

    for (const t of backupData.tenants) {
      await query(
        `INSERT INTO tenants (id, name, subdomain, branding, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [t.id, t.name, t.subdomain, t.branding, t.isActive, t.createdAt]
      );
    }

    for (const c of backupData.companies || []) {
      await query(
        `INSERT INTO companies (id, tenant_id, name, created_at)
         VALUES ($1, $2, $3, $4)`,
        [c.id, c.tenantId, c.name, c.createdAt]
      );
    }

    for (const u of backupData.users) {
      await query(
        `INSERT INTO users (id, email, full_name, user_type, tenant_id, company_id, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [u.id, u.email, u.fullName, u.userType, u.tenantId, u.companyId || null, u.role, u.isActive, u.createdAt]
      );
    }

    for (const t of backupData.tickets) {
      await query(
        `INSERT INTO tickets (id, tenant_id, company_id, company_name, reference, subject, description, status, priority, tier, assigned_to_id, assigned_to_name, sla_response_by, sla_resolve_by, is_response_breached, is_resolve_breached, is_response_met, is_resolve_met, custom_fields, created_at, updated_at, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
        [
          t.id, t.tenantId, t.companyId, t.companyName, t.reference, t.subject, t.description, t.status, t.priority, t.tier,
          t.assignedToId || null, t.assignedToName || null, t.slaResponseBy, t.slaResolveBy, t.isResponseBreached, t.isResolveBreached,
          t.isResponseMet, t.isResolveMet, t.customFields, t.createdAt, t.updatedAt, t.resolvedAt || null
        ]
      );
    }

    for (const m of backupData.messages || []) {
      await query(
        `INSERT INTO messages (id, ticket_id, tenant_id, author_id, author_name, author_role, content, is_internal, source, attachments, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [m.id, m.ticketId, m.tenantId, m.authorId, m.authorName, m.authorRole, m.content, m.isInternal, m.source, JSON.stringify(m.attachments || []), m.createdAt]
      );
    }

    for (const [tenantId, policies] of Object.entries(backupData.slaPolicies || {})) {
      await query(
        `INSERT INTO sla_policies (tenant_id, policies)
         VALUES ($1, $2)`,
        [tenantId, policies]
      );
    }

    return res.json({
      status: "restored_success",
      tenantsCount: backupData.tenants.length,
      ticketsCount: backupData.tickets.length,
      usersCount: backupData.users.length
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to restore database backup" });
  }
});

// Mount Vite middleware in development
async function startServer() {
  await initializeDatabase();

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SupportNexus Full-Stack server up at http://0.0.0.0:${PORT}`);
  });
}

startServer();
