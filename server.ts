import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { 
  Tenant, Company, User, Ticket, Message, Attachment, 
  SLAPolicies, DatabaseBackup, TicketStatus, TicketPriority, UserRole
} from "./src/types";

const app = express();
const PORT = 3000;
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

// Safe DB Read/Write
const readDb = (): DatabaseBackup => {
  if (!fs.existsSync(DB_FILE)) {
    const freshSeed = createInitialSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(freshSeed, null, 2), "utf-8");
    return freshSeed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("DB file corrupt or error-prone. Re-creating template...");
    const freshSeed = createInitialSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(freshSeed, null, 2), "utf-8");
    return freshSeed;
  }
};

const writeDb = (data: DatabaseBackup) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
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
const authenticateUserByEmail = (email: string): User | null => {
  const db = readDb();
  const found = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  return found || null;
};

// API Router
// 1. Authenticate user (for mock login sessions)
app.post("/api/auth/login", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const user = authenticateUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid user credentials. Please check seed accounts." });
  }
  return res.json({ user, token: `mock-token-${user.id}` });
});

// 2. Fetch active databases/tickets
app.get("/api/tickets", (req, res) => {
  const db = readDb();
  const tenantId = req.headers["x-tenant-id"] as string;
  const userRole = req.headers["x-user-role"] as string;
  const userId = req.headers["x-user-id"] as string;

  let filtered = db.tickets;

  // Multi-tenant separation: Row-Level Security simulation
  if (tenantId) {
    filtered = filtered.filter(t => t.tenantId === tenantId);
  }

  // Client user isolation: Can only see their organization's tickets
  if (userRole === "client_user" && userId) {
    const userObj = db.users.find(u => u.id === userId);
    if (userObj?.companyId) {
      filtered = filtered.filter(t => t.companyId === userObj.companyId);
    } else {
      filtered = []; // None found
    }
  }

  // Handle simple filter options
  const status = req.query.status as string;
  if (status) {
    filtered = filtered.filter(t => t.status === status);
  }

  const priority = req.query.priority as string;
  if (priority) {
    filtered = filtered.filter(t => t.priority === priority);
  }

  // Search filter
  const search = req.query.search as string;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(t => 
      t.subject.toLowerCase().includes(q) || 
      t.description.toLowerCase().includes(q) ||
      t.reference.toLowerCase().includes(q)
    );
  }

  return res.json({ data: filtered });
});

// 3. Get ticket details with authentic messages
app.get("/api/tickets/:id", (req, res) => {
  const db = readDb();
  const { id } = req.params;
  const userRole = req.headers["x-user-role"] as string;

  const ticket = db.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  // Client user secondary safety isolation
  if (userRole === "client_user") {
    const clientUserEmail = req.headers["x-user-email"] as string;
    const client = db.users.find(u => u.email === clientUserEmail);
    if (client && ticket.companyId !== client.companyId) {
      return res.status(403).json({ error: "Forbidden: Cross-tenant data leakage prevented by RLS" });
    }
  }

  // Message threading: public replies vs internal notes
  let mThreads = db.messages.filter(m => m.ticketId === id);
  if (userRole === "client_user") {
    // Rigid scope control: NEVER let isInternal discussions escape to customer portal client-side
    mThreads = mThreads.filter(m => !m.isInternal);
  }

  return res.json({ ticket, messages: mThreads });
});

