
// ============================================
// FILE: src/services/payrollEngine.js (UPDATED)
// Advanced Payroll Processing System - NO TAX DEDUCTION
// ============================================

/**
 * Payroll Engine - Handles employee salary processing
 * NOTE: Tax is NOT deducted from salaries - handled separately by business entities
 */
import { ls } from "./localStorageService";
import { companyContext } from "./companyContextService";
import { TaxEngine } from "./taxEngine";

export class PayrollEngine {
  get taxEngine() {
    if (!this._taxEngine) {
      this._taxEngine = new TaxEngine();
    }
    return this._taxEngine;
  }

  /**
   * Calculate payroll for a single employee
   * @param {Object} employee - Employee object
   * @param {Object} options - Payroll options (month, year, bonuses, deductions)
   * @returns {Object} Payroll calculation result
   */
  calculateEmployeePayroll(employee, options = {}) {
    const { month, year, bonuses = [], customDeductions = [], attendance = {} } = options;
    
    // Get compensation structure
    const compensation = this.getEmployeeCompensation(employee.id);
    
    // Calculate gross salary
    let grossSalary = compensation?.total || employee.salary || 0;
    
    // Add bonuses
    const totalBonus = bonuses.reduce((sum, b) => sum + b.amount, 0);
    grossSalary += totalBonus;
    
    // Calculate attendance-based adjustments
    const attendanceAdjustment = this.calculateAttendanceAdjustment(employee.id, attendance, grossSalary);
    grossSalary += attendanceAdjustment;
    
    // ONLY calculate loan deductions - NO TAX DEDUCTION
    const loanDeductions = this.calculateLoanDeductions(employee.id);
    const customDeductionsTotal = customDeductions.reduce((sum, d) => sum + d.amount, 0);
    
    const totalDeductions = loanDeductions + customDeductionsTotal;
    
    const netSalary = grossSalary - totalDeductions;
    
    // Create payroll record
    const payrollRecord = this.createPayrollRecord({
      employee_id: employee.id,
      employee_name: `${employee.first_name} ${employee.last_name || ""}`,
      month,
      year,
      gross_salary: grossSalary,
      total_deductions: totalDeductions,
      net_salary: netSalary,
      bonuses: bonuses,
      deductions: {
        taxes: 0, // ZERO TAX on salaries
        loans: loanDeductions,
        custom: customDeductions,
      },
      attendance_adjustment: attendanceAdjustment,
      status: "CALCULATED",
    });
    
    return {
      employee_id: employee.id,
      employee_name: `${employee.first_name} ${employee.last_name || ""}`,
      gross_salary: grossSalary,
      total_deductions: totalDeductions,
      net_salary: netSalary,
      taxes: 0, // ZERO TAX on salaries
      bonuses: bonuses,
      deductions_summary: {
        tax: 0, // ZERO TAX on salaries
        loan: loanDeductions,
        custom: customDeductionsTotal,
      },
      payroll_record: payrollRecord,
    };
  }

  /**
   * Calculate employee taxes - DISABLED (no tax deduction from salary)
   * Kept for reference but returns zero
   */
  calculateEmployeeTaxes(employee, grossSalary) {
    // Tax is NOT deducted from employee salaries
    // This method returns zero to ensure no tax is calculated
    return {
      total_tax: 0,
      tax_breakdown: [],
      income_tax: 0,
      social_security: 0,
      professional_tax: 0,
      withholding_tax: 0,
      note: "No tax deduction from salary - tax applied to business transactions only",
    };
  }

  /**
   * Get tax brackets for a country - NOT USED (no salary tax)
   */
  getTaxBrackets(country) {
    return []; // No tax brackets for salary
  }

  /**
   * Get social security rate - DISABLED
   */
  getSocialSecurityRate(country) {
    return 0; // No social security deduction from salary
  }

  /**
   * Calculate professional tax - DISABLED
   */
  calculateProfessionalTax(grossSalary, country) {
    return 0; // No professional tax deduction
  }

  /**
   * Calculate withholding tax - DISABLED
   */
  calculateWithholdingTax(employee, grossSalary) {
    return 0; // No withholding tax
  }

