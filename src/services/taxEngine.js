// ============================================
// FILE: src/services/taxEngine.js (NEW)
// Production-ready Tax Engine with multi-country support
// ============================================

import { ls } from "./localStorageService";
import { companyContext } from "./companyContextService";

/**
 * Central Tax Engine - Handles all tax calculations across modules
 * Supports multi-country, multi-currency, and various tax types
 */
export class TaxEngine {
  constructor() {
    this.taxesCache = null;
    this.taxRulesCache = null;
  }

  /**
   * Initialize tax cache
   */
  init() {
    this.taxesCache = ls.get("taxes", []);
    this.taxRulesCache = ls.get("taxRules", []);
  }

  /**
   * Calculate tax for a transaction
   * @param {Object} params - Calculation parameters
   * @param {string} params.module - 'hr', 'inventory', 'finance'
   * @param {string} params.transactionType - 'invoice', 'salary', 'expense', 'purchase'
   * @param {number} params.amount - Base amount
   * @param {string} params.country - Country code (e.g., 'PK', 'US', 'GB')
   * @param {string} params.currency - Currency code
   * @param {Object} params.context - Additional context (product_id, user_id, etc.)
   * @returns {Object} Tax calculation result
   */
  calculateTax({ module, transactionType, amount, country, currency = "PKR", context = {} }) {
    this.init();
    
    const applicableTaxes = this.getApplicableTaxes(module, transactionType, country, context);
    
    let subtotal = amount;
    let totalTax = 0;
    const taxBreakdown = [];

    for (const tax of applicableTaxes) {
      const taxAmount = this.calculateTaxAmount(subtotal, tax.rate, tax.is_inclusive);
      
      taxBreakdown.push({
        tax_id: tax.id,
        tax_name: tax.name,
        tax_type: tax.type,
        rate: tax.rate,
        amount: taxAmount,
        is_inclusive: tax.is_inclusive,
        country: tax.country,
      });
      
      totalTax += taxAmount;
    }

    const total = subtotal + totalTax;

    // Create tax transaction record
    const taxTransaction = this.createTaxTransaction({
      module,
      transactionType,
      subtotal,
      totalTax,
      total,
      currency,
      country,
      taxBreakdown,
      context,
    });

    return {
      subtotal,
      totalTax,
      total,
      currency,
      taxBreakdown,
      taxTransaction,
    };
  }

  /**
   * Get applicable taxes based on rules
   */
  getApplicableTaxes(module, transactionType, country, context = {}) {
    const taxes = this.taxesCache || [];
    const taxRules = this.taxRulesCache || [];
    
    // Filter taxes by module and transaction type
    const applicableRules = taxRules.filter(rule => 
      rule.module === module && 
      rule.transaction_type === transactionType &&
      this.matchesConditions(rule.conditions, context)
    );
    
    const taxIds = new Set(applicableRules.map(rule => rule.tax_id));
    
    return taxes.filter(tax => 
      taxIds.has(tax.id) && 
      tax.is_active === "true" &&
      (tax.country === country || tax.country === "GLOBAL")
    );
  }

  /**
   * Check if conditions match the context
   */
  matchesConditions(conditions, context) {
    if (!conditions) return true;
    
    try {
      const parsedConditions = typeof conditions === "string" ? JSON.parse(conditions) : conditions;
      
      for (const [key, value] of Object.entries(parsedConditions)) {
        if (context[key] !== value) return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Calculate tax amount (handles inclusive/exclusive)
   */
  calculateTaxAmount(amount, rate, isInclusive) {
    const rateDecimal = rate / 100;
    
    if (isInclusive === "true") {
      // Tax is included in the price
      return amount - (amount / (1 + rateDecimal));
    } else {
      // Tax is added on top
      return amount * rateDecimal;
    }
  }

  /**
   * Create tax transaction record for audit trail
   */
  createTaxTransaction({ module, transactionType, subtotal, totalTax, total, currency, country, taxBreakdown, context }) {
    const transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      module,
      transaction_type: transactionType,
      subtotal,
      total_tax: totalTax,
      total,
      currency,
      country,
      tax_breakdown: JSON.stringify(taxBreakdown),
      reference_id: context.reference_id || null,
      reference_type: context.reference_type || null,
      created_at: new Date().toISOString(),
      ...companyContext.addContextToRecord({}),
    };
    
    // Store in tax_transactions table
    const existingTransactions = ls.get("tax_transactions", []);
    ls.set("tax_transactions", [transaction, ...existingTransactions]);
    
    return transaction;
  }

  /**
   * Get tax summary for reporting
   */
  getTaxSummary({ startDate, endDate, module = null, country = null }) {
    const transactions = ls.get("tax_transactions", []);
    const filtered = transactions.filter(t => {
      const date = new Date(t.created_at);
      if (startDate && date < new Date(startDate)) return false;
      if (endDate && date > new Date(endDate)) return false;
      if (module && t.module !== module) return false;
      if (country && t.country !== country) return false;
      return true;
    });
    
    const byModule = {};
    const byTaxType = {};
    let totalTax = 0;
    
    filtered.forEach(t => {
      totalTax += t.total_tax;
      
      if (!byModule[t.module]) byModule[t.module] = 0;
      byModule[t.module] += t.total_tax;
      
      const breakdown = JSON.parse(t.tax_breakdown || "[]");
      breakdown.forEach(b => {
        if (!byTaxType[b.tax_name]) byTaxType[b.tax_name] = 0;
        byTaxType[b.tax_name] += b.amount;
      });
    });
    
    return {
      total_tax: totalTax,
      transaction_count: filtered.length,
      by_module: byModule,
      by_tax_type: byTaxType,
      transactions: filtered,
    };
  }

  /**
   * Get input tax (tax paid on purchases)
   */
  getInputTax({ startDate, endDate }) {
    const transactions = ls.get("tax_transactions", []);
    return transactions.filter(t => 
      ["purchase", "expense"].includes(t.transaction_type) &&
      (!startDate || new Date(t.created_at) >= new Date(startDate)) &&
      (!endDate || new Date(t.created_at) <= new Date(endDate))
    );
  }

  /**
   * Get output tax (tax collected on sales)
   */
  getOutputTax({ startDate, endDate }) {
    const transactions = ls.get("tax_transactions", []);
    return transactions.filter(t => 
      ["invoice", "sale"].includes(t.transaction_type) &&
      (!startDate || new Date(t.created_at) >= new Date(startDate)) &&
      (!endDate || new Date(t.created_at) <= new Date(endDate))
    );
  }

  /**
   * Calculate net tax payable (Output - Input)
   */
  getNetTaxPayable({ startDate, endDate }) {
    const inputTax = this.getInputTax({ startDate, endDate });
    const outputTax = this.getOutputTax({ startDate, endDate });
    
    const totalInput = inputTax.reduce((sum, t) => sum + t.total_tax, 0);
    const totalOutput = outputTax.reduce((sum, t) => sum + t.total_tax, 0);
    
    return {
      input_tax: totalInput,
      output_tax: totalOutput,
      net_payable: totalOutput - totalInput,
      input_count: inputTax.length,
      output_count: outputTax.length,
    };
  }
}