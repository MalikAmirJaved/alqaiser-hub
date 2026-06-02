"use client";

// ============================================
// FILE: src/components/reuseable/CurrencySelect.jsx
// ============================================

import { useEffect, useMemo, useState } from "react";
import currencyCodes from "currency-codes";
import SearchableSelect from "./SearchableSelect";

/**
 * CurrencySelect
 * Reusable searchable currency dropdown
 *
 * Props:
 * - value: string (e.g. "USD")
 * - onChange: function(code)
 * - required?: boolean
 * - className?: string
 * - placeholder?: string
 */
export default function CurrencySelect({
  value,
  onChange,
  required = false,
  className = "",
  placeholder = "Select currency...",
}) {
  const [options, setOptions] = useState([]);

  // Build currency list once
  useEffect(() => {
    const list = currencyCodes.data.map((c) => ({
      value: c.code,
      label: `${c.code} — ${c.currency} (${c.code})`,
    }));

    setOptions(list);
  }, []);

  const selected = useMemo(() => {
    return options.find((o) => o.value === value)?.value || "";
  }, [value, options]);

  return (
    <SearchableSelect
      value={selected}
      onChange={onChange}
      options={options}
      required={required}
      placeholder={placeholder}
      className={className}
    />
  );
}