// ============================================
// FILE: src/components/LocationSelectors.jsx
// ============================================

import { useEffect, useState } from "react";
import { 
  Country, 
  State, 
  City 
} from "country-state-city";

/**
 * Country Selector Component
 * Usage: <CountrySelect value={country} onChange={setCountry} />
 */
export function CountrySelect({ value, onChange, required = false, className = "", placeholder = "Select Country" }) {
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    const allCountries = Country.getAllCountries();
    setCountries(allCountries);
  }, []);

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={className || "bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"}
    >
      <option value="">— {placeholder} —</option>
      {countries.map((country) => (
        <option key={country.isoCode} value={country.isoCode}>
          {country.flag} {country.name}
        </option>
      ))}
    </select>
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
      setStates(statesOfCountry);
    } else {
      setStates([]);
    }
  }, [countryCode]);

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={!countryCode}
      className={className || "bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"}
    >
      <option value="">— {placeholder} —</option>
      {states.map((state) => (
        <option key={state.isoCode || state.name} value={state.isoCode || state.name}>
          {state.name}
        </option>
      ))}
    </select>
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
      setCities(citiesOfState);
    } else {
      setCities([]);
    }
  }, [countryCode, stateCode]);

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={!countryCode || !stateCode}
      className={className || "bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"}
    >
      <option value="">— {placeholder} —</option>
      {cities.map((city) => (
        <option key={city.name} value={city.name}>
          {city.name}
        </option>
      ))}
    </select>
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
}) {
  // Reset state when country changes
  const handleCountryChange = (newCountry) => {
    setCountry(newCountry);
    setState(""); // Reset state
    setCity(""); // Reset city
  };

  // Reset city when state changes
  const handleStateChange = (newState) => {
    setState(newState);
    setCity(""); // Reset city
  };

  const inputClassName = className || "bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-3">
      <label className="text-sm flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{countryLabel} {required && <span className="text-destructive">*</span>}</span>
        <CountrySelect 
          value={country} 
          onChange={handleCountryChange} 
          required={required}
          className={inputClassName}
        />
      </label>

      <label className="text-sm flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{stateLabel}</span>
        <StateSelect 
          countryCode={country} 
          value={state} 
          onChange={handleStateChange}
          className={inputClassName}
        />
      </label>

      <label className="text-sm flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{cityLabel}</span>
        <CitySelect 
          countryCode={country} 
          stateCode={state} 
          value={city} 
          onChange={setCity}
          className={inputClassName}
        />
      </label>
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