// 4. Create single tickets (with Dynamic SLA generation & Idempotent tracker simulation)
app.post("/api/tickets", (req, res) => {
  const db = readDb();
  const { subject, description, priority, companyId, tenantId, customFields } = req.body;
  const authorEmail = req.headers["x-user-email"] as string || "customer@acme.com";

  if (!subject || !description || !priority || !tenantId) {
    return res.status(400).json({ error: "Please input high constraints: subject, description, priority, and tenant" });
  }

  const tenant = db.tenants.find(t => t.id === tenantId);
  const company = db.companies.find(c => c.id === companyId) || db.companies[0];
  const author = db.users.find(u => u.email === authorEmail);

  if (!tenant) {
    return res.status(404).json({ error: "Invalid Tenant" });
  }

  // Dynamic SLA allocation based on Tenant setup
  const tenantSla = db.slaPolicies[tenantId] || DEFAULT_SLA_POLICIES;
  const slaRule = tenantSla[priority as TicketPriority] || tenantSla.medium;

  const respTarget = new Date(Date.now() + slaRule.firstResponseMinutes * 60 * 1000).toISOString();
  const resolveTarget = new Date(Date.now() + slaRule.resolutionMinutes * 60 * 1000).toISOString();

  // Create human-readable serial reference PK
  const tenantSub = tenant.subdomain.toUpperCase();
  const tCount = db.tickets.filter(t => t.tenantId === tenantId).length + 101;
  const reference = `TKT-${tenantSub}-${tCount}`;

  const newTicket: Ticket = {
    id: `ticket-gen-${Date.now()}`,
    tenantId,
    companyId: company.id,
    companyName: company.name,
    reference,
    subject,
    description,
    status: "new",
    priority: priority as TicketPriority,
    tier: "l1",
    slaResponseBy: respTarget,
    slaResolveBy: resolveTarget,
    isResponseBreached: false,
    isResolveBreached: false,
    isResponseMet: false,
    isResolveMet: false,
    customFields: customFields || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.tickets.unshift(newTicket);

  // Auto-initiate message thread with the initial submission body
  const initialMsg: Message = {
    id: `msg-gen-${Date.now()}`,
    ticketId: newTicket.id,
    tenantId,
    authorId: author ? author.id : "guest-id",
    authorName: author ? author.fullName : "Guest Submitter",
    authorRole: author ? author.role : "client_user",
    content: description,
    isInternal: false,
    source: "portal",
    attachments: [],
    createdAt: new Date().toISOString()
  };

  db.messages.push(initialMsg);
  writeDb(db);

  return res.status(201).json(newTicket);
});

// 5. Submit Message to Thread (Validates strict internal note separation & customer safety)
app.post("/api/tickets/:id/messages", (req, res) => {
  const db = readDb();
  const { id } = req.params;
  const { content, isInternal, source, attachments } = req.body;
  const authorEmail = req.headers["x-user-email"] as string;

  const ticket = db.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const author = db.users.find(u => u.email === authorEmail);
  if (!author) {
    return res.status(404).json({ error: "Author not found" });
  }

  // Validation: client_user is strictly forbidden from posting/reading internal flags
  const finalIsInternal = author.role === "client_user" ? false : !!isInternal;

  const newMessage: Message = {
    id: `msg-gen-${Date.now()}`,
    ticketId: id,
    tenantId: ticket.tenantId,
    authorId: author.id,
    authorName: author.fullName,
    authorRole: author.role,
    content,
    isInternal: finalIsInternal,
    source: source || 'portal',
    attachments: attachments || [],
    createdAt: new Date().toISOString()
  };

  db.messages.push(newMessage);

  // If client replies or agent acts, update ticket details
  ticket.updatedAt = new Date().toISOString();
  if (author.role === "client_user" && ticket.status === "awaiting_client") {
    // Reopen immediately upon customer feedback
    ticket.status = "in_progress";
  }

  // Update SLA stats on first agent reply
  if (author.role !== "client_user" && !ticket.isResponseMet) {
    ticket.isResponseMet = true;
    const now = new Date();
    const limit = new Date(ticket.slaResponseBy);
    if (now > limit) {
      ticket.isResponseBreached = true;
    }
  }

  writeDb(db);
  return res.status(201).json(newMessage);
});

// 6. Transition Ticket Status (Validates explicit state machine routes!)
app.post("/api/tickets/:id/status", (req, res) => {
  const db = readDb();
  const { id } = req.params;
  const { status } = req.body;
  const userRole = req.headers["x-user-role"] as string;

  const ticket = db.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const currentStatus = ticket.status;
  const nextStatus = status as TicketStatus;

  // Strict transition verification
  const validTransitions: Record<TicketStatus, TicketStatus[]> = {
    new: ["in_progress", "resolved"],
    in_progress: ["awaiting_client", "escalated", "resolved"],
    awaiting_client: ["in_progress", "resolved"],
    escalated: ["in_progress", "resolved", "awaiting_client"],
    resolved: ["in_progress"] // client can reopen
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    return res.status(422).json({ 
      error: `INVALID_STATUS_TRANSITION: Cannot transition ticket from ${currentStatus} to ${nextStatus}.` 
    });
  }

  // Update status
  ticket.status = nextStatus;
  ticket.updatedAt = new Date().toISOString();
  if (nextStatus === "resolved") {
    ticket.resolvedAt = new Date().toISOString();
    ticket.isResolveMet = true;
    if (new Date() > new Date(ticket.slaResolveBy)) {
      ticket.isResolveBreached = true;
    }
  }

  // System notification thread entry
  const systemMsg: Message = {
    id: `msg-system-${Date.now()}`,
    ticketId: id,
    tenantId: ticket.tenantId,
    authorId: "system",
    authorName: "Nexus Engine",
    authorRole: "admin",
    content: `Ticket status updated from ${currentStatus.toUpperCase()} to ${nextStatus.toUpperCase()}`,
    isInternal: false,
    source: "system",
    attachments: [],
    createdAt: new Date().toISOString()
  };
  db.messages.push(systemMsg);

  writeDb(db);
  return res.json(ticket);
});

// 7. Tiered Escalation Endpoint (L1 -> L2 -> L3 sequentially)
app.post("/api/tickets/:id/escalate", (req, res) => {
  const db = readDb();
  const { id } = req.params;
  const { reason, targetTier } = req.body;
  const authorEmail = req.headers["x-user-email"] as string;

  const ticket = db.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const agent = db.users.find(u => u.email === authorEmail);
  if (!agent) {
    return res.status(404).json({ error: "Agent check failed" });
  }

  if (!reason || reason.length < 10) {
    return res.status(400).json({ error: "An escalation requires an internal note reason of at least 10 characters." });
  }

  const currentTier = ticket.tier;
  let nextTier: 'l1' | 'l2' | 'l3' = targetTier;

  // Enforce sequential tier jumps for L1 agents
  if (agent.role === "l1_agent") {
    nextTier = "l2";
  } else if (agent.role === "l2_agent") {
    nextTier = "l3";
  } else if (!nextTier) {
    nextTier = "l2";
  }

  ticket.tier = nextTier;
  ticket.status = "escalated";
  ticket.updatedAt = new Date().toISOString();

  // Create immediate mandatory yellow discussion note with historical context
  const noteContent = `**[ESCALATION NOTICE L1→${nextTier.toUpperCase()}]** Reason: ${reason}. Escalated by ${agent.fullName}.`;
  const internalEscalationMsg: Message = {
    id: `msg-escalate-${Date.now()}`,
    ticketId: id,
    tenantId: ticket.tenantId,
    authorId: agent.id,
    authorName: agent.fullName,
    authorRole: agent.role,
    content: noteContent,
    isInternal: true, // Internal only! Must be locked from clients
    source: "portal",
    attachments: [],
    createdAt: new Date().toISOString()
  };

  db.messages.push(internalEscalationMsg);
  writeDb(db);

  return res.json(ticket);
});

// 8. SLA Breach Scanner background trigger (Simulate cron ticks on demand)
app.post("/api/sla/trigger-check", (req, res) => {
  const db = readDb();
  const now = new Date();
  let updatedCount = 0;

  db.tickets.forEach(t => {
    if (t.status !== "resolved") {
      const respDate = new Date(t.slaResponseBy);
      const resolveDate = new Date(t.slaResolveBy);

      if (now > respDate && !t.isResponseMet && !t.isResponseBreached) {
        t.isResponseBreached = true;
        updatedCount++;
      }
      if (now > resolveDate && !t.isResolveMet && !t.isResolveBreached) {
        t.isResolveBreached = true;
        updatedCount++;
      }
    }
  });

  if (updatedCount > 0) {
    writeDb(db);
  }
  return res.json({ status: "success", checkedAt: now.toISOString(), breachedRowsTriggered: updatedCount });
});

// 9. Operational dashboard metrics queries
app.get("/api/reports/dashboard", (req, res) => {
  const db = readDb();
  const tenantId = req.headers["x-tenant-id"] as string;

  const tickets = db.tickets.filter(t => !tenantId || t.tenantId === tenantId);

  const openTickets = tickets.filter(t => t.status !== "resolved");
  const resolvedTickets = tickets.filter(t => t.status === "resolved");

  const newCount = tickets.filter(t => t.status === "new").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const awaitingCount = tickets.filter(t => t.status === "awaiting_client").length;
  const escalatedCount = tickets.filter(t => t.status === "escalated").length;

  const breachedResponseCount = tickets.filter(t => t.isResponseBreached).length;
  const breachedResolveCount = tickets.filter(t => t.isResolveBreached).length;

  const totalSlaCalculable = tickets.length;
  const metSlaCount = tickets.filter(t => !t.isResponseBreached && !t.isResolveBreached).length;
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
});

// 10. Inbound Email webhook emulator
app.post("/api/webhook/email/inbound", (req, res) => {
  const db = readDb();
  const { from, subject, body } = req.body;

  if (!from || !subject || !body) {
    return res.status(400).json({ error: "Email must include values for: from, subject, and body." });
  }

  // Look for thread Reference indicators like '[TKT-ACME-0002]'
  const matchRef = subject.match(/(TKT-\w+-\d+)/i);
  let resolvedTicket: Ticket | undefined = undefined;

  if (matchRef) {
    const matchedRefString = matchRef[0].toUpperCase();
    resolvedTicket = db.tickets.find(t => t.reference === matchedRefString);
  }

  // Resolve user profile or create dynamic guest
  let user = db.users.find(u => u.email.toLowerCase() === from.toLowerCase());
  if (!user) {
    // Lazy guest user creation
    user = {
      id: `user-guest-${Date.now()}`,
      email: from,
      fullName: from.split("@")[0].toUpperCase(),
      userType: "client",
      tenantId: "tenant-acme-id",
      companyId: "company-roadrunner-id",
      role: "client_user",
      isActive: true,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    db.companies[0] && db.companies[0].name;
  }

  if (resolvedTicket) {
    // Append message reply to thread
    const ticketId = resolvedTicket.id;
    const originalStatus = resolvedTicket.status;

    const emailMsg: Message = {
      id: `msg-email-${Date.now()}`,
      ticketId,
      tenantId: resolvedTicket.tenantId,
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role,
      content: body,
      isInternal: false,
      source: "email",
      attachments: [],
      createdAt: new Date().toISOString()
    };

    db.messages.push(emailMsg);
    // Automatic reopened workflow
    if (resolvedTicket.status === "resolved" || resolvedTicket.status === "awaiting_client") {
      resolvedTicket.status = "in_progress";
    }
    resolvedTicket.updatedAt = new Date().toISOString();

    writeDb(db);
    return res.json({ status: "appended_to_thread", reference: resolvedTicket.reference, previousStatus: originalStatus, currentStatus: resolvedTicket.status });
  } else {
    // Create new ticket altogether from cold intake email
    const tenantSla = db.slaPolicies["tenant-acme-id"] || DEFAULT_SLA_POLICIES;
    const slaRule = tenantSla.medium; // default allocation

    const respTarget = new Date(Date.now() + slaRule.firstResponseMinutes * 60 * 1000).toISOString();
    const resolveTarget = new Date(Date.now() + slaRule.resolutionMinutes * 60 * 1000).toISOString();

    const reference = `TKT-ACME-${db.tickets.length + 101}`;

    const newTicket: Ticket = {
      id: `ticket-email-${Date.now()}`,
      tenantId: "tenant-acme-id",
      companyId: "company-roadrunner-id",
      companyName: "Roadrunner Delivery Services",
      reference,
      subject,
      description: body,
      status: "new",
      priority: "medium",
      tier: "l1",
      slaResponseBy: respTarget,
      slaResolveBy: resolveTarget,
      isResponseBreached: false,
      isResolveBreached: false,
      isResponseMet: false,
      isResolveMet: false,
      customFields: { channel: "Inbound Email" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.tickets.unshift(newTicket);

    const emailMsg: Message = {
      id: `msg-email-init-${Date.now()}`,
      ticketId: newTicket.id,
      tenantId: "tenant-acme-id",
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role,
      content: body,
      isInternal: false,
      source: "email",
      attachments: [],
      createdAt: new Date().toISOString()
    };
    db.messages.push(emailMsg);

    writeDb(db);
    return res.json({ status: "ticket_created_from_email", reference: newTicket.reference });
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
    // Graceful fallback when Gemini key is missing or invalid.
    // Extremely clean programmatic heuristics to assure immediate responsiveness of the UI.
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
app.get("/api/backup", (req, res) => {
  const db = readDb();
  res.setHeader("Content-Disposition", 'attachment; filename="supportnexus-backup.json"');
  res.setHeader("Content-Type", "application/json");
  return res.send(JSON.stringify(db, null, 2));
});

// 13. Restore entire state (Upload JSON DB)
app.post("/api/restore", (req, res) => {
  const { backupData } = req.body;
  if (!backupData || !backupData.tenants || !backupData.users || !backupData.tickets) {
    return res.status(400).json({ error: "Invalid backup format. Must contain tenants, users, and tickets structures." });
  }

  // Format validations
  const restoredDb: DatabaseBackup = {
    exportTimestamp: new Date().toISOString(),
    version: backupData.version || "1.0",
    tenants: backupData.tenants,
    companies: backupData.companies || [],
    users: backupData.users,
    tickets: backupData.tickets,
    messages: backupData.messages || [],
    slaPolicies: backupData.slaPolicies || { "tenant-acme-id": DEFAULT_SLA_POLICIES }
  };

  writeDb(restoredDb);
  return res.json({ status: "restored_success", tenantsCount: restoredDb.tenants.length, ticketsCount: restoredDb.tickets.length, usersCount: restoredDb.users.length });
});

// Mount Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
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
