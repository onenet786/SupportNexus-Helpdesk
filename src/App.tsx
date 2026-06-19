import React, { useState, useEffect } from 'react';
import { 
  Shield, Server, Key, Database, RefreshCw, FileText, 
  Send, AlertTriangle, CheckCircle, Clock, ChevronRight, 
  ArrowUpRight, Bot, Compass, PlusCircle, Search, Filter, 
  MessageSquare, User, Building, HardDrive, Download, Upload, 
  ArrowRight, Users, Bell, Mail, Sparkles, HelpCircle, Laptop,
  Lock, AlertCircle
} from 'lucide-react';
import { 
  Ticket, Message, Tenant, Company, SLAPolicies, DatabaseBackup,
  TicketStatus, TicketPriority, UserRole
} from './types';

// Seeded users available for login simulation
const DEMO_USERS = [
  { email: 'admin@supportnexus.app', name: 'Alex Rivera', role: 'admin', type: 'internal', label: 'Platform Admin Operator' },
  { email: 'l1@supportnexus.app', name: 'Sarah Connor', role: 'l1_agent', type: 'internal', label: 'Level 1 Triage Rep' },
  { email: 'l2@supportnexus.app', name: 'Marcus Wright', role: 'l2_agent', type: 'internal', label: 'Level 2 Specialized Specialist' },
  { email: 'l3@supportnexus.app', name: 'Dr. John Connor', role: 'l3_agent', type: 'internal', label: 'Level 3 Emergency Overrider' },
  { email: 'customer@acme.com', name: 'Wile E. Coyote', role: 'client_user', type: 'client', label: 'Acme Client User' },
  { email: 'customer@globex.com', name: 'Hank Scorpio', role: 'client_user', type: 'client', label: 'Globex Client User' }
];

