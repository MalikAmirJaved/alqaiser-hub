// ============================================
// FILE: src/services/permissionService.js
// ============================================

import { apiFetch } from "@/lib/api";
import { companyContext } from "./companyContextService";

/**
 * Permission Service - Handles all RBAC operations with real backend
 */
class PermissionService {
  constructor() {
    this.permissionsCache = null;
    this.modulesCache = null;
    this.currentUser = null;
    this.initialized = false;
  }

  /**
   * Initialize or refresh permission cache from backend
   */
  async init(forceRefresh = false) {
    if (this.initialized && !forceRefresh) return true;
    
    try {
      // Get current user
      const user = await apiFetch('/api/accounts/me/');
      this.currentUser = user;
      
      // Get user permissions
      const permissions = await apiFetch('/api/organization/permissions/');
      this.permissionsCache = permissions;
      
      // Get modules (with features)
      const modules = await apiFetch('/api/organization/modules/');
      this.modulesCache = modules;
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize permissions:', error);
      return false;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get all permissions for current user
   */
  getUserPermissions() {
    return this.permissionsCache || [];
  }

  /**
   * Check if user has specific permission for a feature
   * @param {string} moduleCode - Module code (HR, INVENTORY, FINANCE, SETTINGS)
   * @param {string} featureCode - Feature code
   * @param {string} action - 'create', 'update', 'delete', 'view'
   * @returns {boolean}
   */
  hasPermission(moduleCode, featureCode, action) {
    if (!this.permissionsCache) {
      console.warn('Permissions not initialized. Call init() first.');
      return false;
    }
    
    // Super admin override
    if (this.currentUser?.role === "COMPANY_ADMIN" || this.currentUser?.is_superuser) {
      return true;
    }

    const permission = this.permissionsCache.find(
      p => p.moduleCode === moduleCode && p.featureCode === featureCode
    );

    if (!permission) return false;

    switch (action) {
      case "create":
        return permission.isCreateAccess === "true";
      case "update":
        return permission.isUpdateAccess === "true";
      case "delete":
        return permission.isDeleteAccess === "true";
      case "view":
        return permission.isViewAccess === "true";
      default:
        return false;
    }
  }

  /**
   * Check if user can view a specific module
   */
  canViewModule(moduleCode) {
    if (this.currentUser?.role === "COMPANY_ADMIN" || this.currentUser?.is_superuser) {
      return true;
    }
    
    return this.permissionsCache?.some(
      p => p.moduleCode === moduleCode && p.isViewAccess === "true"
    ) || false;
  }

  /**
   * Get all modules user has access to
   */
  getAccessibleModules() {
    if (this.currentUser?.role === "COMPANY_ADMIN" || this.currentUser?.is_superuser) {
      return this.modulesCache || [];
    }
    
    const accessibleModules = [];
    const modulesWithAccess = new Set();
    
    this.permissionsCache?.forEach(p => {
      if (p.isViewAccess === "true") {
        modulesWithAccess.add(p.moduleCode);
      }
    });
    
    // Filter modules by those with access
    this.modulesCache?.forEach(module => {
      if (modulesWithAccess.has(module.code)) {
        accessibleModules.push(module);
      }
    });
    
    return accessibleModules;
  }

  /**
   * Get accessible features for a specific module
   */
  getAccessibleFeatures(moduleCode, action = "view") {
    if (this.currentUser?.role === "COMPANY_ADMIN" || this.currentUser?.is_superuser) {
      const module = this.modulesCache?.find(m => m.code === moduleCode);
      return module?.features || [];
    }
    
    const actionKey = action === "view" ? "isViewAccess" :
                      action === "create" ? "isCreateAccess" :
                      action === "update" ? "isUpdateAccess" : "isDeleteAccess";
    
    return this.permissionsCache
      ?.filter(p => p.moduleCode === moduleCode && p[actionKey] === "true")
      ?.map(p => ({ code: p.featureCode, name: p.featureName })) || [];
  }

  /**
   * Check if user can perform any action on a feature
   */
  canAccessFeature(moduleCode, featureCode) {
    return this.hasPermission(moduleCode, featureCode, "view");
  }

  /**
   * Get CRUD permissions for a specific feature
   */
  getFeaturePermissions(moduleCode, featureCode) {
    return {
      canCreate: this.hasPermission(moduleCode, featureCode, "create"),
      canUpdate: this.hasPermission(moduleCode, featureCode, "update"),
      canDelete: this.hasPermission(moduleCode, featureCode, "delete"),
      canView: this.hasPermission(moduleCode, featureCode, "view"),
    };
  }

  /**
   * Clear cache (useful after logout or permission changes)
   */
  clearCache() {
    this.permissionsCache = null;
    this.modulesCache = null;
    this.currentUser = null;
    this.initialized = false;
  }
}

export const permissionService = new PermissionService();

/**
 * React hook for using permissions in components
 */
export function usePermissions() {
  const [state, setState] = React.useState({
    user: null,
    permissions: null,
    modules: null,
    loading: true,
  });

  React.useEffect(() => {
    const loadPermissions = async () => {
      await permissionService.init();
      setState({
        user: permissionService.getCurrentUser(),
        permissions: permissionService.getUserPermissions(),
        modules: permissionService.getAccessibleModules(),
        loading: false,
      });
    };
    
    loadPermissions();
  }, []);

  return {
    ...state,
    hasPermission: (moduleCode, featureCode, action) => 
      permissionService.hasPermission(moduleCode, featureCode, action),
    canViewModule: (moduleCode) => permissionService.canViewModule(moduleCode),
    getFeaturePermissions: (moduleCode, featureCode) => 
      permissionService.getFeaturePermissions(moduleCode, featureCode),
  };
}