
// ============================================
// FILE: src/services/companyContextService.js (NEW)
// ============================================

import { ls } from "./localStorageService";
import { permissionService } from "./permissionService";

/**
 * Company Context Service - Handles multi-tenant data isolation
 * Adds company_id and branch_id to all records automatically
 */
class CompanyContextService {
  constructor() {
    this.currentCompany = null;
    this.currentBranch = null;
    this.currentUser = null;
  }

  /**
   * Initialize company context for current user
   */
  init() {
    const session = permissionService.getSession();
    if (!session) {
      this.currentCompany = null;
      this.currentBranch = null;
      this.currentUser = null;
      return false;
    }

    this.currentUser = session;
    this.currentCompany = ls.get("company", null);
    
    // Get user's branch from user record
    const users = ls.get("users", []);
    const userRecord = users.find(u => u.id === session.id);
    if (userRecord) {
      this.currentBranch = userRecord.branch_id || null;
    }
    
    return true;
  }

  /**
   * Get current company ID
   */
  getCurrentCompanyId() {
    if (!this.currentCompany) this.init();
    return this.currentCompany?.id || null;
  }

  /**
   * Get current branch ID
   */
  getCurrentBranchId() {
    if (!this.currentBranch && this.currentUser) this.init();
    return this.currentBranch;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId() {
    if (!this.currentUser) this.init();
    return this.currentUser?.id || null;
  }

  /**
   * Add company context to a record (for creation)
   */
  addContextToRecord(record, options = {}) {
    const companyId = options.companyId || this.getCurrentCompanyId();
    const branchId = options.branchId || this.getCurrentBranchId();
    const userId = options.userId || this.getCurrentUserId();
    
    return {
      ...record,
      company_id: companyId,
      branch_id: branchId,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Add context to multiple records
   */
  addContextToRecords(records, options = {}) {
    return records.map(record => this.addContextToRecord(record, options));
  }

  /**
   * Filter records by current company/branch context
   * For SELECT queries - only show data from user's company/branch
   */
  filterByContext(records, options = {}) {
    const companyId = options.companyId || this.getCurrentCompanyId();
    const branchId = options.branchId || this.getCurrentBranchId();
    const userRole = this.currentUser?.role;
    
    // Company Admin can see all records of their company
    if (userRole === "COMPANY_ADMIN") {
      return records.filter(record => record.company_id === companyId);
    }
    
    // Branch Admin can see all records of their branch
    if (userRole === "BRANCH_ADMIN") {
      return records.filter(record => 
        record.company_id === companyId && record.branch_id === branchId
      );
    }
    
    // Staff can only see records they created (or branch-specific based on permissions)
    const userId = this.getCurrentUserId();
    return records.filter(record => 
      record.company_id === companyId && 
      (record.branch_id === branchId || record.created_by === userId)
    );
  }

  /**
   * Update record with new timestamps
   */
  updateRecordTimestamps(record) {
    return {
      ...record,
      updated_at: new Date().toISOString(),
      updated_by: this.getCurrentUserId(),
    };
  }

  /**
   * Clear context cache
   */
  clearCache() {
    this.currentCompany = null;
    this.currentBranch = null;
    this.currentUser = null;
  }
}

export const companyContext = new CompanyContextService();
