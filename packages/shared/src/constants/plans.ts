export type PlanKey = 'free' | 'pro' | 'agency' | 'enterprise';

export interface PlanLimits {
  maxProjects: number;
  generationsPerDay: number; // -1 = unlimited
  maxWorkspaces: number; // -1 = unlimited
  maxMembersPerWorkspace: number;
  watermark: boolean;
  customDomain: boolean;
  realtimeCollaboration: boolean;
  analytics: boolean;
  unlimitedHistory: boolean;
  prioritySupport: boolean;
  sso: boolean;
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  priceMonthlyCents: number; // 0 = free, -1 = custom pricing
  limits: PlanLimits;
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Free',
    priceMonthlyCents: 0,
    limits: {
      maxProjects: 3,
      generationsPerDay: 5,
      maxWorkspaces: 1,
      maxMembersPerWorkspace: 1,
      watermark: true,
      customDomain: false,
      realtimeCollaboration: false,
      analytics: false,
      unlimitedHistory: false,
      prioritySupport: false,
      sso: false,
    },
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    priceMonthlyCents: 2900,
    limits: {
      maxProjects: 50,
      generationsPerDay: -1,
      maxWorkspaces: 1,
      maxMembersPerWorkspace: 1,
      watermark: false,
      customDomain: false,
      realtimeCollaboration: false,
      analytics: false,
      unlimitedHistory: false,
      prioritySupport: false,
      sso: false,
    },
  },
  agency: {
    key: 'agency',
    name: 'Agency',
    priceMonthlyCents: 9900,
    limits: {
      maxProjects: -1,
      generationsPerDay: -1,
      maxWorkspaces: -1,
      maxMembersPerWorkspace: 10,
      watermark: false,
      customDomain: true,
      realtimeCollaboration: true,
      analytics: true,
      unlimitedHistory: true,
      prioritySupport: true,
      sso: false,
    },
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    priceMonthlyCents: -1,
    limits: {
      maxProjects: -1,
      generationsPerDay: -1,
      maxWorkspaces: -1,
      maxMembersPerWorkspace: -1,
      watermark: false,
      customDomain: true,
      realtimeCollaboration: true,
      analytics: true,
      unlimitedHistory: true,
      prioritySupport: true,
      sso: true,
    },
  },
};

export const CREDIT_PACKS = [
  { id: 'credits-100', credits: 100, priceCents: 900 },
  { id: 'credits-500', credits: 500, priceCents: 3900 },
  { id: 'credits-1000', credits: 1000, priceCents: 6900 },
] as const;

export const MARKETPLACE_REVENUE_SPLIT = { seller: 0.7, platform: 0.3 } as const;
