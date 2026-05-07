// ============================================
// FILE: src/services/companyContextService.js
// ============================================

import { apiFetch } from "@/lib/api";

/**
 * Company Context Service - Handles multi-tenant data isolation with real backend
 */
class CompanyContextService {
  constructor() {
    this.currentCompany = null;
    this.currentBranch = null;
    this.currentUser = null;
    this.initialized = false;
    this.pendingContext = null;
  }

  /**
   * Initialize company context for current user from backend
   */
  async init() {
    if (this.initialized) return true;
    
    try {
      const context = await apiFetch('/api/organization/context/');
      this.currentCompany = context.companyId ? { id: context.companyId, name: context.companyName } : null;
      this.currentBranch = context.branchId ? { id: context.branchId, name: context.branchName } : null;
      
      // Get current user from /me endpoint
      const user = await apiFetch('/api/accounts/me/');
      this.currentUser = user;
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize company context:', error);
      return false;
    }
  }

  /**
   * Get current company ID
   */
  getCurrentCompanyId() {
    return this.currentCompany?.id || null;
  }

  /**
   * Get current branch ID
   */
  getCurrentBranchId() {
    return this.currentBranch?.id || null;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId() {
    return this.currentUser?.id || null;
  }

  /**
   * Get current user role
   */
  getCurrentUserRole() {
    return this.currentUser?.role || null;
  }

  /**
   * Switch company context
   */
  async switchCompany(companyId) {
    try {
      await apiFetch('/api/organization/switch-company/', {
        method: 'POST',
        body: JSON.stringify({ companyId })
      });
      
      // Re-initialize context
      this.initialized = false;
      await this.init();
      return true;
    } catch (error) {
      console.error('Failed to switch company:', error);
      return false;
    }
  }

  /**
   * Update branch context
   */
  async updateBranch(branchId) {
    try {
      await apiFetch('/api/organization/context/', {
        method: 'PATCH',
        body: JSON.stringify({ branchId: branchId || null })
      });
      
      this.currentBranch = branchId ? { id: branchId } : null;
      return true;
    } catch (error) {
      console.error('Failed to update branch:', error);
      return false;
    }
  }

  /**
   * Add company context to a record (for creation - backend handles this)
   * This is now just for frontend convenience, backend will add actual context
   */
  addContextToRecord(record, options = {}) {
    const companyId = options.companyId || this.getCurrentCompanyId();
    const branchId = options.branchId || this.getCurrentBranchId();
    const userId = options.userId || this.getCurrentUserId();
    
    // Return record with context metadata for frontend display
    // Backend will set the actual company_id, branch_id, created_by
    return {
      ...record,
      _companyId: companyId,
      _branchId: branchId,
      _createdBy: userId,
    };
  }

  /**
   * Filter records by current company/branch context
   * For SELECT queries - only show data from user's company/branch
   * Note: Real filtering should be done by backend queries
   */
  filterByContext(records, options = {}) {
    const companyId = options.companyId || this.getCurrentCompanyId();
    const branchId = options.branchId || this.getCurrentBranchId();
    const userRole = this.getCurrentUserRole();
    
    // This is a client-side fallback. Real filtering should be done by API.
    // Company Admin can see all records of their company
    if (userRole === "COMPANY_ADMIN") {
      return records.filter(record => record.company_id === companyId || !record.company_id);
    }
    
    // Branch Admin can see all records of their branch
    if (userRole === "BRANCH_ADMIN") {
      return records.filter(record => 
        (record.company_id === companyId || !record.company_id) && 
        (record.branch_id === branchId || !record.branch_id)
      );
    }
    
    // Staff can only see records they created or branch records
    const userId = this.getCurrentUserId();
    return records.filter(record => 
      (record.company_id === companyId || !record.company_id) && 
      ((record.branch_id === branchId || !record.branch_id) || record.created_by === userId)
    );
  }

  /**
   * Clear context cache
   */
  clearCache() {
    this.currentCompany = null;
    this.currentBranch = null;
    this.currentUser = null;
    this.initialized = false;
  }
}

export const companyContext = new CompanyContextService();