  /**
   * Calculate attendance-based adjustments
   */
  calculateAttendanceAdjustment(employeeId, attendance, monthlySalary) {
    const dailyRate = monthlySalary / 30; // Approximate daily rate
    let adjustment = 0;
    
    // Late deductions
    const lateMinutes = attendance.late_minutes || 0;
    const lateHours = lateMinutes / 60;
    adjustment -= lateHours * dailyRate * 0.5; // Deduct half of daily rate per hour late
    
    // Overtime addition
    const overtimeMinutes = attendance.overtime_minutes || 0;
    const overtimeHours = overtimeMinutes / 60;
    adjustment += overtimeHours * dailyRate * 1.5; // 1.5x for overtime
    
    // Absent deductions
    const absentDays = attendance.absent_days || 0;
    adjustment -= absentDays * dailyRate;
    
    return adjustment;
  }

  /**
   * Get employee compensation structure
   */
  getEmployeeCompensation(employeeId) {
    const compensations = ls.get("compensation", []);
    const companyContextFiltered = companyContext.filterByContext(compensations);
    return companyContextFiltered.find(c => c.employee_id === employeeId);
  }

  /**
   * Calculate loan deductions for employee
   */
  calculateLoanDeductions(employeeId) {
    const loans = ls.get("employeeLoans", []);
    const activeLoans = loans.filter(l => 
      l.employee_id === employeeId && 
      l.status === "ACTIVE" &&
      !l.completed
    );
    
    return activeLoans.reduce((sum, loan) => sum + (loan.monthly_deduction || 0), 0);
  }

  /**
   * Process payroll for multiple employees (salary only, no tax)
   */
  processPayroll({ month, year, employeeIds = null, options = {} }) {
    const employees = ls.get("employees", []);
    const filteredEmployees = employeeIds 
      ? employees.filter(e => employeeIds.includes(e.id))
      : employees;
    
    const results = [];
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    
    for (const employee of filteredEmployees) {
      const result = this.calculateEmployeePayroll(employee, { month, year, ...options });
      results.push(result);
      totalGross += result.gross_salary;
      totalDeductions += result.total_deductions;
      totalNet += result.net_salary;
    }
    
    // Create payroll batch record
    const batchRecord = this.createPayrollBatch({
      month,
      year,
      employee_count: results.length,
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_net: totalNet,
      tax_amount: 0, // ZERO TAX on salaries
      payroll_records: results,
      status: "PROCESSED",
    });
    
    return {
      batch_id: batchRecord.id,
      month,
      year,
      employee_count: results.length,
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_net: totalNet,
      tax_amount: 0,
      payroll_records: results,
      batch_record: batchRecord,
    };
  }

  /**
   * Create individual payroll record
   */
  createPayrollRecord(data) {
    const payrollRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...data,
      processed_at: new Date().toISOString(),
      ...companyContext.addContextToRecord({}),
    };
    
    const existingRecords = ls.get("payroll", []);
    ls.set("payroll", [payrollRecord, ...existingRecords]);
    
    return payrollRecord;
  }

  /**
   * Create payroll batch record
   */
  createPayrollBatch(data) {
    const batchRecord = {
      id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...data,
      processed_at: new Date().toISOString(),
      ...companyContext.addContextToRecord({}),
    };
    
    const existingBatches = ls.get("payrollBatches", []);
    ls.set("payrollBatches", [batchRecord, ...existingBatches]);
    
    return batchRecord;
  }

  /**
   * Generate payslip for employee (NO TAX DEDUCTION)
   */
  generatePayslip(employeeId, month, year) {
    const payrollRecords = ls.get("payroll", []);
    const record = payrollRecords.find(r => 
      r.employee_id === employeeId && 
      r.month === month && 
      r.year === year
    );
    
    if (!record) return null;
    
    const employee = ls.get("employees", []).find(e => e.id === employeeId);
    
    return {
      employee,
      payroll: record,
      generated_at: new Date().toISOString(),
      company: ls.get("company", {}),
      note: "No tax deduction applied to salary - tax only on business transactions",
    };
  }
}
