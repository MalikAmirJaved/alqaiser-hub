
"use client";

// ============================================
// FILE: src/components/reuseable/LocationSelectors.jsx
// ============================================

import { useEffect, useState } from "react";
import { 
  Country, 
  State, 
  City 
} from "country-state-city";
import SearchableSelect from "./SearchableSelect";

/**
 * Country Selector Component
 * Usage: <CountrySelect value={country} onChange={setCountry} />
 */
export function CountrySelect({ value, onChange, required = false, className = "", placeholder = "Select Country" }) {
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    const allCountries = Country.getAllCountries();
    setCountries(allCountries.map(c => ({ value: c.isoCode, label: `${c.flag} ${c.name}` })));
  }, []);

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={countries}
      required={required}
      className={className}
      placeholder={placeholder}
    />
  );
}


/**
 * State/Region Selector Component (depends on selected country)
 * Usage: <StateSelect countryCode={country} value={state} onChange={setState} />
 */
export function StateSelect({ countryCode, value, onChange, required = false, className = "", placeholder = "Select State/Region" }) {
  const [states, setStates] = useState([]);

  useEffect(() => {
    if (countryCode) {
      const statesOfCountry = State.getStatesOfCountry(countryCode);
      setStates(statesOfCountry.map(s => ({ value: s.isoCode, label: s.name })));
    } else {
      setStates([]);
    }
  }, [countryCode]);

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={states}
      required={required}
      disabled={!countryCode}
      className={className}
      placeholder={placeholder}
    />
  );
}


/**
 * City Selector Component (depends on selected country and state)
 * Usage: <CitySelect countryCode={country} stateCode={state} value={city} onChange={setCity} />
 */
export function CitySelect({ countryCode, stateCode, value, onChange, required = false, className = "", placeholder = "Select City" }) {
  const [cities, setCities] = useState([]);

  useEffect(() => {
    if (countryCode && stateCode) {
      const citiesOfState = City.getCitiesOfState(countryCode, stateCode);
      setCities(citiesOfState.map(c => ({ value: c.name, label: c.name })));
    } else {
      setCities([]);
    }
  }, [countryCode, stateCode]);

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={cities}
      required={required}
      disabled={!countryCode || !stateCode}
      className={className}
      placeholder={placeholder}
    />
  );
}

/**
 * Complete Location Selector Group (Country + State + City)
 * Usage: <LocationGroup country={country} setCountry={setCountry} state={state} setState={setState} city={city} setCity={setCity} />
 */
export function LocationGroup({ 
  country, 
  setCountry, 
  state, 
  setState, 
  city, 
  setCity,
  required = false,
  countryLabel = "Country",
  stateLabel = "State/Region",
  cityLabel = "City",
  className = "",
  cssCol="2"
}) {
const handleCountryChange = (newCountry) => {
  if (newCountry !== country) {
    setCountry(newCountry);
    setState("");
    setCity("");
  }
};

const handleStateChange = (newState) => {
  if (newState !== state) {
    setState(newState);
    setCity("");
  }
};

  const inputClassName = className || " ";

  return (
    <div className={`gap-3 grid grid-cols-${cssCol} `}>
      <div>
        <span className="text-muted-foreground text-xs">{countryLabel} {required && <span className="text-destructive">*</span>}</span>
        <CountrySelect 
          value={country} 
          onChange={handleCountryChange} 
          required={required}
          className={inputClassName}
        />
      </div>

      <div>
        <span className="text-muted-foreground text-xs">{stateLabel}</span>
        <StateSelect 
          countryCode={country} 
          value={state} 
          onChange={handleStateChange}
          className={inputClassName}
        />
      </div>

      <div>
        <span className="text-muted-foreground text-xs">{cityLabel}</span>
        <CitySelect 
          countryCode={country} 
          stateCode={state} 
          value={city} 
          onChange={setCity}
          className={inputClassName}
        />
      </div>
    </div>
  );
}


/**
 * Simple Address Form with Location Selectors
 * Complete address component with all location fields
 */
export function AddressForm({ 
  addressData, 
  setAddressData,
  required = false,
  showAddressLine = true,
  showPostalCode = true,
  className = "",
}) {
  const inputClassName = className || "bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring";
  const textareaClassName = className || "bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-3">
      {showAddressLine && (
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Address Line {required && <span className="text-destructive">*</span>}</span>
          <textarea
            value={addressData.address_line || ""}
            onChange={(e) => setAddressData({ ...addressData, address_line: e.target.value })}
            rows={2}
            required={required}
            className={textareaClassName}
            placeholder="Street address, building, apartment"
          />
        </label>
      )}

      <LocationGroup
        country={addressData.country}
        setCountry={(val) => setAddressData({ ...addressData, country: val })}
        state={addressData.state}
        setState={(val) => setAddressData({ ...addressData, state: val })}
        city={addressData.city}
        setCity={(val) => setAddressData({ ...addressData, city: val })}
        required={required}
      />

      {showPostalCode && (
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Postal/ZIP Code</span>
          <input
            type="text"
            value={addressData.postal_code || ""}
            onChange={(e) => setAddressData({ ...addressData, postal_code: e.target.value })}
            className={inputClassName}
            placeholder="e.g., 12345"
          />
        </label>
      )}
    </div>
  );
}
