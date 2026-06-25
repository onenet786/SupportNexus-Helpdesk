import { Pool } from "pg";
import fs from "fs";
import path from "path";

// Fallback to local Docker postgres during development if DATABASE_URL is not set
const connectionString = process.env.DATABASE_URL || "postgresql://root:secret_sandbox_vault_key@localhost:5432/supportnexus";

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

let useLocalJsonDb = false;
let localDbLoaded = false;

let localDb: {
  tenants: any[];
  companies: any[];
  users: any[];
  tickets: any[];
  messages: any[];
  sla_policies: any[];
} = {
  tenants: [],
  companies: [],
  users: [],
  tickets: [],
  messages: [],
  sla_policies: [],
};

const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const snakeToCamel = (str: string) => str.replace(/(_\w)/g, m => m[1].toUpperCase());

const toSnakeCase = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      if (['branding', 'customFields', 'policies', 'attachments'].includes(key)) {
        res[camelToSnake(key)] = obj[key];
      } else {
        res[camelToSnake(key)] = toSnakeCase(obj[key]);
      }
    }
    return res;
  }
  return obj;
};

const toCamelCase = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      if (['branding', 'custom_fields', 'policies', 'attachments'].includes(key)) {
        res[snakeToCamel(key)] = obj[key];
      } else {
        res[snakeToCamel(key)] = toCamelCase(obj[key]);
      }
    }
    return res;
  }
  return obj;
};

const loadLocalDb = () => {
  if (localDbLoaded) return;
  try {
    const dbPath = path.join(process.cwd(), "db.json");
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, "utf8");
      const camelData = JSON.parse(raw);
      const slaArray: any[] = [];
      if (camelData.slaPolicies) {
        for (const [tenantId, policies] of Object.entries(camelData.slaPolicies)) {
          slaArray.push({ tenant_id: tenantId, policies });
        }
      }
      localDb = {
        tenants: toSnakeCase(camelData.tenants || []),
        companies: toSnakeCase(camelData.companies || []),
        users: toSnakeCase(camelData.users || []),
        tickets: toSnakeCase(camelData.tickets || []),
        messages: toSnakeCase(camelData.messages || []),
        sla_policies: slaArray,
      };
      localDbLoaded = true;
    }
  } catch (err) {
    console.error("Failed to load local db:", err);
  }
};

