// ============================================
// FILE: src/services/payrollEngine.js (NEW)
// Advanced Payroll Processing System
// ============================================

/**
 * Payroll Engine - Handles employee salary processing, tax calculations, and disbursement
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
    
    // Calculate taxes (Income Tax, Social Security, etc.)
    const taxCalculation = this.calculateEmployeeTaxes(employee, grossSalary);
    
    // Calculate other deductions
    const loanDeductions = this.calculateLoanDeductions(employee.id);
    const benefitDeductions = this.calculateBenefitDeductions(employee.id);
    const customDeductionsTotal = customDeductions.reduce((sum, d) => sum + d.amount, 0);
    
    const totalDeductions = 
      taxCalculation.total_tax + 
      loanDeductions + 
      benefitDeductions + 
      customDeductionsTotal;
    
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
        taxes: taxCalculation.tax_breakdown,
        loans: loanDeductions,
        benefits: benefitDeductions,
        custom: customDeductions,
      },
      attendance_adjustment: attendanceAdjustment,
      tax_calculation: taxCalculation,
      status: "CALCULATED",
    });
    
    return {
      employee_id: employee.id,
      employee_name: `${employee.first_name} ${employee.last_name || ""}`,
      gross_salary: grossSalary,
      total_deductions: totalDeductions,
      net_salary: netSalary,
      tax_breakdown: taxCalculation.tax_breakdown,
      bonuses: bonuses,
      deductions_summary: {
        tax: taxCalculation.total_tax,
        loan: loanDeductions,
        benefit: benefitDeductions,
        custom: customDeductionsTotal,
      },
      payroll_record: payrollRecord,
    };
  }

  /**
   * Calculate employee taxes (Income Tax, Social Security, etc.)
   */
  calculateEmployeeTaxes(employee, grossSalary) {
    const country = employee.country || "PK";
    const taxBrackets = this.getTaxBrackets(country);
    const socialSecurityRate = this.getSocialSecurityRate(country);
    
    let incomeTax = 0;
    let remainingSalary = grossSalary;
    
    // Calculate progressive income tax
    for (const bracket of taxBrackets) {
      if (remainingSalary <= 0) break;
      
      const taxableInBracket = Math.min(remainingSalary, bracket.max - bracket.min);
      incomeTax += taxableInBracket * (bracket.rate / 100);
      remainingSalary -= taxableInBracket;
    }
    
    // Calculate social security
    const socialSecurity = grossSalary * (socialSecurityRate / 100);
    
    // Calculate professional tax (if applicable)
    const professionalTax = this.calculateProfessionalTax(grossSalary, country);
    
    // Calculate withholding tax
    const withholdingTax = this.calculateWithholdingTax(employee, grossSalary);
    
    const taxBreakdown = [
      { name: "Income Tax", rate: "progressive", amount: incomeTax },
      { name: "Social Security", rate: socialSecurityRate, amount: socialSecurity },
      { name: "Professional Tax", rate: null, amount: professionalTax },
      { name: "Withholding Tax", rate: null, amount: withholdingTax },
    ].filter(t => t.amount > 0);
    
    const totalTax = taxBreakdown.reduce((sum, t) => sum + t.amount, 0);
    
    // Create tax transaction for payroll
    this.taxEngine.calculateTax({
      module: "hr",
      transactionType: "salary",
      amount: grossSalary,
      country: country,
      context: {
        employee_id: employee.id,
        tax_type: "payroll",
      },
    });
    
    return {
      total_tax: totalTax,
      tax_breakdown: taxBreakdown,
      income_tax: incomeTax,
      social_security: socialSecurity,
      professional_tax: professionalTax,
      withholding_tax: withholdingTax,
    };
  }

  /**
   * Get tax brackets for a country
   */
  getTaxBrackets(country) {
    const brackets = {
      PK: [
        { min: 0, max: 600000, rate: 0 },
        { min: 600000, max: 1200000, rate: 5 },
        { min: 1200000, max: 2400000, rate: 10 },
        { min: 2400000, max: 3600000, rate: 15 },
        { min: 3600000, max: 6000000, rate: 20 },
        { min: 6000000, max: Infinity, rate: 25 },
      ],
      US: [
        { min: 0, max: 11000, rate: 10 },
        { min: 11000, max: 44725, rate: 12 },
        { min: 44725, max: 95375, rate: 22 },
        { min: 95375, max: 182100, rate: 24 },
        { min: 182100, max: 231250, rate: 32 },
        { min: 231250, max: 578125, rate: 35 },
        { min: 578125, max: Infinity, rate: 37 },
      ],
      GB: [
        { min: 0, max: 12570, rate: 0 },
        { min: 12570, max: 50270, rate: 20 },
        { min: 50270, max: 125140, rate: 40 },
        { min: 125140, max: Infinity, rate: 45 },
      ],
    };
    
    return brackets[country] || brackets.PK;
  }

  /**
   * Get social security rate for a country
   */
  getSocialSecurityRate(country) {
    const rates = {
      PK: 12, // 12% for EOBI + PESSI
      US: 7.65, // FICA (Social Security + Medicare)
      GB: 13.8, // National Insurance
    };
    return rates[country] || 12;
  }

  /**
   * Calculate professional tax
   */
  calculateProfessionalTax(grossSalary, country) {
    if (country !== "PK") return 0;
    
    // Professional tax slabs for Pakistan (monthly)
    if (grossSalary <= 25000) return 0;
    if (grossSalary <= 35000) return 100;
    if (grossSalary <= 50000) return 200;
    if (grossSalary <= 75000) return 350;
    return 500;
  }

  /**
   * Calculate withholding tax
   */
  calculateWithholdingTax(employee, grossSalary) {
    // Implement based on country-specific withholding rules
    // For now, return 0 as it's usually calculated at payment time
    return 0;
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
   * Calculate benefit deductions
   */
  calculateBenefitDeductions(employeeId) {
    const benefits = ls.get("employeeBenefits", []);
    const activeBenefits = benefits.filter(b => 
      b.employee_id === employeeId && 
      b.status === "ACTIVE" &&
      b.employee_contribution > 0
    );
    
    return activeBenefits.reduce((sum, benefit) => sum + benefit.employee_contribution, 0);
  }

  /**
   * Process payroll for multiple employees
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
   * Generate payslip for employee
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
    };
  }
}