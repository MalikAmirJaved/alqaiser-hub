// components/payroll/types.ts

export interface SelectedMonth {
  id?: string;
  month: number;
  year: number;
  deduction?: number;
}

export interface MonthRange {
  id?: string;
  start_month: number;
  start_year: number;
  end_month: number;
  end_year: number;
  deduction?: number;
}

export interface Compensation {
  id: string;
  employee_id: string;
  employee_name?: string;
  basic_salary?: string;
  house_rent_allowance?: number;
  medical_allowance?: number;
  transport_allowance?: number;
  phone_allowance?: number;
  utilities_allowance?: number;
  education_allowance?: number;
  other_allowances?: number;
  employer_pf?: number;
  employer_eobi?: number;
  total_allowances?: string;
  total_monthly?: string;
  overtime_rate?: number;
  bonus_percentage?: number;
  notes?: string;
  status?: string;
  frequency_type: 'ONE_TIME' | 'SELECTED_MONTH' | 'MONTH_RANGE';
  selected_months?: SelectedMonth[];
  month_range?: MonthRange | null;
}

export interface Loan {
  id: string;
  employee_id: string;
  employee_name?: string;
  loan_type: string;
  loan_type_display?: string;
  principal_amount: string;
  interest_rate: number;
  total_payable?: number;
  remaining_amount: string;
  paid_amount?: string;
  paid_months?: number;
  purpose?: string;
  status: 'PENDING' | 'ACTIVE' | 'PAID' | 'CANCELLED';
  monthly_salary?: string;
  frequency_type: 'ONE_TIME' | 'SELECTED_MONTH' | 'MONTH_RANGE';
  selected_months?: SelectedMonth[];
  month_range?: MonthRange | null;
}

export interface LoanFormData {
  employee_id: string;
  loan_type: string;
  principal_amount: number;
  interest_rate: number;
  purpose: string;
  frequency_type: 'ONE_TIME' | 'SELECTED_MONTH' | 'MONTH_RANGE';
  selected_months?: SelectedMonth[];
  month_range?: MonthRange | null;
}

export const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export const FREQUENCY_TYPES = [
  { value: 'ONE_TIME', label: 'One Time' },
  { value: 'SELECTED_MONTH', label: 'Selected Month' },
  { value: 'MONTH_RANGE', label: 'Month Range' },
];

export const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years: Array<{ value: number; label: string }> = [];
  for (let y = currentYear - 5; y <= currentYear + 5; y++) {
    years.push({ value: y, label: String(y) });
  }
  return years;
};

export const getMonthLabel = (month: number) => {
  return MONTHS.find(m => m.value === month)?.label || '';
};

export const getFrequencyLabel = (item: any) => {
  const freqType = item.frequency_type || 'MONTH_RANGE';
  switch (freqType) {
    case 'ONE_TIME':
      if (item.selected_months && item.selected_months.length > 0) {
        const labels = item.selected_months.map((sm: any) => `${getMonthLabel(sm.month)} ${sm.year}`);
        return `One Time - ${labels.join(', ')}`;
      }
      return 'One Time';
    case 'SELECTED_MONTH':
      if (item.selected_months && item.selected_months.length > 0) {
        const labels = item.selected_months.map((sm: any) => `${getMonthLabel(sm.month)} ${sm.year}`);
        return `Selected: ${labels.join(', ')}`;
      }
      return 'Selected Month';
    case 'MONTH_RANGE':
      if (item.month_range) {
        const { start_month, start_year, end_month, end_year } = item.month_range;
        return `Range: ${getMonthLabel(start_month)} ${start_year} - ${getMonthLabel(end_month)} ${end_year}`;
      }
      return 'Month Range';
    default:
      return freqType;
  }
};

export const getFrequencyBadgeColor = (item: any) => {
  const freqType = item.frequency_type || 'MONTH_RANGE';
  switch (freqType) {
    case 'ONE_TIME':
      return 'bg-orange-500/15 text-orange-600 border-orange-500/30';
    case 'SELECTED_MONTH':
      return 'bg-purple-500/15 text-purple-600 border-purple-500/30';
    case 'MONTH_RANGE':
      return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
    default:
      return 'bg-gray-500/15 text-gray-600 border-gray-500/30';
  }
};
