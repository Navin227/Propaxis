export type UserRole = 'admin' | 'manager' | 'tenant';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'Active' | 'Inactive' | 'Invited';
  assignedPropertyIds: string[];
  tenantId?: string;
  avatarUrl?: string;
  designation: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  postalCode?: string;
  type: 'Residential Tower' | 'Boutique Apartments' | 'Serviced Residences' | 'Mixed-Use';
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  managerId: string;
  managerName: string;
  status: 'Active' | 'Maintenance' | 'Onboarding';
  imageUrl: string;
  amenities: string[];
  monthlyTargetRent: number;
}

export interface Unit {
  id: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  floor?: number | null;
  bedrooms: number;
  bathrooms: number;
  areaSqFt: number;
  monthlyRent: number;
  securityDeposit: number;
  occupancyStatus: 'Occupied' | 'Vacant' | 'Under Notice';
  availability: 'Available' | 'Leased' | 'Maintenance Hold';
  tenantId?: string;
  tenantName?: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  leaseId: string;
  leaseStatus: 'Active' | 'Expiring Soon' | 'Invited' | 'Ended';
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: number;
  securityDeposit: number;
  paymentStatus: 'Paid' | 'Pending' | 'Overdue';
  emergencyContact: string;
  kycVerified: boolean;
  moveInDate: string;
}

export type EnquirySource = 'Website' | 'Voice' | 'SMS' | 'Email';

export type LeadStatus =
  | 'New Enquiry'
  | 'AI Engaged'
  | 'Property Suggested'
  | 'Visit Requested'
  | 'Visit Approved'
  | 'Visit Rejected'
  | 'Visit Completed'
  | 'Booking in Progress'
  | 'Converted'
  | 'Lost';

export interface FollowUpEntry {
  id: string;
  date: string;
  note: string;
  by: string;
}

export interface EnquiryLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  budgetMin: number;
  budgetMax: number;
  preferredLocation: string;
  preferredConfig: string;
  source: EnquirySource;
  status: LeadStatus;
  matchedPropertyIds: string[];
  assignedPropertyId?: string;
  assignedManagerId: string;
  visitRequestedDate?: string;
  visitApprovalId?: string;
  aiSummary: string;
  followUps: FollowUpEntry[];
  createdAt: string;
  updatedAt: string;
}

export type ChannelType = 'Voice' | 'SMS' | 'Email';

export type AIAgentTag =
  | 'Orchestrator Router'
  | 'Intent Parser & RAG'
  | 'System Integration & Tool Action'
  | 'Real-Time Voice Synthesis';

export interface InboxMessage {
  id: string;
  threadId: string;
  senderType: 'user' | 'ai' | 'manager';
  senderName: string;
  channel: ChannelType;
  content: string;
  timestamp: string;
  aiAgentTag?: AIAgentTag;
  voiceDurationSec?: number;
  transcriptNote?: string;
}

export interface InboxThread {
  id: string;
  contactType: 'Tenant' | 'Lead';
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  propertyId: string;
  propertyName: string;
  unitNumber?: string;
  activeChannels: ChannelType[];
  primaryChannel: ChannelType;
  aiStatus: 'AI Active' | 'Human Assistance Requested';
  humanRequestedAt?: string;
  humanRequestReason?: string;
  aiSummary: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: InboxMessage[];
}

export type MaintenanceStatus =
  | 'New'
  | 'Under Review'
  | 'Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Rejected';

export type MaintenancePriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface MaintenanceMedia {
  id: string;
  name: string;
  type: 'image' | 'video';
  caption: string;
}

export interface MaintenanceNote {
  id: string;
  author: string;
  note: string;
  createdAt: string;
}

export interface MaintenanceTicket {
  id: string;
  requestCode: string;
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  category: 'Plumbing' | 'Electrical' | 'HVAC' | 'Appliance' | 'Carpentry' | 'Common Area';
  description: string;
  priority: MaintenancePriority;
  aiSuggestedCategory: string;
  aiSuggestedPriority: MaintenancePriority;
  aiConfidenceNote: string;
  status: MaintenanceStatus;
  submittedAt: string;
  assignedVendor?: string;
  vendorPhone?: string;
  mediaAttachments: MaintenanceMedia[];
  internalNotes: MaintenanceNote[];
}

export type PaymentStatus = 'Paid' | 'Pending' | 'Overdue' | 'Verification Pending';

export interface PaymentRecord {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  billingMonth: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  method?: 'Razorpay UPI' | 'Razorpay Card' | 'Razorpay NetBanking' | 'NEFT';
  status: PaymentStatus;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  verifiedByBackend: boolean;
}

export type ApprovalType = 'Property Visit' | 'Rent Concession' | 'Maintenance CapEx' | 'Lease Renewal';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  title: string;
  description: string;
  requesterName: string;
  requesterRole: string;
  relatedEntityName: string;
  relatedLeadId?: string;
  propertyId: string;
  propertyName: string;
  unitNumber?: string;
  requestedDateTime: string;
  aiContext: string;
  aiRecommendation: string;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export type DocumentCategory =
  | 'Lease Agreement'
  | 'KYC Identity'
  | 'Move-in Inspection'
  | 'Rent Receipt'
  | 'Society NOC';

export interface LeaseDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  leaseStatus?: 'Active' | 'Expiring Soon' | 'Archived';
  fileName: string;
  fileSize: string;
  uploadedBy: string;
  uploadedAt: string;
}

export type NotificationCategory =
  | 'Rent Due'
  | 'Payment Confirmation'
  | 'Maintenance Update'
  | 'Visit Approval'
  | 'Lease Expiry'
  | 'New Enquiry'
  | 'System';

export interface AppNotification {
  id: string;
  recipientRole: UserRole | 'all';
  recipientUserId?: string;
  propertyId?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  actionUrl?: string;
}

export interface AnalyticsSnapshot {
  monthlyRentSeries: { month: string; collected: number; pending: number; target: number }[];
  occupancyTrend: { month: string; occupancyRate: number; vacantUnits: number }[];
  enquiryConversion: { stage: string; count: number }[];
  enquiryBySource: { source: EnquirySource; enquiries: number; converted: number }[];
  maintenanceByCategory: { category: string; open: number; completed: number; avgHours: number }[];
  paymentAgeing: { bucket: string; amount: number; accounts: number }[];
  propertyComparison: {
    propertyId: string;
    propertyName: string;
    occupancyRate: number;
    monthlyRevenue: number;
    openTickets: number;
    conversionRate: number;
  }[];
  aiInsights: {
    id: string;
    severity: 'High' | 'Medium' | 'Opportunity';
    category: string;
    title: string;
    observation: string;
    recommendedAction: string;
    propertyId?: string;
  }[];
}

export interface AIOrchestratorResponse {
  reply: string;
  orchestrator: {
    routedAgent: AIAgentTag;
    intent: string;
    confidence: number;
    ragSources: string[];
    proposedToolAction?: {
      type: 'CREATE_VISIT_APPROVAL' | 'DRAFT_MAINTENANCE_TICKET' | 'ESCALATE_HUMAN' | 'NONE';
      summary: string;
      requiresManagerApproval: boolean;
      executed: boolean;
    };
  };
  generatedAt: string;
}
