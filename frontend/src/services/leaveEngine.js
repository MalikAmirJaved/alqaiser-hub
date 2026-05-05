// src/services/leaveEngine.js - Complete file
import { ls } from "./localStorageService";
import { companyContext } from "./companyContextService";

export class LeaveEngine {
  constructor() {
    const company = ls.get("company") || {};
    this.workingDays = company.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    this.holidays = company.publicHolidays || [];
  }

  calculateWorkingDays(start, end) {
    let days = 0;
    let current = new Date(start);
    const endDate = new Date(end);
    
    while (current <= endDate) {
      const dayName = current.toLocaleDateString("en-US", { weekday: "long" });
      const isHoliday = this.holidays.some(h => new Date(h.date).toDateString() === current.toDateString());
      
      if (this.workingDays.includes(dayName) && !isHoliday) {
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  getBalance(employeeId, leaveTypeId, year) {
    const balances = ls.get("leaveBalances", []);
    const filtered = balances.filter(b => 
      b.employee_id === employeeId && 
      b.leave_type_id === leaveTypeId && 
      b.year === year
    );
    const balance = filtered[0] || { allocated: 0, used: 0, available: 0, carry_forward_from: 0 };
    return balance;
  }

  validateRequest(employeeId, leaveTypeId, start, end, year, isHalfDay = false) {
    const types = ls.get("leaveTypes", []);
    const type = types.find(t => t.id === leaveTypeId);
    
    if (!type) return { valid: false, error: "Invalid leave type" };

    let requestedDays = this.calculateWorkingDays(start, end);
    if (isHalfDay && requestedDays === 1) requestedDays = 0.5;
    
    const balance = this.getBalance(employeeId, leaveTypeId, year);
    
    // Check probation period if applicable
    const employees = ls.get("employees", []);
    const employee = employees.find(e => e.id === employeeId);
    if (employee && type.applicable_to === "PROBATION") {
      const joiningDate = new Date(employee.joining_date);
      const today = new Date();
      const daysSinceJoining = Math.floor((today - joiningDate) / (1000 * 60 * 60 * 24));
      if (daysSinceJoining > (employee.probation_days || 180)) {
        return { valid: false, error: "This leave type is only applicable during probation period" };
      }
    } else if (employee && type.applicable_to === "FULL_TIME" && employee.employment_type !== "FULL_TIME") {
      return { valid: false, error: "This leave type is only for full-time employees" };
    } else if (employee && type.applicable_to === "CONTRACT" && employee.employment_type !== "CONTRACT") {
      return { valid: false, error: "This leave type is only for contract employees" };
    }
    
    // Check advance notice
    if (type.min_advance_notice_days > 0) {
      const today = new Date();
      const startDate = new Date(start);
      const daysNotice = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
      if (daysNotice < type.min_advance_notice_days) {
        return { valid: false, error: `Minimum ${type.min_advance_notice_days} days advance notice required` };
      }
    }
    
    if (balance.available < requestedDays) {
      return { 
        valid: false, 
        error: `Insufficient balance. Available: ${balance.available}, Requested: ${requestedDays}` 
      };
    }
    
    return { valid: true, days: requestedDays };
  }

  updateBalances(employeeId, leaveTypeId, year, days, status) {
    const balances = ls.get("leaveBalances", []);
    const idx = balances.findIndex(b => 
      b.employee_id === employeeId && 
      b.leave_type_id === leaveTypeId && 
      b.year === year
    );
    
    if (idx !== -1) {
      const b = balances[idx];
      if (status === "APPROVED") {
        b.used += days;
        b.available = Math.max(0, b.allocated - b.used + (b.carry_forward_from || 0));
      } else if (status === "CANCELLED" && b.used >= days) {
        b.used -= days;
        b.available = Math.max(0, b.allocated - b.used + (b.carry_forward_from || 0));
      }
      balances[idx] = b;
      ls.set("leaveBalances", balances);
    }
  }

  // Auto-calculate year-end carry forward
  processYearEndCarryForward(year) {
    const yearEnd = new Date(year, 11, 31);
    const balances = ls.get("leaveBalances", []);
    const types = ls.get("leaveTypes", []);
    let updated = false;
    
    balances.forEach(b => {
      if (b.year === year && b.available > 0) {
        const type = types.find(t => t.id === b.leave_type_id);
        if (type && type.carry_forward_allowed === "true") {
          const maxCarry = type.max_carry_forward_days || Infinity;
          const carryAmount = Math.min(b.available, maxCarry);
          
          // Create next year balance with carry forward
          const nextYearBalance = {
            ...b,
            id: uid("lb"),
            year: year + 1,
            allocated: type.max_days_per_year,
            used: 0,
            available: type.max_days_per_year + carryAmount,
            carry_forward_from: carryAmount,
          };
          balances.push(nextYearBalance);
          updated = true;
        }
      }
    });
    
    if (updated) ls.set("leaveBalances", balances);
    return updated;
  }
}