import { policiesRepository, ReturnPolicyRecord, WarrantyPolicyRecord } from './policies.repository.js';

export interface CreateReturnPolicyInput {
  policyCode: string;
  policyName: string;
  isReturnable?: boolean;
  isReplaceable?: boolean;
  returnWindowDays?: number;
  replacementWindowDays?: number;
  requiresTechnicianCheck?: boolean;
  conditionsSummary?: string;
  termsAndConditions?: string;
  status?: string;
}

export interface UpdateReturnPolicyInput {
  policyName?: string;
  isReturnable?: boolean;
  isReplaceable?: boolean;
  returnWindowDays?: number;
  replacementWindowDays?: number;
  requiresTechnicianCheck?: boolean;
  conditionsSummary?: string;
  termsAndConditions?: string;
  status?: string;
}

export interface CreateWarrantyPolicyInput {
  policyCode: string;
  policyName: string;
  warrantyType: 'BRAND' | 'SELLER' | 'NONE';
  durationMonths?: number;
  serviceType?: 'CARRY_IN' | 'ON_SITE' | 'PICKUP_DROP' | 'NONE';
  coveredSummary?: string;
  notCoveredSummary?: string;
  termsAndConditions?: string;
  status?: string;
}

export interface UpdateWarrantyPolicyInput {
  policyName?: string;
  warrantyType?: 'BRAND' | 'SELLER' | 'NONE';
  durationMonths?: number;
  serviceType?: 'CARRY_IN' | 'ON_SITE' | 'PICKUP_DROP' | 'NONE';
  coveredSummary?: string;
  notCoveredSummary?: string;
  termsAndConditions?: string;
  status?: string;
}

function formatReturnPolicy(r: ReturnPolicyRecord) {
  return {
    policyId: r.PolicyID,
    policyCode: r.PolicyCode,
    policyName: r.PolicyName,
    isReturnable: r.IsReturnable,
    isReplaceable: r.IsReplaceable,
    returnWindowDays: r.ReturnWindowDays,
    replacementWindowDays: r.ReplacementWindowDays,
    requiresTechnicianCheck: r.RequiresTechnicianCheck,
    conditionsSummary: r.ConditionsSummary,
    termsAndConditions: r.TermsAndConditions,
    status: r.Status,
    categoriesCount: r.CategoriesCount ?? 0,
    productsCount: r.ProductsCount ?? 0,
    createdAt: r.CreatedAt,
    updatedAt: r.UpdatedAt,
  };
}

function formatWarrantyPolicy(w: WarrantyPolicyRecord) {
  return {
    warrantyPolicyId: w.WarrantyPolicyID,
    policyCode: w.PolicyCode,
    policyName: w.PolicyName,
    warrantyType: w.WarrantyType,
    durationMonths: w.DurationMonths,
    serviceType: w.ServiceType,
    coveredSummary: w.CoveredSummary,
    notCoveredSummary: w.NotCoveredSummary,
    termsAndConditions: w.TermsAndConditions,
    status: w.Status,
    categoriesCount: w.CategoriesCount ?? 0,
    productsCount: w.ProductsCount ?? 0,
    createdAt: w.CreatedAt,
    updatedAt: w.UpdatedAt,
  };
}

