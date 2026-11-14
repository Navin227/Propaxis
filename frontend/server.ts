import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  SEED_APPROVALS,
  SEED_DOCUMENTS,
  SEED_ENQUIRIES,
  SEED_INBOX_THREADS,
  SEED_MAINTENANCE,
  SEED_NOTIFICATIONS,
  SEED_PAYMENTS,
  SEED_PROPERTIES,
  SEED_TENANTS,
  SEED_UNITS,
  SEED_USERS,
} from './src/services/mock/seedData.ts';
import type {
  AnalyticsSnapshot,
  AppNotification,
  ApprovalRequest,
  EnquiryLead,
  InboxThread,
  LeaseDocument,
  MaintenanceTicket,
  PaymentRecord,
  Property,
  Tenant,
  Unit,
  UserAccount,
  UserRole,
} from './src/types/index.ts';

dotenv.config();
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const PAYMENT_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'propaxis_rzp_dev_hmac_secret';
type PendingOrder = { paymentId: string; amount: number; expectedSignatureToken: string };
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// In-memory stateful store mirroring FastAPI database persistence
const db = {
  users: structuredClone(SEED_USERS) as UserAccount[],
  properties: structuredClone(SEED_PROPERTIES) as Property[],
  units: structuredClone(SEED_UNITS) as Unit[],
  tenants: structuredClone(SEED_TENANTS) as Tenant[],
  enquiries: structuredClone(SEED_ENQUIRIES) as EnquiryLead[],
  inbox: structuredClone(SEED_INBOX_THREADS) as InboxThread[],
  maintenance: structuredClone(SEED_MAINTENANCE) as MaintenanceTicket[],
  payments: structuredClone(SEED_PAYMENTS) as PaymentRecord[],
  approvals: structuredClone(SEED_APPROVALS) as ApprovalRequest[],
  documents: structuredClone(SEED_DOCUMENTS) as LeaseDocument[],
  notifications: structuredClone(SEED_NOTIFICATIONS) as AppNotification[],
  pendingOrders: new Map<string, PendingOrder>(),
};

type PersistedState = Omit<typeof db, 'pendingOrders'> & { pendingOrders: [string, PendingOrder][] };

function getPersistedState(): PersistedState {
  const { pendingOrders, ...state } = db;
  return { ...state, pendingOrders: Array.from(pendingOrders.entries()) };
}

async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Run `neon env pull` or set it in .env.local.');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS propaxis_app_state (
      singleton_id smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
      state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    'INSERT INTO propaxis_app_state (singleton_id, state) VALUES (1, $1) ON CONFLICT (singleton_id) DO NOTHING',
    [JSON.stringify(getPersistedState())]
  );

  const result = await pool.query<{ state: PersistedState }>(
    'SELECT state FROM propaxis_app_state WHERE singleton_id = 1'
  );
  const savedState = result.rows[0]?.state;
  if (savedState) {
    Object.assign(db, savedState, { pendingOrders: new Map(savedState.pendingOrders || []) });
  }
}

let persistenceQueue: Promise<void> = Promise.resolve();