const saveLocalDb = () => {
  try {
    const dbPath = path.join(process.cwd(), "db.json");
    const slaPolicies: any = {};
    localDb.sla_policies.forEach(item => {
      slaPolicies[item.tenant_id] = item.policies;
    });
    const camelData = {
      exportTimestamp: new Date().toISOString(),
      version: "1.0",
      tenants: toCamelCase(localDb.tenants),
      companies: toCamelCase(localDb.companies),
      users: toCamelCase(localDb.users),
      tickets: toCamelCase(localDb.tickets),
      messages: toCamelCase(localDb.messages),
      slaPolicies: slaPolicies,
    };
    fs.writeFileSync(dbPath, JSON.stringify(camelData, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save local db:", err);
  }
};

const executeLocalQuery = (text: string, params: any[] = []): { rows: any[]; rowCount: number } => {
  loadLocalDb();
  const trimmed = text.trim();

  // 1. Schema Check / Table Creation / ALTER / etc.
  if (trimmed.includes("CREATE TABLE") || trimmed.includes("ALTER TABLE")) {
    return { rows: [], rowCount: 0 };
  }

  // 2. TRUNCATE
  if (trimmed.includes("TRUNCATE")) {
    localDb.tenants = [];
    localDb.companies = [];
    localDb.users = [];
    localDb.tickets = [];
    localDb.messages = [];
    localDb.sla_policies = [];
    saveLocalDb();
    return { rows: [], rowCount: 0 };
  }

  // 3. INSERT
  const insertMatch = trimmed.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (insertMatch) {
    const tableName = insertMatch[1].toLowerCase();
    const columns = insertMatch[2].split(",").map(c => c.trim().toLowerCase());
    
    const newRow: any = {};
    columns.forEach((col, idx) => {
      let val = params[idx];
      if (typeof val === 'string' && (col === 'branding' || col === 'custom_fields' || col === 'policies' || col === 'attachments')) {
        try {
          val = JSON.parse(val);
        } catch (e) {}
      }
      newRow[col] = val;
    });

    const table = localDb[tableName as keyof typeof localDb];
    if (table) {
      let hasConflict = false;
      if (tableName === 'tenants') {
        hasConflict = table.some(r => r.id === newRow.id);
      } else if (tableName === 'companies') {
        hasConflict = table.some(r => r.id === newRow.id);
      } else if (tableName === 'users') {
        hasConflict = table.some(r => r.id === newRow.id || r.email === newRow.email);
      } else if (tableName === 'tickets') {
        hasConflict = table.some(r => r.id === newRow.id || r.reference === newRow.reference);
      } else if (tableName === 'messages') {
        hasConflict = table.some(r => r.id === newRow.id);
      } else if (tableName === 'sla_policies') {
        hasConflict = table.some(r => r.tenant_id === newRow.tenant_id);
      }

      if (!hasConflict) {
        table.push(newRow);
        saveLocalDb();
        return { rows: [newRow], rowCount: 1 };
      } else {
        return { rows: [], rowCount: 0 };
      }
    }
  }

  // 4. UPDATE
  const updateMatch = trimmed.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
  if (updateMatch) {
    const tableName = updateMatch[1].toLowerCase();
    const setPart = updateMatch[2];
    const wherePart = updateMatch[3];

    const table = localDb[tableName as keyof typeof localDb];
    if (table) {
      const idMatch = wherePart.match(/id\s*=\s*\$(\d+)/i);
      let targetId: string | null = null;
      if (idMatch) {
        const idx = parseInt(idMatch[1], 10) - 1;
        targetId = params[idx];
      }

      if (targetId) {
        const rowsToUpdate = table.filter(r => r.id === targetId);
        if (rowsToUpdate.length > 0) {
          const assignments = setPart.split(",").map(s => s.trim());
          rowsToUpdate.forEach(row => {
            assignments.forEach(assignment => {
              const parts = assignment.split("=").map(p => p.trim());
              const col = parts[0].toLowerCase();
              const valPlaceholder = parts[1];
              
              let val: any;
              if (valPlaceholder.startsWith("$")) {
                const paramIdx = parseInt(valPlaceholder.slice(1), 10) - 1;
                val = params[paramIdx];
              } else {
                const literal = valPlaceholder;
                if (literal.startsWith("'") && literal.endsWith("'")) {
                  val = literal.slice(1, -1);
                } else if (literal === "true") {
                  val = true;
                } else if (literal === "false") {
                  val = false;
                } else if (literal === "null") {
                  val = null;
                } else {
                  val = literal;
                }
              }
              row[col] = val;
            });
          });
          saveLocalDb();
          return { rows: rowsToUpdate, rowCount: rowsToUpdate.length };
        }
      }
    }
  }

  // 5. SELECT count(*) / COUNT(*) FROM table
  if (trimmed.match(/^SELECT\s+count\(\*\)\s+FROM\s+(\w+)$/i)) {
    const table = trimmed.match(/^SELECT\s+count\(\*\)\s+FROM\s+(\w+)$/i)![1].toLowerCase();
    const count = (localDb[table as keyof typeof localDb] || []).length;
    return { rows: [{ count }], rowCount: 1 };
  }

  const countTenantMatch = trimmed.match(/^SELECT\s+COUNT\(\*\)\s+FROM\s+tickets\s+WHERE\s+tenant_id\s*=\s*\$(\d+)$/i);
  if (countTenantMatch) {
    const idx = parseInt(countTenantMatch[1], 10) - 1;
    const tenantIdVal = params[idx];
    const count = localDb.tickets.filter(r => r.tenant_id === tenantIdVal).length;
    return { rows: [{ count }], rowCount: 1 };
  }

  const countTotalMatch = trimmed.match(/^SELECT\s+COUNT\(\*\)\s+FROM\s+tickets$/i);
  if (countTotalMatch) {
    const count = localDb.tickets.length;
    return { rows: [{ count }], rowCount: 1 };
  }

  // 6. SELECT with LOWER(email) = LOWER($1)
  if (trimmed.includes("FROM users WHERE LOWER(email) = LOWER($1)")) {
    const emailVal = params[0]?.toLowerCase();
    const rows = localDb.users.filter(r => r.email?.toLowerCase() === emailVal);
    return { rows, rowCount: rows.length };
  }

  // 7. SELECT * FROM users WHERE email = $1
  if (trimmed.includes("FROM users WHERE email = $1")) {
    const emailVal = params[0];
    const rows = localDb.users.filter(r => r.email === emailVal);
    return { rows, rowCount: rows.length };
  }

  // 8. SELECT company_id FROM users WHERE id = $1
  if (trimmed.includes("SELECT company_id FROM users WHERE id = $1")) {
    const idVal = params[0];
    const rows = localDb.users.filter(r => r.id === idVal).map(r => ({ company_id: r.company_id }));
    return { rows, rowCount: rows.length };
  }

  // 9. SELECT company_id FROM users WHERE email = $1
  if (trimmed.includes("SELECT company_id FROM users WHERE email = $1")) {
    const emailVal = params[0];
    const rows = localDb.users.filter(r => r.email === emailVal).map(r => ({ company_id: r.company_id }));
    return { rows, rowCount: rows.length };
  }

  // 10. SELECT * FROM companies WHERE tenant_id = $1 LIMIT 1
  if (trimmed.includes("FROM companies WHERE tenant_id = $1 LIMIT 1")) {
    const tenantIdVal = params[0];
    const rows = localDb.companies.filter(r => r.tenant_id === tenantIdVal).slice(0, 1);
    return { rows, rowCount: rows.length };
  }

  // 11. SELECT policies FROM sla_policies WHERE tenant_id = $1
  if (trimmed.includes("FROM sla_policies WHERE tenant_id = $1")) {
    const tenantIdVal = params[0];
    const rows = localDb.sla_policies.filter(r => r.tenant_id === tenantIdVal).map(r => ({ policies: r.policies }));
    return { rows, rowCount: rows.length };
  }

  // 12. SELECT * FROM tickets WHERE reference = $1
  if (trimmed.includes("FROM tickets WHERE reference = $1")) {
    const refVal = params[0];
    const rows = localDb.tickets.filter(r => r.reference === refVal);
    return { rows, rowCount: rows.length };
  }

  // 13. SELECT * FROM tickets WHERE status != 'resolved'
  if (trimmed.includes("FROM tickets WHERE status != 'resolved'")) {
    const rows = localDb.tickets.filter(r => r.status !== 'resolved');
    return { rows, rowCount: rows.length };
  }

  // 14. SELECT * FROM messages WHERE ticket_id = $1
  if (trimmed.includes("FROM messages WHERE ticket_id = $1")) {
    const ticketIdVal = params[0];
    let rows = localDb.messages.filter(r => r.ticket_id === ticketIdVal);
    if (trimmed.includes("is_internal = FALSE")) {
      rows = rows.filter(r => !r.is_internal);
    }
    rows = rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return { rows, rowCount: rows.length };
  }

  // 15. SELECT * FROM tickets WHERE 1=1 (dynamic filters)
  if (trimmed.includes("FROM tickets WHERE 1=1")) {
    let rows = [...localDb.tickets];
    
    const tenantMatch = trimmed.match(/tenant_id\s*=\s*\$(\d+)/);
    if (tenantMatch) {
      const idx = parseInt(tenantMatch[1], 10) - 1;
      const tenantVal = params[idx];
      rows = rows.filter(r => r.tenant_id === tenantVal);
    }

    const companyMatch = trimmed.match(/company_id\s*=\s*\$(\d+)/);
    if (companyMatch) {
      const idx = parseInt(companyMatch[1], 10) - 1;
      const companyVal = params[idx];
      rows = rows.filter(r => r.company_id === companyVal);
    }

    const statusMatch = trimmed.match(/status\s*=\s*\$(\d+)/);
    if (statusMatch) {
      const idx = parseInt(statusMatch[1], 10) - 1;
      const statusVal = params[idx];
      rows = rows.filter(r => r.status === statusVal);
    }

    const priorityMatch = trimmed.match(/priority\s*=\s*\$(\d+)/);
    if (priorityMatch) {
      const idx = parseInt(priorityMatch[1], 10) - 1;
      const priorityVal = params[idx];
      rows = rows.filter(r => r.priority === priorityVal);
    }

    const searchMatch = trimmed.match(/LOWER\(subject\)\s+LIKE\s+\$(\d+)/);
    if (searchMatch) {
      const idx = parseInt(searchMatch[1], 10) - 1;
      let searchVal = params[idx] as string;
      if (searchVal) {
        searchVal = searchVal.replace(/%/g, "").toLowerCase();
        rows = rows.filter(r => 
          r.subject?.toLowerCase().includes(searchVal) || 
          r.description?.toLowerCase().includes(searchVal) || 
          r.reference?.toLowerCase().includes(searchVal)
        );
      }
    }

    rows = rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { rows, rowCount: rows.length };
  }

  // 16. SELECT * FROM tickets WHERE tenant_id = $1 (dashboard report case)
  const dashboardMatch = trimmed.match(/^SELECT\s+\*\s+FROM\s+tickets\s+WHERE\s+tenant_id\s*=\s*\$(\d+)$/i);
  if (dashboardMatch) {
    const idx = parseInt(dashboardMatch[1], 10) - 1;
    const tenantIdVal = params[idx];
    const rows = localDb.tickets.filter(r => r.tenant_id === tenantIdVal);
    return { rows, rowCount: rows.length };
  }

  // 17. SELECT * FROM table WHERE id = $1
  const selectIdMatch = trimmed.match(/^SELECT\s+\*\s+FROM\s+(\w+)\s+WHERE\s+id\s*=\s*\$(\d+)$/i);
  if (selectIdMatch) {
    const table = selectIdMatch[1].toLowerCase();
    const idx = parseInt(selectIdMatch[2], 10) - 1;
    const idVal = params[idx];
    const rows = (localDb[table as keyof typeof localDb] || []).filter(r => r.id === idVal);
    return { rows, rowCount: rows.length };
  }

  // 18. SELECT * FROM table (fallback for full selects)
  const selectAllMatch = trimmed.match(/^SELECT\s+\*\s+FROM\s+(\w+)$/i);
  if (selectAllMatch) {
    const table = selectAllMatch[1].toLowerCase();
    const rows = localDb[table as keyof typeof localDb] || [];
    return { rows, rowCount: rows.length };
  }

  console.warn("Unmatched local SQL query:", text, params);
  return { rows: [], rowCount: 0 };
};

export const query = async (text: string, params?: any[]) => {
  if (useLocalJsonDb) {
    const start = Date.now();
    const res = executeLocalQuery(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "production") {
      console.log("[JSON DB] Executed query:", { text, duration, rows: res.rowCount });
    }
    return res;
  }

  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "production") {
      console.log("Executed query:", { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (err: any) {
    if (
      err.code === "ECONNREFUSED" || 
      err.message?.includes("connect ECONNREFUSED") || 
      err.message?.includes("connection timeout")
    ) {
      console.warn("PostgreSQL connection failed. Falling back to local-first JSON database simulation (db.json)...");
      useLocalJsonDb = true;
      const res = executeLocalQuery(text, params);
      return res;
    }
    throw err;
  }
};