export const policiesService = {
  // ==========================================
  // RETURN & REPLACEMENT POLICIES
  // ==========================================

  async listReturnPolicies(filter?: { status?: string; search?: string }) {
    const rows = await policiesRepository.listReturnPolicies(filter);
    return rows.map(formatReturnPolicy);
  },

  async getReturnPolicyById(id: number) {
    const r = await policiesRepository.findReturnPolicyById(id);
    if (!r) throw new Error('Return policy not found');
    return formatReturnPolicy(r);
  },

  async createReturnPolicy(input: CreateReturnPolicyInput, userId?: bigint) {
    const existing = await policiesRepository.findReturnPolicyByCode(input.policyCode);
    if (existing) {
      throw new Error(`Policy code '${input.policyCode}' already exists`);
    }

    const created = await policiesRepository.createReturnPolicy({
      policyCode: input.policyCode.trim().toUpperCase(),
      policyName: input.policyName.trim(),
      isReturnable: input.isReturnable ?? true,
      isReplaceable: input.isReplaceable ?? true,
      returnWindowDays: input.returnWindowDays ?? 0,
      replacementWindowDays: input.replacementWindowDays ?? 0,
      requiresTechnicianCheck: input.requiresTechnicianCheck ?? false,
      conditionsSummary: input.conditionsSummary?.trim() || null,
      termsAndConditions: input.termsAndConditions?.trim() || null,
      status: input.status || 'ACTIVE',
      createdAt: new Date(),
      createdBy: userId,
    });

    return created;
  },

  async updateReturnPolicy(id: number, input: UpdateReturnPolicyInput, userId?: bigint) {
    const existing = await policiesRepository.findReturnPolicyById(id);
    if (!existing) throw new Error('Return policy not found');

    const updated = await policiesRepository.updateReturnPolicy(id, {
      ...(input.policyName !== undefined && { PolicyName: input.policyName.trim() }),
      ...(input.isReturnable !== undefined && { IsReturnable: input.isReturnable }),
      ...(input.isReplaceable !== undefined && { IsReplaceable: input.isReplaceable }),
      ...(input.returnWindowDays !== undefined && { ReturnWindowDays: input.returnWindowDays }),
      ...(input.replacementWindowDays !== undefined && { ReplacementWindowDays: input.replacementWindowDays }),
      ...(input.requiresTechnicianCheck !== undefined && { RequiresTechnicianCheck: input.requiresTechnicianCheck }),
      ...(input.conditionsSummary !== undefined && { ConditionsSummary: input.conditionsSummary?.trim() || null }),
      ...(input.termsAndConditions !== undefined && { TermsAndConditions: input.termsAndConditions?.trim() || null }),
      ...(input.status !== undefined && { Status: input.status }),
      UpdatedAt: new Date(),
      UpdatedBy: userId,
    });

    return updated;
  },

  async toggleReturnPolicyStatus(id: number, userId?: bigint) {
    const existing = await policiesRepository.findReturnPolicyById(id);
    if (!existing) throw new Error('Return policy not found');

    const nextStatus = existing.Status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return await policiesRepository.updateReturnPolicy(id, {
      Status: nextStatus,
      UpdatedAt: new Date(),
      UpdatedBy: userId,
    });
  },

  // ==========================================
  // WARRANTY POLICIES
  // ==========================================

  async listWarrantyPolicies(filter?: { status?: string; search?: string }) {
    const rows = await policiesRepository.listWarrantyPolicies(filter);
    return rows.map(formatWarrantyPolicy);
  },

  async getWarrantyPolicyById(id: number) {
    const r = await policiesRepository.findWarrantyPolicyById(id);
    if (!r) throw new Error('Warranty policy not found');
    return formatWarrantyPolicy(r);
  },

  async createWarrantyPolicy(input: CreateWarrantyPolicyInput, userId?: bigint) {
    const existing = await policiesRepository.findWarrantyPolicyByCode(input.policyCode);
    if (existing) {
      throw new Error(`Policy code '${input.policyCode}' already exists`);
    }

    const created = await policiesRepository.createWarrantyPolicy({
      policyCode: input.policyCode.trim().toUpperCase(),
      policyName: input.policyName.trim(),
      warrantyType: input.warrantyType || 'BRAND',
      durationMonths: input.durationMonths ?? 0,
      serviceType: input.serviceType || 'CARRY_IN',
      coveredSummary: input.coveredSummary?.trim() || null,
      notCoveredSummary: input.notCoveredSummary?.trim() || null,
      termsAndConditions: input.termsAndConditions?.trim() || null,
      status: input.status || 'ACTIVE',
      createdAt: new Date(),
      createdBy: userId,
    });

    return created;
  },

  async updateWarrantyPolicy(id: number, input: UpdateWarrantyPolicyInput, userId?: bigint) {
    const existing = await policiesRepository.findWarrantyPolicyById(id);
    if (!existing) throw new Error('Warranty policy not found');

    const updated = await policiesRepository.updateWarrantyPolicy(id, {
      ...(input.policyName !== undefined && { PolicyName: input.policyName.trim() }),
      ...(input.warrantyType !== undefined && { WarrantyType: input.warrantyType }),
      ...(input.durationMonths !== undefined && { DurationMonths: input.durationMonths }),
      ...(input.serviceType !== undefined && { ServiceType: input.serviceType }),
      ...(input.coveredSummary !== undefined && { CoveredSummary: input.coveredSummary?.trim() || null }),
      ...(input.notCoveredSummary !== undefined && { NotCoveredSummary: input.notCoveredSummary?.trim() || null }),
      ...(input.termsAndConditions !== undefined && { TermsAndConditions: input.termsAndConditions?.trim() || null }),
      ...(input.status !== undefined && { Status: input.status }),
      UpdatedAt: new Date(),
      UpdatedBy: userId,
    });

    return updated;
  },

  async toggleWarrantyPolicyStatus(id: number, userId?: bigint) {
    const existing = await policiesRepository.findWarrantyPolicyById(id);
    if (!existing) throw new Error('Warranty policy not found');

    const nextStatus = existing.Status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return await policiesRepository.updateWarrantyPolicy(id, {
      Status: nextStatus,
      UpdatedAt: new Date(),
      UpdatedBy: userId,
    });
  },
};
