import { policiesRepository, ReturnPolicyRecord } from './policies.repository.js';

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
};
