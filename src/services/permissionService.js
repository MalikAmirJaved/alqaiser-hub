
// ============================================
// FILE: src/services/permissionService.js (NEW)
// ============================================

import { ls } from "./localStorageService";

/**
 * Permission Service - Handles all RBAC operations
 * Production-ready permission checking system
 */
class PermissionService {
  constructor() {
    this.permissionsCache = null;
    this.currentUser = null;
  }

  /**
   * Initialize or refresh permission cache for current user
   */
  init() {
    const session = this.getSession();
    if (!session) {
      this.permissionsCache = null;
      this.currentUser = null;
      return false;
    }

    this.currentUser = session;
    const allPermissions = ls.get("permissions", []);
    this.permissionsCache = allPermissions.filter(p => p.user_id === session.id);
    return true;
  }

  /**
   * Get current session (works with both localStorage and sessionStorage)
   */
  getSession() {
    if (typeof window === "undefined") return null;
    
    const localSession = ls.get("session");
    if (localSession) return localSession;
    
    const sessionStorageData = sessionStorage.getItem("clickmasters_session");
    if (sessionStorageData) {
      try {
        return JSON.parse(sessionStorageData);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    if (!this.currentUser) this.init();
    return this.currentUser;
  }

  /**
   * Get all permissions for current user
   */
  getUserPermissions() {
    if (!this.permissionsCache) this.init();
    return this.permissionsCache || [];
  }

  /**
   * Check if user has specific permission for a feature
   * @param {string} moduleName - Module name (HR, INVENTORY, FINANCE, SETTINGS)
   * @param {string} featureName - Feature/page name
   * @param {string} action - 'create', 'update', 'delete', 'view'
   * @returns {boolean}
   */
  hasPermission(moduleName, featureName, action) {
    const permissions = this.getUserPermissions();
    
    // Super admin override: COMPANY_ADMIN has all permissions
    if (this.currentUser?.role === "COMPANY_ADMIN") {
      return true;
    }

    const permission = permissions.find(
      p => p.module_name === moduleName && p.feature_name === featureName
    );

    if (!permission) return false;

    switch (action) {
      case "create":
        return permission.is_create_access === "true";
      case "update":
        return permission.is_update_access === "true";
      case "delete":
        return permission.is_delete_access === "true";
      case "view":
        return permission.is_view_access === "true";
      default:
        return false;
    }
  }

  /**
   * Check if user can view a specific module
   */
  canViewModule(moduleName) {
    // For module-level check, we check if user has view access to ANY feature in the module
    const permissions = this.getUserPermissions();
    if (this.currentUser?.role === "COMPANY_ADMIN") return true;
    
    return permissions.some(
      p => p.module_name === moduleName && p.is_view_access === "true"
    );
  }

  /**
   * Get all modules user has access to
   */
  getAccessibleModules() {
    const permissions = this.getUserPermissions();
    if (this.currentUser?.role === "COMPANY_ADMIN") {
      return ["HR", "INVENTORY", "FINANCE", "SETTINGS"];
    }
    
    const modules = new Set();
    permissions.forEach(p => {
      if (p.is_view_access === "true") {
        modules.add(p.module_name);
      }
    });
    return Array.from(modules);
  }

  /**
   * Get accessible features for a specific module
   */
  getAccessibleFeatures(moduleName, action = "view") {
    const permissions = this.getUserPermissions();
    if (this.currentUser?.role === "COMPANY_ADMIN") {
      // Return all features for this module from moduleFeatures
      const moduleFeatures = ls.get("moduleFeatures", {});
      return moduleFeatures[moduleName] || [];
    }
    
    return permissions
      .filter(p => p.module_name === moduleName && p[`is_${action}_access`] === "true")
      .map(p => p.feature_name);
  }

  /**
   * Check if user can perform any action on a feature
   */
  canAccessFeature(moduleName, featureName) {
    return this.hasPermission(moduleName, featureName, "view");
  }

  /**
   * Get CRUD permissions for a specific feature
   */
  getFeaturePermissions(moduleName, featureName) {
    return {
      canCreate: this.hasPermission(moduleName, featureName, "create"),
      canUpdate: this.hasPermission(moduleName, featureName, "update"),
      canDelete: this.hasPermission(moduleName, featureName, "delete"),
      canView: this.hasPermission(moduleName, featureName, "view"),
    };
  }

  /**
   * Clear cache (useful after logout or permission changes)
   */
  clearCache() {
    this.permissionsCache = null;
    this.currentUser = null;
  }
}

export const permissionService = new PermissionService();

/**
 * Hook for using permissions in components
 */
export function usePermissions() {
  const [perms, setPerms] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    permissionService.init();
    setUser(permissionService.getCurrentUser());
    setPerms(permissionService.getUserPermissions());
  }, []);

  return {
    user,
    permissions: perms,
    hasPermission: (module, feature, action) => permissionService.hasPermission(module, feature, action),
    canViewModule: (module) => permissionService.canViewModule(module),
    getFeaturePermissions: (module, feature) => permissionService.getFeaturePermissions(module, feature),
    accessibleModules: permissionService.getAccessibleModules(),
  };
}