export default function App() {
  // Session State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTenant, setActiveTenant] = useState<string>('tenant-acme-id');
  const [emailInput, setEmailInput] = useState('customer@acme.com');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Application Data States
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // UI Interactive States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [showSelfHostModal, setShowSelfHostModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'tickets' | 'dashboard' | 'selfhosted'>('tickets');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // New Ticket State
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium');
  const [newDevice, setNewDevice] = useState('Ankle Accel-800');
  const [newSerial, setNewSerial] = useState('');
  const [newOS, setNewOS] = useState('Debian 12');
  const [isCreating, setIsCreating] = useState(false);

  // Thread Reply State
  const [replyText, setReplyText] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  // Escalation Modal Logic State
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateTarget, setEscalateTarget] = useState<'l2' | 'l3'>('l2');
  const [isEscalating, setIsEscalating] = useState(false);

  // AI Copilot States
  const [isTriageLoading, setIsTriageLoading] = useState(false);
  const [aiTriageResult, setAiTriageResult] = useState<any>(null);

  // Backup/Restore raw formats
  const [backupJsonText, setBackupJsonText] = useState('');

  // Simulated Email Hook Input State
  const [emailInboundFrom, setEmailInboundFrom] = useState('customer@acme.com');
  const [emailInboundSubject, setEmailInboundSubject] = useState('Need assistance with [TKT-ACME-0001]');
  const [emailInboundBody, setEmailInboundBody] = useState('I am responding to let you know the test rockets are still sparky.');
  const [isSimulatingEmail, setIsSimulatingEmail] = useState(false);

  // Automated Toast Timer hook
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load Seed and Initial Data On Mount / Tenant Switching
  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadTickets();
      loadDashboardMetrics();
    }
  }, [currentUser, activeTenant, statusFilter, priorityFilter, searchQuery]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const loadMetadata = async () => {
    try {
      // Fetch tickets once to populate core tables or fallback
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@supportnexus.app' })
      });
      if (loginRes.ok) {
        // Safe database triggers
        const backupRes = await fetch('/api/backup');
        if (backupRes.ok) {
          const dbText: DatabaseBackup = await backupRes.json();
          setTenants(dbText.tenants || []);
          setCompanies(dbText.companies || []);
        }
      }
    } catch (err) {
      console.error("Failed to boot metadata: ", err);
    }
  };

  const loadTickets = async () => {
    if (!currentUser) return;
    try {
      let url = `/api/tickets?tenantId=${activeTenant}`;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (searchQuery) params.append('search', searchQuery);
      
      const queryStr = params.toString();
      if (queryStr) url += `&${queryStr}`;

      const res = await fetch(url, {
        headers: {
          'x-tenant-id': activeTenant,
          'x-user-role': currentUser.role,
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email
        }
      });
      if (res.ok) {
        const payload = await res.json();
        setTickets(payload.data || []);
        // Automatically sync details of the active ticket if loaded
        if (activeTicket) {
          const refreshedActive = (payload.data as Ticket[]).find(t => t.id === activeTicket.id);
          if (refreshedActive) {
            setActiveTicket(refreshedActive);
          }
        }
      }
    } catch (err) {
      showToast("Network fault syncing tickets", "error");
    }
  };

  const loadDashboardMetrics = async () => {
    try {
      const res = await fetch('/api/reports/dashboard', {
        headers: {
          'x-tenant-id': activeTenant
        }
      });
      if (res.ok) {
        const metrics = await res.json();
        setDashboardMetrics(metrics);
      }
    } catch (err) {
      console.warn("Failed metrics pull");
    }
  };

  const selectTicket = async (ticket: Ticket) => {
    setActiveTicket(ticket);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        headers: {
          'x-user-role': currentUser.role,
          'x-user-email': currentUser.email
        }
      });
      if (res.ok) {
        const payload = await res.json();
        setMessages(payload.messages || []);
      }
    } catch (err) {
      showToast("Could not load replies thread", "error");
    }
  };

  const handleDemologin = async (email: string) => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        const payload = await res.json();
        setCurrentUser(payload.user);
        setActiveTenant(payload.user.tenantId);
        showToast(`Logged in successfully as ${payload.user.fullName}`, 'success');
        setActiveTicket(null);
        setMessages([]);
      } else {
        const data = await res.json();
        setAuthError(data.error || 'Failed simulator auth');
      }
    } catch {
      setAuthError('Express self-hosted offline. Try running build first.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCustomLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      handleDemologin(emailInput.trim());
    }
  };

  // Submit dynamic ticket creation
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) {
      showToast("Subject and description constraints are strictly required", "error");
      return;
    }

    setIsCreating(true);
    try {
      const activeCompany = companies.find(c => c.tenantId === activeTenant) || { id: 'company-roadrunner-id' };
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          subject: newSubject,
          description: newDescription,
          priority: newPriority,
          companyId: activeCompany.id,
          tenantId: activeTenant,
          customFields: {
            deviceType: newDevice,
            serialNumber: newSerial || "ACME-W71-GEN",
            operatingSystem: newOS
          }
        })
      });

      if (res.ok) {
        const record = await res.json();
        showToast(`Created ticket reference: ${record.reference}`, "success");
        setShowCreateModal(false);
        setNewSubject('');
        setNewDescription('');
        setAiTriageResult(null);
        loadTickets();
        loadDashboardMetrics();
      } else {
        showToast("Error committing ticket record", "error");
      }
    } catch (err) {
      showToast("Failed to dispatch ticket creation API", "error");
    } finally {
      setIsCreating(false);
    }
  };

  // Trigger Gemini AI Copilot for automated triage suggestions
  const triggerAiTriage = async () => {
    if (!newSubject.trim() || !newDescription.trim()) {
      showToast("Provide both subject and description to invoke Gemini API prediction", "info");
      return;
    }
    setIsTriageLoading(true);
    setAiTriageResult(null);
    try {
      const res = await fetch('/api/copilot/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newSubject,
          description: newDescription,
          priority: newPriority
        })
      });
      if (res.ok) {
        const analysis = await res.json();
        setAiTriageResult(analysis);
        // Pre-fill fields beautifully with smart AI recommendation
        if (analysis.suggestedPriority) setNewPriority(analysis.suggestedPriority);
        if (analysis.suggestedTier) {
          // Pre-assigned for ticket metadata preview
          showToast(`Gemini assigned tier category: ${analysis.suggestedCategory}`, 'success');
        }
      } else {
        showToast("AI Co-pilot was offline. Calling local prediction heurism...", "info");
      }
    } catch {
      showToast("Using local offline heuristic engine", "info");
    } finally {
      setIsTriageLoading(false);
    }
  };

  // Submit reply message to the thread
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;

    setIsReplying(true);
    try {
      const res = await fetch(`/api/tickets/${activeTicket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          content: replyText,
          isInternal: replyInternal,
          source: 'portal',
          attachments: []
        })
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages([...messages, newMsg]);
        setReplyText('');
        setReplyInternal(false);
        showToast("Message thread synced successfully", "success");
        // Reload details (which updates priority / SLA met state dynamically)
        await selectTicket(activeTicket);
        loadTickets();
        loadDashboardMetrics();
      } else {
        showToast("Failed to reply", "error");
      }
    } catch {
      showToast("API reply error", "error");
    } finally {
      setIsReplying(false);
    }
  };

  // State machine transition
  const transitionStatus = async (targetStatus: TicketStatus) => {
    if (!activeTicket) return;
    try {
      const res = await fetch(`/api/tickets/${activeTicket.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role
        },
        body: JSON.stringify({ status: targetStatus })
      });

      if (res.ok) {
        showToast(`Transitioned successfully to ${targetStatus.toUpperCase()}`, 'success');
        // Refresh details
        await selectTicket(activeTicket);
        loadTickets();
        loadDashboardMetrics();
      } else {
        const errObj = await res.json();
        showToast(errObj.error || "Forbidden Transition Pairing State", "error");
      }
    } catch {
      showToast("Could not contact status transition endpoint", "error");
    }
  };

  // Escalation flow L1 -> L2 -> L3 sequentially
  const submitEscalation = async () => {
    if (!activeTicket) return;
    if (!escalateReason.trim() || escalateReason.length < 10) {
      showToast("Mandatory escalation reason must be at least 10 characters long.", "error");
      return;
    }

    setIsEscalating(true);
    try {
      const res = await fetch(`/api/tickets/${activeTicket.id}/escalate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          reason: escalateReason,
          targetTier: escalateTarget
        })
      });

      if (res.ok) {
        showToast(`Successfully escalated ticket to Specialized Tier`, "success");
        setShowEscalateModal(false);
        setEscalateReason('');
        // Refresh details
        await selectTicket(activeTicket);
        loadTickets();
        loadDashboardMetrics();
      } else {
        showToast("Failure escalating ticket tier", "error");
      }
    } catch {
      showToast("API escalation fault", "error");
    } finally {
      setIsEscalating(false);
    }
  };

  // Simulate Inbound Email via webhook emulator
  const triggerInboundEmailSimulation = async () => {
    if (!emailInboundFrom || !emailInboundSubject || !emailInboundBody) {
      showToast("Provide standard email parameters to simulate parser webhooks", "error");
      return;
    }
    setIsSimulatingEmail(true);
    try {
      const res = await fetch('/api/webhook/email/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: emailInboundFrom,
          subject: emailInboundSubject,
          body: emailInboundBody
        })
      });

      if (res.ok) {
        const out = await res.json();
        if (out.status === 'appended_to_thread') {
          showToast(`Appended reply to existing ticket thread: ${out.reference}`, 'success');
        } else {
          showToast(`Dynamic inbound email created modern ticket auto: ${out.reference}`, 'success');
        }
        setShowInboundModal(false);
        loadTickets();
        loadDashboardMetrics();
      } else {
        showToast("Simulation was refused by webhook guard", "error");
      }
    } catch {
      showToast("Email simulator API offline", "error");
    } finally {
      setIsSimulatingEmail(false);
    }
  };

  // SLA background cron simulation trigger
  const triggerSlaCronCheck = async () => {
    try {
      const res = await fetch('/api/sla/trigger-check', { method: 'POST' });
      if (res.ok) {
        const payload = await res.json();
        if (payload.breachedRowsTriggered > 0) {
          showToast(`SLA cron job verified! Triggered ${payload.breachedRowsTriggered} breaches based strictly on timelines!`, 'info');
        } else {
          showToast("SLA cron analyzed all active tickets: no direct updates needed.", "info");
        }
        loadTickets();
        loadDashboardMetrics();
      }
    } catch {
      showToast("Could not run SLA scan", "error");
    }
  };

  // Self-Hosted Server Back Up DB Download
  const handleExportBackup = async () => {
    try {
      const res = await fetch('/api/backup');
      if (res.ok) {
        const data = await res.json();
        const str = JSON.stringify(data, null, 2);
        setBackupJsonText(str);
        
        // Dynamic file download simulation for ease-of-use
        const element = document.createElement("a");
        const file = new Blob([str], {type: 'application/json'});
        element.href = URL.createObjectURL(file);
        element.download = `supportnexus-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        showToast("Raw JSON database backup extracted successfully!", "success");
      }
    } catch {
      showToast("Could not sync backup export", "error");
    }
  };

  // Self-Hosted Server Database Restoration
  const handleImportRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupJsonText.trim()) {
      showToast("Please paste the JSON backup payload first", "error");
      return;
    }
    try {
      const parsed = JSON.parse(backupJsonText);
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupData: parsed })
      });

      if (res.ok) {
        const out = await res.json();
        showToast(`Restored database state: ${out.tenantsCount} tenants, ${out.ticketsCount} tickets masterfully loaded!`, 'success');
        setBackupJsonText('');
        loadTickets();
        loadDashboardMetrics();
      } else {
        const errObj = await res.json();
        showToast(errObj.error || "Restoration check failed: Invalid format", 'error');
      }
    } catch (e) {
      showToast("Invalid JSON script syntax. Please check schema.", 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        if (event.target?.result) {
          setBackupJsonText(event.target.result.toString());
          showToast("Backup file parsed successfully into paste window!", "info");
        }
      };
    }
  };

  // Dynamic colors mapper
  const getBrandingThemeColor = () => {
    const tenant = tenants.find(t => t.id === activeTenant);
    if (tenant?.branding?.primaryColor === 'emerald') return 'emerald';
    return 'indigo';
  };

  const brandColor = getBrandingThemeColor();

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden animate-fade-in">
        {/* Background ambient glow effect */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none"></div>

        {/* Toast Notification */}
        {toast && (
          <div id="status-toast" className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border transition-all transform scale-100 duration-300 ${
            toast.type === 'success' ? 'bg-emerald-950 border-emerald-500 text-emerald-200' :
            toast.type === 'error' ? 'bg-rose-950 border-rose-500 text-rose-200' :
            'bg-slate-900 border-indigo-500 text-indigo-200'
          }`}>
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
            {toast.type === 'info' && <Sparkles className="w-5 h-5 text-indigo-400" />}
            <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
          </div>
        )}

        <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 transition-all">
          
          {/* Left panel: Info & brand */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-950 to-slate-900 p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 text-left">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-600/30">
                  <Shield className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight text-white m-0">SupportNexus</h1>
                  <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded">v2.0 Developer</span>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h2 className="text-xl font-bold tracking-tight text-slate-100 leading-snug">Sovereign Multi-Tenant Workspace &amp; SLA Triage</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  SupportNexus represents a high-integrity client support and engineering incident triage simulator. Powered by active Row-Level Security (RLS) rules, tiered specialists assignments, and intelligent timelines monitoring.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-800/60 font-mono text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>Self-Hosted Cluster Database</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>JSON Schema Backups &amp; Restore</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Tick-based SLA Countdown Clocks</span>
              </div>
            </div>
          </div>

          {/* Right panel: Login options */}
          <div className="lg:col-span-7 p-8 flex flex-col justify-between text-left">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-indigo-400" />
                <h2 className="text-base font-bold text-slate-100">Select simulated profile session to load credentials</h2>
              </div>
              <p className="text-xs text-slate-400 mb-6 font-sans">
                Row-Level Security isolates tickets transparently. Log in as a customer to file disputes, or as an agent or admin to access escalated details, internal logs, and diagnostics.
              </p>

              {/* Seed login choices grouped by category */}
              <div className="space-y-3.5 mb-6">
                
                {/* Platform Authority */}
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block mb-1.5">
                    Platform Authority Console
                  </span>
                  <button
                    onClick={() => handleDemologin('admin@supportnexus.app')}
                    disabled={isLoggingIn}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-indigo-500 p-3 rounded-xl transition-all flex items-center justify-between hover:bg-slate-950/80 cursor-pointer text-left"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-200">Alex Rivera</span>
                      <span className="text-[10px] text-slate-500 font-mono block">admin@supportnexus.app</span>
                    </div>
                    <span className="text-[9px] uppercase font-mono px-2 py-0.5 bg-red-500/10 text-rose-400 border border-red-500/20 rounded font-bold">
                      Platform Admin
                    </span>
                  </button>
                </div>

                {/* Support Incident Agents */}
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block mb-1.5 font-sans">
                    Support Incident Specialists (Triage Tiers L1-L3)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleDemologin('l1@supportnexus.app')}
                      disabled={isLoggingIn}
                      className="bg-slate-950 border border-slate-800 hover:border-indigo-500 p-2.5 rounded-xl transition-all text-left flex flex-col justify-between hover:bg-slate-950/80 cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-200 truncate">Sarah Connor</span>
                      <span className="text-[9px] text-amber-400 font-mono block mt-1 uppercase font-semibold">L1 Triage</span>
                    </button>
                    <button
                      onClick={() => handleDemologin('l2@supportnexus.app')}
                      disabled={isLoggingIn}
                      className="bg-slate-950 border border-slate-800 hover:border-indigo-500 p-2.5 rounded-xl transition-all text-left flex flex-col justify-between hover:bg-slate-950/80 cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-200 truncate font-semibold">Marcus Wright</span>
                      <span className="text-[9px] text-purple-400 font-mono block mt-1 uppercase font-semibold font-sans">L2 Agent</span>
                    </button>
                    <button
                      onClick={() => handleDemologin('l3@supportnexus.app')}
                      disabled={isLoggingIn}
                      className="bg-slate-950 border border-slate-800 hover:border-indigo-500 p-2.5 rounded-xl transition-all text-left flex flex-col justify-between hover:bg-slate-950/80 cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-200 truncate font-semibold">John Connor</span>
                      <span className="text-[9px] text-rose-400 font-mono block mt-1 uppercase font-semibold">L3 Overrider</span>
                    </button>
                  </div>
                </div>

                {/* Client Company representatives */}
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block mb-1.5">
                    Client Representatives (Customer Portal Isolated)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleDemologin('customer@acme.com')}
                      disabled={isLoggingIn}
                      className="bg-slate-950 border border-slate-800 hover:border-indigo-500 p-3 rounded-xl transition-all text-left flex justify-between items-center hover:bg-slate-950/80 cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-xs text-slate-300">Wile E. Coyote</span>
                        <span className="text-[9px] text-slate-500 font-mono block">customer@acme.com</span>
                      </div>
                      <span className="text-[8px] uppercase font-mono px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 rounded">
                        Acme Corp
                      </span>
                    </button>
                    <button
                      onClick={() => handleDemologin('customer@globex.com')}
                      disabled={isLoggingIn}
                      className="bg-slate-950 border border-slate-800 hover:border-indigo-500 p-3 rounded-xl transition-all text-left flex justify-between items-center hover:bg-slate-950/80 cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-xs text-slate-300 font-sans">Hank Scorpio</span>
                        <span className="text-[9px] text-slate-500 font-mono block">customer@globex.com</span>
                      </div>
                      <span className="text-[8px] uppercase font-mono px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 rounded">
                        Globex Org
                      </span>
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Custom Authenticated Credential login form */}
            <form onSubmit={handleCustomLoginSubmit} className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col gap-2">
              <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold">
                Or Simulate Custom Authorized Email Credentials
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="e.g. support-specialist@isp.net"
                  required
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={isLoggingIn || !emailInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                >
                  {isLoggingIn ? "Authenticating..." : "Authorize"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {authError && (
                <p className="text-[10px] text-rose-400 font-mono mt-1">
                  🚨 {authError}
                </p>
              )}
            </form>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div id="status-toast" className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border transition-all transform scale-100 duration-300 ${
          toast.type === 'success' ? 'bg-emerald-950 border-emerald-500 text-emerald-200' :
          toast.type === 'error' ? 'bg-rose-950 border-rose-500 text-rose-200' :
          'bg-slate-900 border-indigo-500 text-indigo-200'
        }`}>
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
          {toast.type === 'info' && <Sparkles className="w-5 h-5 text-indigo-400" />}
          <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
        </div>
      )}

      {/* Multi-Tenant Subdomain Simulator Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-slate-300 font-mono tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Self-Hosted Cluster</span>
          </div>
          <span className="text-slate-500 text-lg">/</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Tenant Simulation Node:</span>
            <div className="flex gap-1.5">
              {tenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTenant(t.id);
                    setActiveTicket(null);
                    setMessages([]);
                    showToast(`Switched Client Subdomain View to "${t.name}"`, 'info');
                  }}
                  id={`tenant-tab-${t.subdomain}`}
                  className={`px-2.5 py-1 rounded-md font-mono transition-all border ${
                    activeTenant === t.id 
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 font-bold' 
                      : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800'
                  }`}
                >
                  {t.subdomain}.supportnexus.app
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <button 
            onClick={() => setShowInboundModal(true)}
            id="btn-simulate-email"
            className="bg-indigo-600 hover:bg-indigo-700 text-slate-100 px-3 py-1 rounded-md transition-all flex items-center gap-1.5 font-sans"
          >
            <Mail className="w-3.5 h-3.5" />
            Simulate Email Intake
          </button>
          <button 
            onClick={triggerSlaCronCheck}
            id="btn-cron-check"
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-md transition-all flex items-center gap-1.5 font-sans"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tick SLA Guard Clocks
          </button>
        </div>
      </div>

      {/* Primary Application Header */}
      <header className="bg-slate-950 border-b border-slate-900 sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-600/30">
            <Shield className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              SupportNexus <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono px-2 py-0.5 rounded">v2.0 Developer Edition</span>
            </h1>
            <p className="text-xs text-slate-400">Multi-Tenant Help Desk, Tiered Escalation &amp; Smart SLA Triage</p>
          </div>
        </div>

        {/* Unified Application Tabs */}
        <nav className="flex items-center bg-slate-900/50 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'tickets' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Tickets Workbench
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            Analytics Command
          </button>
          <button
            onClick={() => setActiveTab('selfhosted')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'selfhosted' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            Self-Hosted Server &amp; Backup
          </button>
        </nav>

        {/* Current Active User Auth Section */}
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 gap-2.5 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black uppercase text-sm">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  {currentUser.fullName}
                  <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded font-black ${
                    currentUser.role === 'admin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    currentUser.role.includes('agent') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {currentUser.role.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{currentUser.email}</div>
              </div>
              <button 
                onClick={() => setCurrentUser(null)}
                className="text-xs text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-950 px-2 py-1 rounded cursor-pointer transition-all"
              >
                Reset Session
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col gap-6">

        {/* Quick Session Identity Indicator at top */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>
                  Simulating Role Permissions for <strong className="text-white">{currentUser.fullName}</strong>. Only relevant data for tenant <strong className="text-indigo-400">{tenants.find(t => t.id === activeTenant)?.name || "Active"}</strong> is returned.
                </span>
              </div>
              <button 
                onClick={() => setCurrentUser(null)}
                className="text-indigo-400 font-mono hover:underline hover:text-indigo-300 font-bold"
              >
                Change Persona & Role RLS
              </button>
            </div>

            {/* TAB 1: WORKBENCH (PRIMARY HELPDESK ENGINE) */}
            {activeTab === 'tickets' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left side: Search & Ticket Master List (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 shadow-xl">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-white text-sm">
                        <Filter className="w-4 h-4 text-indigo-400" />
                        <span>Filter Control</span>
                      </div>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        id="btn-new-ticket"
                        className="bg-indigo-600 hover:bg-indigo-700 text-xs text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        File Support Ticket
                      </button>
                    </div>

                    {/* Filters inputs */}
                    <div className="flex flex-col gap-2.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search reference, title or message..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 mb-1">Status</label>
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300"
                          >
                            <option value="all">All Statuses</option>
                            <option value="new">NEW (Unassigned)</option>
                            <option value="in_progress">IN PROGRESS</option>
                            <option value="awaiting_client">AWAITING FEEDBACK</option>
                            <option value="escalated">ESCALATED</option>
                            <option value="resolved">RESOLVED</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 mb-1">Priority</label>
                          <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300"
                          >
                            <option value="all">All Priorities</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ticket List Panel */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                    <div className="border-b border-slate-800 px-4 py-3 bg-slate-900/60 flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-400 font-bold">
                        Filtered Queue ({tickets.length} Tickets)
                      </span>
                      <button 
                        onClick={loadTickets}
                        className="text-slate-400 hover:text-white"
                        title="Force reload list"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="divide-y divide-slate-800/60 max-h-[580px] overflow-y-auto">
                      {tickets.length === 0 ? (
                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="w-8 h-8 text-slate-600" />
                          <p className="text-xs text-slate-400">No tickets found match filters or subdomains</p>
                          <p className="text-[11px] text-slate-600 font-mono">Row Level Security bounds active.</p>
                        </div>
                      ) : (
                        tickets.map((t) => {
                          const isActive = activeTicket?.id === t.id;
                          return (
                            <div
                              key={t.id}
                              onClick={() => selectTicket(t)}
                              id={`ticket-card-${t.reference}`}
                              className={`p-4 transition-all cursor-pointer text-left ${
                                isActive 
                                  ? 'bg-slate-800/80 border-l-4 border-indigo-500' 
                                  : 'hover:bg-slate-800/30'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-mono text-[11px] font-extrabold text-indigo-400">
                                  {t.reference}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {/* Priority indicator */}
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                    t.priority === 'urgent' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' :
                                    t.priority === 'high' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                                    t.priority === 'medium' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' :
                                    'bg-slate-700/15 text-slate-400 border border-slate-700/20'
                                  }`}>
                                    {t.priority}
                                  </span>

                                  {/* Status indicator */}
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded capitalize ${
                                    t.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    t.status === 'escalated' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                    t.status === 'awaiting_client' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                    t.status === 'in_progress' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}>
                                    {t.status.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>

                              <h3 className="text-xs sm:text-sm font-bold text-slate-100 line-clamp-1 mb-1">
                                {t.subject}
                              </h3>
                              <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">
                                {t.description}
                              </p>

                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1 pt-1.5 border-t border-slate-800/40">
                                <span>{t.companyName}</span>
                                <span>Tier {t.tier.toUpperCase()}</span>
                              </div>

                              {/* Timelines SLA alarms */}
                              <div className="mt-2 flex items-center justify-between text-[10px]">
                                <span className="text-slate-500">First Action:</span>
                                {t.isResponseBreached ? (
                                  <span className="text-rose-400 flex items-center gap-0.5">
                                    <AlertTriangle className="w-3 h-3" /> Breach
                                  </span>
                                ) : t.isResponseMet ? (
                                  <span className="text-emerald-400">Response Met</span>
                                ) : (
                                  <span className="text-amber-400">Response Pending</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Detailed Workspace View & Replies (7 cols) */}
                <div className="lg:col-span-7">
                  {activeTicket ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                      
                      {/* Ticket Detail Header Card */}
                      <div className="border-b border-slate-800 p-5 bg-slate-900/40 flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-black text-indigo-400">
                              {activeTicket.reference}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span className="text-xs text-slate-400 font-mono">{activeTicket.companyName}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">Tier Tier:</span>
                            <span className="bg-slate-950 font-bold text-xs text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-800">
                              {activeTicket.tier.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h2 className="text-base sm:text-lg font-extrabold text-white">
                            {activeTicket.subject}
                          </h2>
                          <p className="text-xs text-slate-400 mt-1">
                            Opened on: {new Date(activeTicket.createdAt).toLocaleString()}
                          </p>
                        </div>

                        {/* Interactive Escalation & State Machine Buttons for Internal Staff */}
                        {currentUser.userType === 'internal' && (
                          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex flex-wrap gap-3 items-center justify-between">
                            <div className="flex flex-col gap-1 text-left">
                              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
                                Operator Action Bay:
                              </span>
                              <p className="text-[11px] text-slate-400">Run ticket status change or escalate specialized tier.</p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Escalation Button */}
                              <button
                                onClick={() => {
                                  setEscalateTarget(activeTicket.tier === 'l1' ? 'l2' : 'l3');
                                  setShowEscalateModal(true);
                                }}
                                disabled={activeTicket.tier === 'l3'}
                                id="btn-escalate-trigger"
                                className="bg-gradient-to-r from-purple-800 to-indigo-800 hover:from-purple-700 hover:to-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                Escalation Hub
                              </button>

                              {/* Status Action Transitions */}
                              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
                                <button
                                  onClick={() => transitionStatus('in_progress')}
                                  title="Transition state: In Progress"
                                  className={`px-2 py-1 text-[10px] rounded font-bold uppercase transition-all ${
                                    activeTicket.status === 'in_progress' 
                                      ? 'bg-indigo-600 text-white' 
                                      : 'text-slate-400 hover:bg-slate-800'
                                  }`}
                                >
                                  Work
                                </button>
                                <button
                                  onClick={() => transitionStatus('awaiting_client')}
                                  title="Transition state: Awaiting Feedback"
                                  className={`px-2 py-1 text-[10px] rounded font-bold uppercase transition-all ${
                                    activeTicket.status === 'awaiting_client' 
                                      ? 'bg-cyan-600 text-white' 
                                      : 'text-slate-400 hover:bg-slate-800'
                                  }`}
                                >
                                  Await Client
                                </button>
                                <button
                                  onClick={() => transitionStatus('resolved')}
                                  title="Transition state: Resolved"
                                  className={`px-2 py-1 text-[10px] rounded font-bold uppercase transition-all ${
                                    activeTicket.status === 'resolved' 
                                      ? 'bg-emerald-600 text-white' 
                                      : 'text-slate-400 hover:bg-slate-800'
                                  }`}
                                >
                                  Resolve
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* SLA Progress Metrics Widget */}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                            <div className="text-left">
                              <span className="text-[10px] text-slate-500 font-mono block">FIRST RESPONSE SLIGHT</span>
                              <span className="text-xs text-slate-300 font-mono">
                                {new Date(activeTicket.slaResponseBy).toLocaleTimeString()}
                              </span>
                            </div>
                            <div>
                              {activeTicket.isResponseBreached ? (
                                <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] px-2 py-0.5 rounded font-black flex items-center gap-0.5">
                                  <AlertTriangle className="w-3.5 h-3.5" /> BREACHED
                                </span>
                              ) : activeTicket.isResponseMet ? (
                                <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-bold">
                                  ✓ MET
                                </span>
                              ) : (
                                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] px-2 py-0.5 rounded font-bold animate-pulse">
                                  ● PENDING
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                            <div className="text-left">
                              <span className="text-[10px] text-slate-500 font-mono block">RESOLUTION DEADLINE</span>
                              <span className="text-xs text-slate-300 font-mono">
                                {new Date(activeTicket.slaResolveBy).toLocaleTimeString()}
                              </span>
                            </div>
                            <div>
                              {activeTicket.isResolveBreached ? (
                                <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] px-2 py-0.5 rounded font-black flex items-center gap-0.5">
                                  <AlertTriangle className="w-3.5 h-3.5" /> BREACHED
                                </span>
                              ) : activeTicket.isResolveMet ? (
                                <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-bold">
                                  ✓ RESOLVED
                                </span>
                              ) : (
                                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] px-2 py-0.5 rounded font-bold animate-pulse">
                                  ● WORKING
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Custom Fields dynamic panel */}
                        {activeTicket.customFields && Object.keys(activeTicket.customFields).length > 0 && (
                          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 text-xs flex flex-wrap gap-4 text-left">
                            {Object.entries(activeTicket.customFields).map(([k, v]) => (
                              <div key={k} className="flex-1 min-w-[120px]">
                                <span className="text-[10px] font-mono text-slate-500 uppercase block">{k}:</span>
                                <strong className="text-slate-300 font-mono">{v}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Unified Intercept Threading Scroll (Chronological replies messages) */}
                      <div className="flex-1 p-5 space-y-4 max-h-[400px] overflow-y-auto bg-slate-950/60">
                        {messages.map((m) => {
                          const isWriterClient = m.authorRole === 'client_user';
                          return (
                            <div 
                              key={m.id}
                              className={`flex flex-col max-w-[85%] rounded-2xl p-4 text-left ${
                                m.isInternal 
                                  ? 'bg-amber-950/40 border border-amber-500/30 text-amber-100 ml-auto' 
                                  : isWriterClient 
                                    ? 'bg-slate-850/90 border border-slate-800 mr-auto'
                                    : 'bg-indigo-950/10 border border-indigo-500/20 ml-auto'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 mb-1 text-[11px] font-semibold text-slate-400">
                                <span className="text-slate-200 font-extrabold">{m.authorName}</span>
                                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded ${
                                  m.authorRole === 'admin' ? 'bg-red-500/20 text-red-400' :
                                  m.authorRole.includes('agent') ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                  {m.authorRole.replace('_', ' ')}
                                </span>
                                {m.isInternal && (
                                  <span className="text-[10px] bg-amber-500/10 text-amber-400 font-extrabold font-mono px-1.5 rounded animate-pulse">
                                    INTERNAL NOTE DIRECTIVE
                                  </span>
                                )}
                                <span className="font-mono text-[10px] text-slate-500 ml-auto">
                                  {new Date(m.createdAt).toLocaleTimeString()}
                                </span>
                              </div>

                              <p className="text-xs sm:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
                                {m.content}
                              </p>

                              {/* Attached media display */}
                              {m.attachments && m.attachments.length > 0 && (
                                <div className="mt-3.5 pt-3 boundary-top border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {m.attachments.map(att => (
                                    <div key={att.id} className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                                      <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                                      <div className="overflow-hidden">
                                        <a 
                                          href={att.url} 
                                          target="_blank" 
                                          rel="noreferrer" 
                                          className="text-xs font-bold text-indigo-400 hover:underline block truncate"
                                        >
                                          {att.filename}
                                        </a>
                                        <span className="text-[10px] text-slate-500 block">{(att.sizeBytes / 1024).toFixed(0)} KB • Validated</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Reply Box Composer Form */}
                      <form onSubmit={handleSendReply} className="border-t border-slate-805 bg-slate-900 p-4">
                        <textarea
                          placeholder={replyInternal ? "Compose internal yellow note. Hidden from customers..." : "Type reply to send to client portal..."}
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none placeholder:text-slate-500"
                        />
                        <div className="flex items-center justify-between gap-3 mt-2">
                          
                          {/* Internal note toggle - only available for internal agents */}
                          {currentUser.userType === 'internal' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyInternal(!replyInternal);
                                showToast(`Toggled reply visible scope: ${!replyInternal ? 'INTERNAL DISCUSSIONS' : 'CLIENT PUBLIC REPLIES'}`, 'info');
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all border ${
                                replyInternal 
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/40' 
                                  : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-800/40'
                              }`}
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Internal Discussion Note
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono italic">
                              Client public thread. Replies update status immediately.
                            </span>
                          )}

                          <button
                            type="submit"
                            disabled={isReplying || !replyText.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <span>Send Response</span>
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </form>

                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 min-h-[450px]">
                      <div className="bg-indigo-950 text-indigo-400 p-4 rounded-full border border-indigo-500/20">
                        <MessageSquare className="w-8 h-8" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">No Ticket Selected</h2>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                          Choose any ongoing dispute or submit a new inquiry relative to the simulated tenant's schema database.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-xs text-white px-4 py-2 rounded-xl flex items-center gap-1.5 font-bold"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Create Ticket Now
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 2: ANALYTICS COMMAND CONTROL (REAL-TIME STATUS INTAKE) */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                
                {/* Visual Cards Grid */}
                {dashboardMetrics ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
                      
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-3.5 rounded-xl text-indigo-400">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-mono block">Total Registered Tickets</span>
                          <strong className="text-2xl text-white font-extrabold font-mono">
                            {dashboardMetrics.summary?.totalTickets || 0}
                          </strong>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-amber-400">
                          <Clock className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-mono block">Active Under Action</span>
                          <strong className="text-2xl text-white font-extrabold font-mono">
                            {dashboardMetrics.summary?.openCount || 0}
                          </strong>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-emerald-400">
                          <CheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-mono block">Successfully Resolved</span>
                          <strong className="text-2xl text-white font-extrabold font-mono">
                            {dashboardMetrics.summary?.resolvedCount || 0}
                          </strong>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
                        <div className="bg-purple-500/10 border border-purple-500/20 p-3.5 rounded-xl text-purple-400">
                          <Shield className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-mono block">SLA Compliance Pct</span>
                          <strong className="text-2xl text-white font-extrabold font-mono">
                            {dashboardMetrics.summary?.slaCompliancePct || 100}%
                          </strong>
                        </div>
                      </div>

                    </div>

                    {/* Breakdown graphics and listings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Ticket Volume status segmentation */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-left shadow-xl">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                          <Compass className="w-4 h-4 text-indigo-400" /> State Segmented Statistics
                        </h3>
                        
                        <div className="space-y-3.5">
                          <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Unassigned / New:</span>
                              <strong className="font-mono text-white">{dashboardMetrics.byStatus?.new || 0}</strong>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, ((dashboardMetrics.byStatus?.new || 0) / (dashboardMetrics.summary?.totalTickets || 1)) * 100)}%` }}></div>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Working In Progress:</span>
                              <strong className="font-mono text-white">{dashboardMetrics.byStatus?.in_progress || 0}</strong>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, ((dashboardMetrics.byStatus?.in_progress || 0) / (dashboardMetrics.summary?.totalTickets || 1)) * 100)}%` }}></div>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Awaiting Customer Action:</span>
                              <strong className="font-mono text-white">{dashboardMetrics.byStatus?.awaiting_client || 0}</strong>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                              <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${Math.min(100, ((dashboardMetrics.byStatus?.awaiting_client || 0) / (dashboardMetrics.summary?.totalTickets || 1)) * 100)}%` }}></div>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Escalated to Specialist:</span>
                              <strong className="font-mono text-white">{dashboardMetrics.byStatus?.escalated || 0}</strong>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                              <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min(100, ((dashboardMetrics.byStatus?.escalated || 0) / (dashboardMetrics.summary?.totalTickets || 1)) * 100)}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Breach Indicators */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-left shadow-xl flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                            <AlertTriangle className="w-4 h-4 text-rose-400" /> SLA Alarm Overages
                          </h3>
                          <p className="text-xs text-slate-400 mb-4">
                            SupportNexus enforces real-time timelines mapped to priority criteria. Warning indicators trigger at 80% duration elapsed before escalations apply.
                          </p>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/10 text-center">
                              <span className="text-[10px] text-slate-400 uppercase font-mono block">First Action Breached</span>
                              <strong className="text-2xl text-rose-400 font-extrabold font-mono">
                                {dashboardMetrics.slaBreaches?.responseBreaches || 0}
                              </strong>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/10 text-center">
                              <span className="text-[10px] text-slate-400 uppercase font-mono block">Resolution Target Overdue</span>
                              <strong className="text-2xl text-rose-400 font-extrabold font-mono">
                                {dashboardMetrics.slaBreaches?.resolveBreaches || 0}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-800">
                          <button 
                            onClick={triggerSlaCronCheck}
                            className="w-full bg-slate-800 hover:bg-slate-705 text-xs text-slate-200 py-2 rounded-lg font-bold flex items-center justify-center gap-2"
                          >
                            <RefreshCw className="w-4 h-4 animate-spin-slow" /> Scan SLA violations
                          </button>
                        </div>
                      </div>

                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center text-slate-400">Loading server analysis metrics...</div>
                )}

              </div>
            )}

            {/* TAB 3: SELF HOSTED PRIVATE DATA CONFIG (BACKUP/RESTORE MODULE) */}
            {activeTab === 'selfhosted' && (
              <div className="space-y-6 text-left">
                
                {/* Introduction banner */}
                <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/20">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Own and Manage Your Customer Assistance Infrastructure</h2>
                      <p className="text-xs text-slate-400">Deploy SupportNexus in isolated VPC clusters with total server ownership and local PostgreSQL parameters.</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed">
                    SupportNexus respects user private rights. We strongly advocate and support fully self-hosted deployments. All multi-tenant isolation constraints, custom JSON structures, and ticket logs are easily manageable under local system configurations. Implement single-instance Docker files to safely scale your database.
                  </p>
                </div>

                {/* Backup & Restoration Hub */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  
                  {/* Backup side */}
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
                    <div className="flex items-center gap-2.5">
                      <Download className="w-5 h-5 text-indigo-400" />
                      <h3 className="text-base font-bold text-white">Durable Backup Recovery</h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Download a single, comprehensive offline state file representing all organizations, client profiles, thread metrics, and custom categories. Excellent for offline migration.
                    </p>

                    <button
                      onClick={handleExportBackup}
                      id="btn-export-backup"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 self-start transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Download Raw JSON Database Backup
                    </button>
                    
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 mt-2">
                      <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">Backup Metadata Schema:</span>
                      <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
                        <li>UUID generated serial identities ensures non-colliding syncs.</li>
                        <li>SLA matrices mapping custom thresholds to different client classes.</li>
                        <li>Immutable system-transition status timeline tracks audits.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Restoration side */}
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
                    <div className="flex items-center gap-2.5">
                      <Upload className="w-5 h-5 text-indigo-400" />
                      <h3 className="text-base font-bold text-white">Sync Restoration Upload</h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Upload a legal `.json` backup dump to restore complete states dynamically. The backend will validate JSON schema alignments and re-mount seed records safely.
                    </p>

                    <form onSubmit={handleImportRestoreSubmit} className="space-y-4">
                      <div>
                        {/* File selector input */}
                        <label className="block text-xs font-mono text-slate-400 mb-1">Select Backup File:</label>
                        <input 
                          type="file" 
                          accept=".json"
                          onChange={handleFileUpload}
                          className="w-full text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1">Raw JSON Script editor:</label>
                        <textarea
                          placeholder='Paste raw JSON data here, or browse files...'
                          rows={6}
                          value={backupJsonText}
                          onChange={(e) => setBackupJsonText(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>

                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
                      >
                        <Upload className="w-4 h-4" />
                        Execute Restoration & Override State
                      </button>
                    </form>
                  </div>

                </div>

                {/* Self hosting guide section */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider font-mono text-indigo-400">Local Self-Hosted Blueprint Configurations</h3>
                  <p className="text-xs text-slate-400">Below is a basic Docker Compose stack script that leverages PostgreSQL Row-Level Security parameters for secure tenant isolation. Simply mount this in your target Linux VM.</p>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 font-mono text-xs text-slate-300 overflow-x-auto space-y-2">
                    <p className="text-emerald-400"># Docker Compose Self-Host Stack</p>
                    <p className="text-slate-400">{`version: "3.8"
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: secret_sandbox_vault_key
      POSTGRES_DB: supportnexus
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  supportnexus-app:
    image: supportnexus/platform:latest
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - DATABASE_URL=postgresql://root:secret_sandbox_vault_key@postgres:5432/supportnexus
      - REDIS_URL=redis://redis:6379/0
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
    depends_on:
      - postgres
      - redis`}</p>
                  </div>
                </div>

              </div>
            )}

      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-900 text-slate-500 py-6 px-6 text-center text-xs mt-auto font-mono">
        <p>© 2026 SupportNexus Inc. All tenant directories are isolated server-side via Row-Level Security rules.</p>
        <p className="mt-1 text-[10px] text-slate-600">This client-portal application is fully compiled and running inside isolated Cloud Run sandboxes.</p>
      </footer>

      {/* MODAL 1: CREATE SUPPORT TICKET SCREEN */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-left">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Create New Dispute / Trouble Ticket</h2>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Subject Topic Target:*</label>
                <input
                  type="text"
                  required
                  placeholder="Summarize the malfunction..."
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Detailed Log Malfunction Description:*</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe the steps to reproduce the error..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Severity Priority Level:*</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                  >
                    <option value="low">Low (Standard Triage)</option>
                    <option value="medium">Medium (Internal Specialist)</option>
                    <option value="high">High (4 HR Resolution SLA)</option>
                    <option value="urgent">Urgent (Immediate Action Limit)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Operating System Target:</label>
                  <input
                    type="text"
                    value={newOS}
                    onChange={(e) => setNewOS(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Device Name / Metric:</label>
                  <input
                    type="text"
                    value={newDevice}
                    onChange={(e) => setNewDevice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Hardware serial reference key:</label>
                  <input
                    type="text"
                    placeholder="e.g. SN-K992-W"
                    value={newSerial}
                    onChange={(e) => setNewSerial(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Server-Side Smart Gemini Copilot recommendation drawer */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold">
                    <Bot className="w-4 h-4 animate-spin-slow" />
                    <span>Gemini AI Triage Assessment</span>
                  </div>
                  <button
                    type="button"
                    onClick={triggerAiTriage}
                    disabled={isTriageLoading}
                    className="bg-indigo-600/10 hover:bg-slate-800 border border-indigo-500/20 text-indigo-400 text-[10px] uppercase font-mono px-2.5 py-1 rounded transition-all disabled:opacity-40"
                  >
                    {isTriageLoading ? "Scanning text..." : "Invoke Predictive Triage"}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Analyze description via server-side Gemini 3.5-Flash parameters. Retrieves classification category, recommended urgency response tier, and pre-generated diagnostic greeting drafts.
                </p>

                {aiTriageResult && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-2 mt-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono uppercase">AI Category:</span>
                      <strong className="text-white font-mono">{aiTriageResult.suggestedCategory}</strong>
                    </div>

                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono uppercase">Confidence:</span>
                      <span className="font-mono text-emerald-400 font-bold">{aiTriageResult.confidenceScore}% Acc</span>
                    </div>

                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] text-rose-400 font-mono uppercase font-bold">Immediate Tier Re-assignment:</span>
                      <strong className="text-rose-400 font-mono uppercase">{aiTriageResult.suggestedTier.toUpperCase()}</strong>
                    </div>

                    {aiTriageResult.draftReplyPattern && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-mono block uppercase">Interactive draft reply:</span>
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[10px] text-indigo-300 max-h-[80px] overflow-y-auto">
                          {aiTriageResult.draftReplyPattern}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-850 hover:bg-slate-800 text-slate-400 text-xs px-4 py-2 rounded-lg font-bold"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5 py-2 rounded-lg font-bold flex items-center gap-1"
                >
                  <span>{isCreating ? "Saving record..." : "Submit Ticket Record"}</span>
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DETAIL ESCALATION REASON WRITER */}
      {showEscalateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-905 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-left bg-slate-900">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">Escalate Specialized Response Ticket</h2>
              </div>
              <button 
                onClick={() => setShowEscalateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-400">
                Escalating a ticket changes the tier Level to L2 or L3 sequentially and places it in the respective specialized queue. This action **requires a mandatory internal note** justifying the decision.
              </p>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Target Specialist Tier Level:</label>
                <select
                  value={escalateTarget}
                  onChange={(e) => setEscalateTarget(e.target.value as 'l2' | 'l3')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                >
                  <option value="l2">Marcus Wright (L2 Specialist Tier)</option>
                  <option value="l3">Dr. John Connor (L3 Expert Emergency Override)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Mandatory Escalation Reason (min 10 chars):*</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why standard L1 triage resources cannot satisfy this query..."
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                {escalateReason.trim().length > 0 && escalateReason.trim().length < 10 && (
                  <span className="text-[10px] text-rose-400 mt-1 block font-mono">
                    Needs {10 - escalateReason.trim().length} more characters...
                  </span>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEscalateModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs px-3 py-1.5 rounded-lg"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={submitEscalation}
                  disabled={isEscalating || escalateReason.trim().length < 10}
                  className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition-all disabled:opacity-40"
                >
                  {isEscalating ? "Processing Escalation..." : "Execute Escalation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: INBOUND EMAIL INTAKE WEBHOOK EMULATOR */}
      {showInboundModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-left bg-slate-900">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400 animate-bounce" />
                <h2 className="text-lg font-bold text-white">Inbound email-to-ticket Pipeline Webhook</h2>
              </div>
              <button 
                onClick={() => setShowInboundModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400">
                SupportNexus parses inbound customer emails dynamically (Postmark/Mailgun parse webhooks emulator). If an email is received, it checks standard thread references to append messages to old tickets, or autocreate new tickets.
              </p>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Sender Email Envelope From:</label>
                <input
                  type="email"
                  value={emailInboundFrom}
                  onChange={(e) => setEmailInboundFrom(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Subject Header (Include target reference e.g., '[TKT-ACME-0001]' to match threads):</label>
                <input
                  type="text"
                  value={emailInboundSubject}
                  onChange={(e) => setEmailInboundSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Plaintext / HTML Body payload message:</label>
                <textarea
                  rows={4}
                  value={emailInboundBody}
                  onChange={(e) => setEmailInboundBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowInboundModal(false)}
                  className="bg-slate-800 hover:bg-slate-705 text-slate-400 text-xs px-3.5 py-2 rounded-lg"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={triggerInboundEmailSimulation}
                  disabled={isSimulatingEmail}
                  id="btn-confirm-email-simulation"
                  className="bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
                >
                  <span>{isSimulatingEmail ? "Processing..." : "Dispatch email Webhook"}</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