function persistDatabaseState(): Promise<void> {
  const state = JSON.stringify(getPersistedState());
  const write = persistenceQueue.then(() =>
    pool.query(
      'UPDATE propaxis_app_state SET state = $1, updated_at = now() WHERE singleton_id = 1',
      [state]
    ).then(() => undefined)
  );
  persistenceQueue = write.catch(() => undefined);
  return write;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in server environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getRequestContext(req: express.Request): { role: UserRole; userId: string } {
  const roleHeader = (req.header('x-user-role') || 'admin') as UserRole;
  const userIdHeader = req.header('x-user-id') || 'usr-admin-1';
  const role: UserRole = ['admin', 'manager', 'tenant'].includes(roleHeader) ? roleHeader : 'admin';
  return { role, userId: userIdHeader };
}

function getAllowedPropertyIds(role: UserRole, userId: string): string[] | null {
  if (role === 'admin') return null; // unrestricted
  const user = db.users.find((u) => u.id === userId);
  return user ? user.assignedPropertyIds : [];
}

function filterByProperty<T extends { propertyId: string }>(items: T[], role: UserRole, userId: string): T[] {
  const allowed = getAllowedPropertyIds(role, userId);
  if (allowed === null) return items;
  return items.filter((item) => allowed.includes(item.propertyId));
}

function recomputePropertyCounters(propertyId: string) {
  const prop = db.properties.find((p) => p.id === propertyId);
  if (!prop) return;
  const propUnits = db.units.filter((u) => u.propertyId === propertyId);
  if (propUnits.length > 0) {
    prop.totalUnits = Math.max(prop.totalUnits, propUnits.length);
    const occupied = propUnits.filter((u) => u.occupancyStatus === 'Occupied' || u.occupancyStatus === 'Under Notice').length;
    const vacant = propUnits.filter((u) => u.occupancyStatus === 'Vacant').length;
    // Keep baseline ratios realistic if seed property has extra abstract units
    const extraBaseline = Math.max(0, prop.totalUnits - propUnits.length);
    prop.occupiedUnits = occupied + Math.round(extraBaseline * 0.8);
    prop.vacantUnits = Math.max(0, prop.totalUnits - prop.occupiedUnits);
    if (vacant > prop.vacantUnits) prop.vacantUnits = vacant;
  }
}

async function startServer() {
  await initializeDatabase();
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const sendJson = res.json.bind(res);
    res.json = (body) => {
      void persistDatabaseState()
        .then(() => sendJson(body))
        .catch((error: unknown) => {
          console.error('Failed to persist API changes to Postgres:', error);
          if (!res.headersSent) {
            res.status(500);
            sendJson({ error: 'Failed to persist application data.' });
          }
        });
      return res;
    };
    return next();
  });

  // Healthcheck
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({
        status: 'ok',
        service: 'PropAxis Operations API',
        database: 'ok',
        aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error('Postgres health check failed:', error);
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  // Users (Admin only for full list; current user allowed for self)
  app.get('/api/users', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role !== 'admin') {
      return res.json(db.users.filter((u) => u.id === userId));
    }
    return res.json(db.users);
  });

  app.post('/api/users', (req, res) => {
    const { role } = getRequestContext(req);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only Company Admin can create or invite user accounts.' });
    }
    const { name, email, phone, userRole, designation, assignedPropertyIds } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }
    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      name,
      email,
      phone: phone || '+91 98000 00000',
      role: userRole || 'manager',
      status: 'Invited',
      assignedPropertyIds: Array.isArray(assignedPropertyIds) ? assignedPropertyIds : [],
      designation: designation || 'Property Manager',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    db.users.unshift(newUser);
    return res.status(201).json(newUser);
  });

  app.patch('/api/users/:id', (req, res) => {
    const { role } = getRequestContext(req);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only Company Admin can modify user accounts and property assignments.' });
    }
    const idx = db.users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found.' });
    db.users[idx] = { ...db.users[idx], ...req.body };
    return res.json(db.users[idx]);
  });

  // Properties
  app.get('/api/properties', (req, res) => {
    const { role, userId } = getRequestContext(req);
    const allowed = getAllowedPropertyIds(role, userId);
    const list = allowed === null ? db.properties : db.properties.filter((p) => allowed.includes(p.id));
    res.json(list);
  });

  app.post('/api/properties', (req, res) => {
    const { role } = getRequestContext(req);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only Company Admin can create new properties.' });
    }
    const body = req.body;
    const manager = db.users.find((u) => u.id === body.managerId);
    const prop: Property = {
      id: `prop-${Date.now()}`,
      name: body.name,
      address: body.address,
      city: body.city,
      type: body.type || 'Residential Tower',
      totalUnits: Number(body.totalUnits) || 1,
      occupiedUnits: 0,
      vacantUnits: Number(body.totalUnits) || 1,
      managerId: body.managerId || 'usr-mgr-1',
      managerName: manager?.name || 'Rohan Mehta',
      status: body.status || 'Active',
      imageUrl: body.imageUrl || '/src/assets/images/property_oakwood_residences_1794554891979.jpg',
      amenities: Array.isArray(body.amenities) ? body.amenities : ['24x7 Power Backup', 'CCTV Security'],
      monthlyTargetRent: Number(body.monthlyTargetRent) || 500000,
    };
    db.properties.unshift(prop);
    if (manager && !manager.assignedPropertyIds.includes(prop.id)) {
      manager.assignedPropertyIds.push(prop.id);
    }
    return res.status(201).json(prop);
  });

  app.patch('/api/properties/:id', (req, res) => {
    const { role, userId } = getRequestContext(req);
    const allowed = getAllowedPropertyIds(role, userId);
    if (allowed !== null && !allowed.includes(req.params.id)) {
      return res.status(403).json({ error: 'Property access denied.' });
    }
    const idx = db.properties.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Property not found.' });
    const updates = { ...req.body };
    if (updates.managerId) {
      const mgr = db.users.find((u) => u.id === updates.managerId);
      if (mgr) {
        updates.managerName = mgr.name;
        if (!mgr.assignedPropertyIds.includes(req.params.id)) {
          mgr.assignedPropertyIds.push(req.params.id);
        }
      }
    }
    db.properties[idx] = { ...db.properties[idx], ...updates };
    return res.json(db.properties[idx]);
  });

  // Units
  app.get('/api/units', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') {
      const user = db.users.find((u) => u.id === userId);
      const tenant = db.tenants.find((t) => t.id === user?.tenantId);
      return res.json(tenant ? db.units.filter((u) => u.id === tenant.unitId) : []);
    }
    return res.json(filterByProperty(db.units, role, userId));
  });

  app.post('/api/units', (req, res) => {
    const { role } = getRequestContext(req);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only Company Admin can create new units.' });
    }
    const prop = db.properties.find((p) => p.id === req.body.propertyId);
    if (!prop) return res.status(404).json({ error: 'Property not found.' });
    const unit: Unit = {
      id: `unit-${Date.now()}`,
      unitNumber: req.body.unitNumber,
      propertyId: prop.id,
      propertyName: prop.name,
      floor: Number(req.body.floor) || 1,
      bedrooms: Number(req.body.bedrooms) || 2,
      bathrooms: Number(req.body.bathrooms) || 2,
      areaSqFt: Number(req.body.areaSqFt) || 1200,
      monthlyRent: Number(req.body.monthlyRent) || 50000,
      securityDeposit: Number(req.body.securityDeposit) || 150000,
      occupancyStatus: req.body.occupancyStatus || 'Vacant',
      availability: req.body.availability || 'Available',
    };
    db.units.unshift(unit);
    recomputePropertyCounters(prop.id);
    return res.status(201).json(unit);
  });

  app.patch('/api/units/:id', (req, res) => {
    const { role, userId } = getRequestContext(req);
    const idx = db.units.findIndex((u) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Unit not found.' });
    const allowed = getAllowedPropertyIds(role, userId);
    if (role === 'tenant' || (allowed !== null && !allowed.includes(db.units[idx].propertyId))) {
      return res.status(403).json({ error: 'Not authorized to update this unit.' });
    }
    db.units[idx] = { ...db.units[idx], ...req.body };
    recomputePropertyCounters(db.units[idx].propertyId);
    return res.json(db.units[idx]);
  });

  // Tenants
  app.get('/api/tenants', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') {
      const user = db.users.find((u) => u.id === userId);
      return res.json(db.tenants.filter((t) => t.id === user?.tenantId));
    }
    return res.json(filterByProperty(db.tenants, role, userId));
  });

  app.post('/api/tenants/invite', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') {
      return res.status(403).json({ error: 'Tenants cannot invite other tenants.' });
    }
    const { name, email, phone, propertyId, unitId, leaseStartDate, leaseEndDate, monthlyRent, securityDeposit } = req.body;
    const allowed = getAllowedPropertyIds(role, userId);
    if (allowed !== null && !allowed.includes(propertyId)) {
      return res.status(403).json({ error: 'You cannot invite tenants to an unassigned property.' });
    }
    const prop = db.properties.find((p) => p.id === propertyId);
    const unit = db.units.find((u) => u.id === unitId);
    if (!prop || !unit) {
      return res.status(404).json({ error: 'Selected property or unit not found.' });
    }
    const newTenant: Tenant = {
      id: `ten-${Date.now()}`,
      name,
      email,
      phone,
      propertyId: prop.id,
      propertyName: prop.name,
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      leaseId: `LSE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      leaseStatus: 'Invited',
      leaseStartDate,
      leaseEndDate,
      monthlyRent: Number(monthlyRent) || unit.monthlyRent,
      securityDeposit: Number(securityDeposit) || unit.securityDeposit,
      paymentStatus: 'Pending',
      emergencyContact: 'Pending onboarding completion',
      kycVerified: false,
      moveInDate: leaseStartDate,
    };
    db.tenants.unshift(newTenant);
    unit.occupancyStatus = 'Occupied';
    unit.availability = 'Leased';
    unit.tenantId = newTenant.id;
    unit.tenantName = newTenant.name;
    recomputePropertyCounters(prop.id);

    db.notifications.unshift({
      id: `not-${Date.now()}`,
      recipientRole: 'admin',
      propertyId: prop.id,
      category: 'System',
      title: `Tenant Invitation Sent — ${name}`,
      message: `Portal invitation dispatched to ${email} for ${prop.name} · Unit ${unit.unitNumber}.`,
      createdAt: new Date().toISOString(),
      read: false,
      actionUrl: `/tenants/${newTenant.id}`,
    });

    return res.status(201).json(newTenant);
  });

  // Leasing & Enquiries
  app.get('/api/enquiries', (req, res) => {
    const { role, userId } = getRequestContext(req);
    const allowed = getAllowedPropertyIds(role, userId);
    if (allowed === null) return res.json(db.enquiries);
    return res.json(
      db.enquiries.filter(
        (e) =>
          (e.assignedPropertyId && allowed.includes(e.assignedPropertyId)) ||
          e.matchedPropertyIds.some((pid) => allowed.includes(pid))
      )
    );
  });

  app.post('/api/enquiries', (req, res) => {
    const body = req.body;
    const assignedProp = db.properties.find((p) => p.id === body.assignedPropertyId);
    const newLead: EnquiryLead = {
      id: `lead-${Date.now()}`,
      name: body.name,
      email: body.email,
      phone: body.phone,
      budgetMin: Number(body.budgetMin) || 40000,
      budgetMax: Number(body.budgetMax) || 70000,
      preferredLocation: body.preferredLocation || assignedProp?.city || 'Bengaluru',
      preferredConfig: body.preferredConfig || '2 BHK',
      source: body.source || 'Website',
      status: body.visitRequestedDate ? 'Visit Requested' : 'New Enquiry',
      matchedPropertyIds: assignedProp ? [assignedProp.id] : ['prop-1'],
      assignedPropertyId: assignedProp?.id || 'prop-1',
      assignedManagerId: assignedProp?.managerId || 'usr-mgr-1',
      visitRequestedDate: body.visitRequestedDate,
      aiSummary:
        body.notes ||
        `Enquiry captured via ${body.source || 'Website'}. Queued for Intent Parser & RAG Agent matching.`,
      followUps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (body.visitRequestedDate && assignedProp) {
      const apr: ApprovalRequest = {
        id: `apr-${Date.now()}`,
        type: 'Property Visit',
        title: `Site Visit Request — ${assignedProp.name}`,
        description: `${body.name} requested a property walkthrough on ${body.visitRequestedDate}.`,
        requesterName: body.name,
        requesterRole: 'Tenant / Prospect',
        relatedEntityName: body.name,
        relatedLeadId: newLead.id,
        propertyId: assignedProp.id,
        propertyName: assignedProp.name,
        requestedDateTime: body.visitRequestedDate,
        aiContext: `Submitted via ${body.source || 'Portal'}. Preferred config: ${newLead.preferredConfig}.`,
        aiRecommendation: 'Review manager calendar availability before confirming visit.',
        status: 'Pending',
      };
      newLead.visitApprovalId = apr.id;
      db.approvals.unshift(apr);
    }

    db.enquiries.unshift(newLead);
    return res.status(201).json(newLead);
  });

  app.patch('/api/enquiries/:id', (req, res) => {
    const idx = db.enquiries.findIndex((e) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Enquiry not found.' });
    db.enquiries[idx] = {
      ...db.enquiries[idx],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    return res.json(db.enquiries[idx]);
  });

  app.post('/api/enquiries/:id/request-visit', (req, res) => {
    const lead = db.enquiries.find((e) => e.id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Enquiry not found.' });
    const { propertyId, unitNumber, requestedDateTime } = req.body;
    const prop = db.properties.find((p) => p.id === (propertyId || lead.assignedPropertyId));
    if (!prop) return res.status(404).json({ error: 'Property not found.' });

    const apr: ApprovalRequest = {
      id: `apr-${Date.now()}`,
      type: 'Property Visit',
      title: `Site Visit Request — ${prop.name}${unitNumber ? ` Unit ${unitNumber}` : ''}`,
      description: `${lead.name} requested a visit on ${requestedDateTime}.`,
      requesterName: 'System Integration & Tool Action Agent',
      requesterRole: 'AI Leasing Workflow',
      relatedEntityName: lead.name,
      relatedLeadId: lead.id,
      propertyId: prop.id,
      propertyName: prop.name,
      unitNumber,
      requestedDateTime,
      aiContext: `Lead budget ₹${lead.budgetMin.toLocaleString('en-IN')}–₹${lead.budgetMax.toLocaleString('en-IN')}.`,
      aiRecommendation: 'Confirm slot if unit keys and site executive are available.',
      status: 'Pending',
    };
    db.approvals.unshift(apr);
    lead.status = 'Visit Requested';
    lead.visitRequestedDate = requestedDateTime;
    lead.visitApprovalId = apr.id;
    lead.updatedAt = new Date().toISOString();
    lead.followUps.unshift({
      id: `fu-${Date.now()}`,
      date: new Date().toISOString(),
      note: `Visit request submitted for ${requestedDateTime}. Awaiting manager approval (not yet confirmed).`,
      by: 'System Integration & Tool Action Agent',
    });

    return res.status(201).json({ lead, approval: apr });
  });

  // Unified Communication Inbox
  app.get('/api/inbox', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') {
      const user = db.users.find((u) => u.id === userId);
      return res.json(db.inbox.filter((t) => t.contactId === user?.tenantId));
    }
    return res.json(filterByProperty(db.inbox, role, userId));
  });

  app.post('/api/inbox/:threadId/messages', (req, res) => {
    const thread = db.inbox.find((t) => t.id === req.params.threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found.' });
    const { senderType, senderName, channel, content, requestHumanAssistance, humanReason } = req.body;
    const msg = {
      id: `msg-${Date.now()}`,
      threadId: thread.id,
      senderType: senderType || 'manager',
      senderName: senderName || 'Property Team',
      channel: channel || thread.primaryChannel,
      content,
      timestamp: new Date().toISOString(),
    };
    thread.messages.push(msg);
    if (!thread.activeChannels.includes(msg.channel)) {
      thread.activeChannels.push(msg.channel);
    }
    thread.lastMessageAt = msg.timestamp;
    thread.unreadCount = 0;

    if (requestHumanAssistance) {
      const reasonText =
        typeof humanReason === 'string' && humanReason.trim()
          ? humanReason
          : 'External user requested human team assistance.';
      thread.aiStatus = 'Human Assistance Requested';
      thread.humanRequestedAt = msg.timestamp;
      thread.humanRequestReason = reasonText;
      db.notifications.unshift({
        id: `not-${Date.now()}`,
        recipientRole: 'manager',
        propertyId: thread.propertyId,
        category: 'New Enquiry',
        title: `Human Assistance Requested — ${thread.contactName}`,
        message: reasonText,
        createdAt: msg.timestamp,
        read: false,
        actionUrl: '/inbox',
      });
    }
    return res.status(201).json(thread);
  });

  // Maintenance
  app.get('/api/maintenance', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') {
      const user = db.users.find((u) => u.id === userId);
      return res.json(db.maintenance.filter((m) => m.tenantId === user?.tenantId));
    }
    return res.json(filterByProperty(db.maintenance, role, userId));
  });

  app.post('/api/maintenance', (req, res) => {
    const { role, userId } = getRequestContext(req);
    const body = req.body;
    let tenant = db.tenants.find((t) => t.id === body.tenantId);
    if (role === 'tenant') {
      const user = db.users.find((u) => u.id === userId);
      tenant = db.tenants.find((t) => t.id === user?.tenantId);
    }
    if (!tenant) return res.status(404).json({ error: 'Tenant record not found.' });

    const ticket: MaintenanceTicket = {
      id: `mnt-${Date.now()}`,
      requestCode: `MNT-${Math.floor(4100 + Math.random() * 899)}`,
      tenantId: tenant.id,
      tenantName: tenant.name,
      propertyId: tenant.propertyId,
      propertyName: tenant.propertyName,
      unitId: tenant.unitId,
      unitNumber: tenant.unitNumber,
      category: body.category || 'Plumbing',
      description: body.description,
      priority: body.priority || 'Medium',
      aiSuggestedCategory: body.aiSuggestedCategory || body.category || 'Plumbing',
      aiSuggestedPriority: body.aiSuggestedPriority || body.priority || 'Medium',
      aiConfidenceNote:
        body.aiConfidenceNote || 'Triage queued via Intent Parser & RAG Agent based on issue description.',
      status: 'New',
      submittedAt: new Date().toISOString(),
      mediaAttachments: Array.isArray(body.mediaAttachments) ? body.mediaAttachments : [],
      internalNotes: [],
    };
    db.maintenance.unshift(ticket);
    db.notifications.unshift({
      id: `not-${Date.now()}`,
      recipientRole: 'manager',
      propertyId: tenant.propertyId,
      category: 'Maintenance Update',
      title: `New Maintenance Request ${ticket.requestCode}`,
      message: `${tenant.propertyName} Unit ${tenant.unitNumber}: ${ticket.category} (${ticket.priority})`,
      createdAt: new Date().toISOString(),
      read: false,
      actionUrl: '/maintenance',
    });
    return res.status(201).json(ticket);
  });

  app.patch('/api/maintenance/:id', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') {
      return res.status(403).json({ error: 'Only Admin or Property Manager can update ticket status or assign vendors.' });
    }
    const idx = db.maintenance.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Ticket not found.' });
    const allowed = getAllowedPropertyIds(role, userId);
    if (allowed !== null && !allowed.includes(db.maintenance[idx].propertyId)) {
      return res.status(403).json({ error: 'Not authorized for this property.' });
    }
    const { internalNote, noteAuthor, ...rest } = req.body;
    const updated = { ...db.maintenance[idx], ...rest };
    if (internalNote) {
      updated.internalNotes = [
        {
          id: `note-${Date.now()}`,
          author: noteAuthor || 'Property Manager',
          note: internalNote,
          createdAt: new Date().toISOString(),
        },
        ...updated.internalNotes,
      ];
    }
    db.maintenance[idx] = updated;
    return res.json(updated);
  });

  // Payments & Backend-Verified Razorpay Checkout Flow
  app.get('/api/payments', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') {
      const user = db.users.find((u) => u.id === userId);
      return res.json(db.payments.filter((p) => p.tenantId === user?.tenantId));
    }
    return res.json(filterByProperty(db.payments, role, userId));
  });

  app.post('/api/payments/create-order', (req, res) => {
    const { paymentId } = req.body;
    const payment = db.payments.find((p) => p.id === paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment invoice not found.' });
    if (payment.status === 'Paid' && payment.verifiedByBackend) {
      return res.status(400).json({ error: 'Invoice is already paid and verified.' });
    }
    const orderId = `order_PropAxis_${Date.now()}`;
    const expectedSignatureToken = crypto
      .createHmac('sha256', PAYMENT_SECRET)
      .update(`${orderId}|${payment.amount}`)
      .digest('hex');

    db.pendingOrders.set(orderId, {
      paymentId: payment.id,
      amount: payment.amount,
      expectedSignatureToken,
    });
    payment.gatewayOrderId = orderId;
    payment.status = 'Verification Pending';

    return res.json({
      orderId,
      amountPaise: payment.amount * 100,
      amountInr: payment.amount,
      currency: 'INR',
      invoiceNumber: payment.invoiceNumber,
      gatewayKeyHint: 'rzp_test_propaxis_gateway',
      gatewaySessionToken: expectedSignatureToken,
    });
  });

  app.post('/api/payments/verify', (req, res) => {
    const { orderId, gatewayPaymentId, method, gatewaySignature, simulateFailure } = req.body;
    const pending = db.pendingOrders.get(orderId);
    if (!pending) {
      return res.status(400).json({ error: 'Unknown or expired gateway order ID.' });
    }
    const payment = db.payments.find((p) => p.id === pending.paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Associated invoice not found.' });
    }

    if (simulateFailure) {
      payment.status = 'Pending';
      db.pendingOrders.delete(orderId);
      return res.status(402).json({
        verified: false,
        error: 'Payment authorization declined by bank gateway. Invoice remains unpaid.',
      });
    }

    const expectedHmac = crypto
      .createHmac('sha256', PAYMENT_SECRET)
      .update(`${orderId}|${pending.amount}`)
      .digest('hex');

    if (!gatewaySignature || gatewaySignature !== expectedHmac || !gatewayPaymentId) {
      payment.status = 'Pending';
      return res.status(400).json({
        verified: false,
        error: 'Gateway HMAC signature verification failed.',
      });
    }

    payment.status = 'Paid';
    payment.verifiedByBackend = true;
    payment.gatewayPaymentId = gatewayPaymentId;
    payment.method = method || 'Razorpay UPI';
    payment.paidDate = new Date().toISOString();
    db.pendingOrders.delete(orderId);

    const tenant = db.tenants.find((t) => t.id === payment.tenantId);
    if (tenant) {
      const hasUnpaid = db.payments.some((p) => p.tenantId === tenant.id && p.status !== 'Paid');
      tenant.paymentStatus = hasUnpaid ? 'Pending' : 'Paid';
    }

    db.notifications.unshift({
      id: `not-${Date.now()}`,
      recipientRole: 'all',
      recipientUserId: 'usr-tenant-1',
      propertyId: payment.propertyId,
      category: 'Payment Confirmation',
      title: `Payment Verified — ${payment.invoiceNumber}`,
      message: `₹${payment.amount.toLocaleString('en-IN')} verified via ${payment.method}. Receipt is ready.`,
      createdAt: new Date().toISOString(),
      read: false,
      actionUrl: '/tenant/payments',
    });

    return res.json({ verified: true, payment });
  });

  // Approvals
  app.get('/api/approvals', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') return res.json([]);
    return res.json(filterByProperty(db.approvals, role, userId));
  });

  app.post('/api/approvals/:id/decide', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') {
      return res.status(403).json({ error: 'Tenants cannot approve or reject operational requests.' });
    }
    const apr = db.approvals.find((a) => a.id === req.params.id);
    if (!apr) return res.status(404).json({ error: 'Approval request not found.' });
    const allowed = getAllowedPropertyIds(role, userId);
    if (allowed !== null && !allowed.includes(apr.propertyId)) {
      return res.status(403).json({ error: 'Not authorized for this property.' });
    }
    const { decision, decisionNote } = req.body as { decision: 'Approved' | 'Rejected'; decisionNote?: string };
    const decider = db.users.find((u) => u.id === userId);
    apr.status = decision;
    apr.decidedBy = decider?.name || 'Property Manager';
    apr.decidedAt = new Date().toISOString();
    apr.decisionNote = decisionNote || '';

    if (apr.relatedLeadId) {
      const lead = db.enquiries.find((l) => l.id === apr.relatedLeadId);
      if (lead) {
        lead.status = decision === 'Approved' ? 'Visit Approved' : 'Visit Rejected';
        lead.updatedAt = new Date().toISOString();
        lead.followUps.unshift({
          id: `fu-${Date.now()}`,
          date: new Date().toISOString(),
          note: `Visit ${decision.toLowerCase()} by ${apr.decidedBy}.${decisionNote ? ` Note: ${decisionNote}` : ''}`,
          by: apr.decidedBy,
        });
      }
    }

    db.notifications.unshift({
      id: `not-${Date.now()}`,
      recipientRole: 'all',
      propertyId: apr.propertyId,
      category: 'Visit Approval',
      title: `${apr.type} ${decision}`,
      message: `${apr.title} was ${decision.toLowerCase()} by ${apr.decidedBy}.`,
      createdAt: new Date().toISOString(),
      read: false,
      actionUrl: '/approvals',
    });

    return res.json({ confirmed: true, approval: apr });
  });

  // Documents
  app.get('/api/documents', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') {
      const user = db.users.find((u) => u.id === userId);
      return res.json(db.documents.filter((d) => d.tenantId === user?.tenantId));
    }
    return res.json(filterByProperty(db.documents, role, userId));
  });

  app.post('/api/documents', (req, res) => {
    const { role, userId } = getRequestContext(req);
    const body = req.body;
    const tenant = db.tenants.find((t) => t.id === body.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });
    const allowed = getAllowedPropertyIds(role, userId);
    if (role === 'tenant' && body.category === 'Lease Agreement') {
      return res.status(403).json({ error: 'Only Admin or Property Manager can upload lease agreements.' });
    }
    if (role === 'manager' && allowed !== null && !allowed.includes(tenant.propertyId)) {
      return res.status(403).json({ error: 'Not authorized for this property.' });
    }
    const uploader = db.users.find((u) => u.id === userId);
    const doc: LeaseDocument = {
      id: `doc-${Date.now()}`,
      title: body.title,
      category: body.category,
      tenantId: tenant.id,
      tenantName: tenant.name,
      propertyId: tenant.propertyId,
      propertyName: tenant.propertyName,
      unitNumber: tenant.unitNumber,
      leaseStartDate: body.leaseStartDate,
      leaseEndDate: body.leaseEndDate,
      leaseStatus: body.category === 'Lease Agreement' ? 'Active' : undefined,
      fileName: body.fileName,
      fileSize: body.fileSize || '1.4 MB',
      uploadedBy: uploader?.name || 'System User',
      uploadedAt: new Date().toISOString(),
    };
    db.documents.unshift(doc);
    return res.status(201).json(doc);
  });

  // Notifications
  app.get('/api/notifications', (req, res) => {
    const { role, userId } = getRequestContext(req);
    if (role === 'tenant') {
      return res.json(
        db.notifications.filter(
          (n) => (n.recipientRole === 'tenant' || n.recipientRole === 'all') && (!n.recipientUserId || n.recipientUserId === userId)
        )
      );
    }
    const allowed = getAllowedPropertyIds(role, userId);
    return res.json(
      db.notifications.filter(
        (n) =>
          (n.recipientRole === role || n.recipientRole === 'all') &&
          (allowed === null || !n.propertyId || allowed.includes(n.propertyId))
      )
    );
  });

  app.patch('/api/notifications/:id/read', (req, res) => {
    const not = db.notifications.find((n) => n.id === req.params.id);
    if (!not) return res.status(404).json({ error: 'Notification not found.' });
    not.read = true;
    return res.json(not);
  });

  app.post('/api/notifications/mark-all-read', (req, res) => {
    db.notifications.forEach((n) => {
      n.read = true;
    });
    res.json({ success: true });
  });

  // Analytics
  app.get('/api/analytics', (req, res) => {
    const { role, userId } = getRequestContext(req);
    const allowed = getAllowedPropertyIds(role, userId);
    const scopedProps = allowed === null ? db.properties : db.properties.filter((p) => allowed.includes(p.id));
    const scale = scopedProps.length / Math.max(1, db.properties.length);

    const snapshot: AnalyticsSnapshot = {
      monthlyRentSeries: [
        { month: 'Jun', collected: Math.round(2840000 * scale), pending: Math.round(140000 * scale), target: Math.round(2980000 * scale) },
        { month: 'Jul', collected: Math.round(2950000 * scale), pending: Math.round(115000 * scale), target: Math.round(3065000 * scale) },
        { month: 'Aug', collected: Math.round(3020000 * scale), pending: Math.round(95000 * scale), target: Math.round(3115000 * scale) },
        { month: 'Sep', collected: Math.round(3110000 * scale), pending: Math.round(128000 * scale), target: Math.round(3238000 * scale) },
        { month: 'Oct', collected: Math.round(3240000 * scale), pending: Math.round(88000 * scale), target: Math.round(3328000 * scale) },
        { month: 'Nov', collected: Math.round(2890000 * scale), pending: Math.round(190000 * scale), target: Math.round(3475000 * scale) },
      ],
      occupancyTrend: [
        { month: 'Jun', occupancyRate: 78, vacantUnits: Math.round(11 * scale) },
        { month: 'Jul', occupancyRate: 80, vacantUnits: Math.round(10 * scale) },
        { month: 'Aug', occupancyRate: 83, vacantUnits: Math.round(9 * scale) },
        { month: 'Sep', occupancyRate: 84, vacantUnits: Math.round(8 * scale) },
        { month: 'Oct', occupancyRate: 85, vacantUnits: Math.round(8 * scale) },
        {
          month: 'Nov',
          occupancyRate: Math.round(
            (scopedProps.reduce((s, p) => s + p.occupiedUnits, 0) /
              Math.max(1, scopedProps.reduce((s, p) => s + p.totalUnits, 0))) *
              100
          ),
          vacantUnits: scopedProps.reduce((s, p) => s + p.vacantUnits, 0),
        },
      ],
      enquiryConversion: [
        { stage: 'New Enquiry', count: Math.round(48 * scale) },
        { stage: 'AI Engaged', count: Math.round(41 * scale) },
        { stage: 'Visit Requested', count: Math.round(24 * scale) },
        { stage: 'Visit Completed', count: Math.round(16 * scale) },
        { stage: 'Converted', count: Math.round(11 * scale) },
      ],
      enquiryBySource: [
        { source: 'Website', enquiries: Math.round(18 * scale), converted: Math.round(5 * scale) },
        { source: 'Voice', enquiries: Math.round(13 * scale), converted: Math.round(3 * scale) },
        { source: 'SMS', enquiries: Math.round(10 * scale), converted: Math.round(2 * scale) },
        { source: 'Email', enquiries: Math.round(7 * scale), converted: Math.round(1 * scale) },
      ],
      maintenanceByCategory: [
        { category: 'Plumbing', open: 2, completed: 9, avgHours: 14 },
        { category: 'HVAC', open: 1, completed: 6, avgHours: 19 },
        { category: 'Electrical', open: 1, completed: 11, avgHours: 8 },
        { category: 'Carpentry', open: 0, completed: 5, avgHours: 22 },
      ],
      paymentAgeing: [
        { bucket: 'Current (0–5 days)', amount: Math.round(102000 * scale), accounts: 2 },
        { bucket: '6–15 days overdue', amount: Math.round(88000 * scale), accounts: 1 },
        { bucket: '16–30 days overdue', amount: 0, accounts: 0 },
        { bucket: '30+ days overdue', amount: 0, accounts: 0 },
      ],
      propertyComparison: scopedProps.map((p) => ({
        propertyId: p.id,
        propertyName: p.name,
        occupancyRate: Math.round((p.occupiedUnits / Math.max(1, p.totalUnits)) * 100),
        monthlyRevenue: p.monthlyTargetRent,
        openTickets: db.maintenance.filter((m) => m.propertyId === p.id && m.status !== 'Completed' && m.status !== 'Rejected').length,
        conversionRate: p.id === 'prop-1' ? 28 : p.id === 'prop-2' ? 24 : p.id === 'prop-3' ? 19 : 26,
      })),
      aiInsights: (
        [
          {
            id: 'ins-1',
            severity: 'High',
            category: 'Vacancy Optimization',
            title: 'Emerald Court shows 30% vacancy vs 15% portfolio average',
            observation:
              '3 of 10 units in Koregaon Park remain vacant (EC-304 and EC-201), representing ₹1,00,000/mo in uncollected potential rent.',
            recommendedAction:
              'Prioritize EC-201 electrical refresh and trigger AI outbound SMS follow-up to 4 warm Pune leads.',
            propertyId: 'prop-3',
          },
          {
            id: 'ins-2',
            severity: 'High',
            category: 'Rent Ageing & Renewal',
            title: 'Overdue rent + upcoming notice risk on Skyline Heights SH-1402',
            observation:
              'Unit SH-1402 (₹88,000/mo) is 7 days past due while lease expires on 14 Dec 2026.',
            recommendedAction:
              'Dispatch manager-reviewed payment reminder and schedule renewal discussion.',
            propertyId: 'prop-2',
          },
          {
            id: 'ins-3',
            severity: 'Opportunity',
            category: 'Leasing Channel Performance',
            title: 'Voice + SMS multi-channel enquiries convert 1.8x faster than Email-only',
            observation:
              'Prospects engaged by Real-Time Voice Synthesis + SMS RAG complete visit scheduling within 18 hours on average.',
            recommendedAction: 'Enable automated voice callback summary on website enquiry submissions.',
          },
          {
            id: 'ins-4',
            severity: 'Medium',
            category: 'Maintenance SLA',
            title: 'HVAC ticket turnaround averaging 19h across towers',
            observation: 'Compressor PCB diagnostics account for 60% of HVAC resolution lag.',
            recommendedAction: 'Approve pre-negotiated spare PCB retainer with CoolCraft HVAC Engineers.',
            propertyId: 'prop-2',
          },
        ] as AnalyticsSnapshot['aiInsights']
      ).filter((ins) => allowed === null || !ins.propertyId || allowed.includes(ins.propertyId)),
    };

    res.json(snapshot);
  });

  // Server-side AI Endpoints (@google/genai)
  app.post('/api/ai/assistant', async (req, res) => {
    const { role, userId } = getRequestContext(req);
    const { message, channel, threadId, history } = req.body as {
      message: string;
      channel?: 'Portal' | 'SMS' | 'Voice' | 'Email';
      threadId?: string;
      history?: { sender: string; text: string }[];
    };

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    try {
      const ai = getGeminiClient();
      const user = db.users.find((u) => u.id === userId);
      const tenant = role === 'tenant' ? db.tenants.find((t) => t.id === user?.tenantId) : undefined;
      const tenantPayments = tenant ? db.payments.filter((p) => p.tenantId === tenant.id) : [];
      const tenantTickets = tenant ? db.maintenance.filter((m) => m.tenantId === tenant.id) : [];
      const availableUnits = db.units.filter((u) => u.availability === 'Available');

      const contextPayload = {
        userRole: role,
        userName: user?.name || 'Guest',
        tenantRecord: tenant || null,
        tenantInvoices: tenantPayments,
        tenantMaintenanceTickets: tenantTickets,
        availablePortfolioUnits: availableUnits.map((u) => ({
          propertyName: u.propertyName,
          unitNumber: u.unitNumber,
          bedrooms: u.bedrooms,
          areaSqFt: u.areaSqFt,
          monthlyRentInr: u.monthlyRent,
          securityDepositInr: u.securityDeposit,
        })),
        channel: channel || 'Portal',
      };

      const systemInstruction = `You are PropAxis AI, operating inside an enterprise Property Operations Platform in India (currency INR ₹).
Your architecture routes through 4 core agents:
1. "Orchestrator Router" — decides intent & agent routing.
2. "Intent Parser & RAG" — answers questions grounded strictly in the provided JSON context (never invent unit numbers, rents, or payment confirmations).
3. "System Integration & Tool Action" — drafts actions like property visit requests or maintenance ticket creation. IMPORTANT: Property visits NEVER auto-confirm; they always require manager approval (requiresManagerApproval: true).
4. "Real-Time Voice Synthesis" — handles voice-channel cadence & concise spoken summaries when channel is Voice.

Respond in valid JSON matching the schema. Keep replies helpful, concise, accurate to the INR numbers in context, and never fabricate payment success.`;

      const prompt = `Context JSON:\n${JSON.stringify(contextPayload, null, 2)}\n\nRecent conversation:\n${JSON.stringify(
        (history || []).slice(-6)
      )}\n\nLatest user message (${channel || 'Portal'}): ${message}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              routedAgent: {
                type: Type.STRING,
                enum: [
                  'Orchestrator Router',
                  'Intent Parser & RAG',
                  'System Integration & Tool Action',
                  'Real-Time Voice Synthesis',
                ],
              },
              intent: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              ragSources: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              toolActionType: {
                type: Type.STRING,
                enum: ['CREATE_VISIT_APPROVAL', 'DRAFT_MAINTENANCE_TICKET', 'ESCALATE_HUMAN', 'NONE'],
              },
              toolActionSummary: { type: Type.STRING },
              requiresManagerApproval: { type: Type.BOOLEAN },
            },
            required: ['reply', 'routedAgent', 'intent', 'confidence', 'ragSources', 'toolActionType'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const payload = {
        reply: parsed.reply || 'I have reviewed your request against your property records.',
        orchestrator: {
          routedAgent: parsed.routedAgent || 'Intent Parser & RAG',
          intent: parsed.intent || 'general_inquiry',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.92,
          ragSources: Array.isArray(parsed.ragSources) ? parsed.ragSources : ['Portfolio Unit & Lease Index'],
          proposedToolAction:
            parsed.toolActionType && parsed.toolActionType !== 'NONE'
              ? {
                  type: parsed.toolActionType,
                  summary: parsed.toolActionSummary || 'Action queued for review.',
                  requiresManagerApproval: Boolean(parsed.requiresManagerApproval),
                  executed: false,
                }
              : undefined,
        },
        generatedAt: new Date().toISOString(),
      };

      // If called from a Unified Inbox thread, append AI response into the synchronized thread
      if (threadId) {
        const thread = db.inbox.find((t) => t.id === threadId);
        if (thread) {
          thread.messages.push({
            id: `msg-${Date.now()}`,
            threadId: thread.id,
            senderType: 'ai',
            senderName: 'PropAxis AI',
            channel: (channel === 'Voice' || channel === 'SMS' || channel === 'Email' ? channel : thread.primaryChannel),
            content: payload.reply,
            timestamp: payload.generatedAt,
            aiAgentTag: payload.orchestrator.routedAgent,
          });
          thread.lastMessageAt = payload.generatedAt;
        }
      }

      return res.json(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI service error';
      console.error('AI assistant backend error:', msg);
      return res.status(503).json({
        error: `AI Backend Unavailable: ${msg}`,
      });
    }
  });

  app.post('/api/ai/triage-maintenance', async (req, res) => {
    const { description } = req.body as { description: string };
    if (!description) return res.status(400).json({ error: 'Description is required.' });
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Classify this apartment maintenance request into category and priority: "${description}"`,
        config: {
          systemInstruction:
            'You are the PropAxis Intent Parser & RAG Agent for maintenance triage. Return structured JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                enum: ['Plumbing', 'Electrical', 'HVAC', 'Appliance', 'Carpentry', 'Common Area'],
              },
              priority: {
                type: Type.STRING,
                enum: ['Low', 'Medium', 'High', 'Urgent'],
              },
              confidenceNote: { type: Type.STRING },
            },
            required: ['category', 'priority', 'confidenceNote'],
          },
        },
      });
      return res.json(JSON.parse(response.text || '{}'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI triage error';
      return res.status(503).json({ error: `AI triage unavailable: ${msg}` });
    }
  });

  // Vite middleware in dev or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PropAxis server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((error: unknown) => {
  console.error('Failed to start PropAxis server:', error);
  process.exitCode = 1;
});
