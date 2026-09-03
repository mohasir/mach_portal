'use client';
import { Input, Space } from 'antd';
import {
  CountrySelector,
  defaultCountries,
  parseCountry,
  usePhoneInput,
} from 'react-international-phone';
import 'react-international-phone/style.css';

const US_COUNTRIES = defaultCountries.filter((country) => parseCountry(country).iso2 === 'us');

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

interface FormattedPhoneProps {
  value?: string | null;
}

// `forceDialCode` always renders "+1" even with no digits entered — a phone whose only
// digits are the dial code itself has nothing else to show, so treat it as empty.
const isDialCodeOnly = (phone: string, dialCode: string) => phone.replace(/\D/g, '') === dialCode;

/** Renders a stored phone number using the same country mask as `PhoneInput`, e.g. "+1 (131) 321-3123". */
export function FormattedPhone({ value }: FormattedPhoneProps) {
  const { inputValue, country } = usePhoneInput({
    defaultCountry: 'us',
    value: value ?? '',
    countries: US_COUNTRIES,
    forceDialCode: true,
  });

  if (!value || isDialCodeOnly(value, country.dialCode)) return null;
  return <>{inputValue}</>;
}

export function PhoneInput({ value, onChange, disabled, placeholder }: PhoneInputProps) {
  const { inputValue, country, handlePhoneValueChange } = usePhoneInput({
    defaultCountry: 'us',
    value,
    countries: US_COUNTRIES,
    forceDialCode: true,
    // Fires once on mount even without user input (forceDialCode always computes at least
    // "+1") — collapse that no-op case to '' so it doesn't get saved as a real phone number.
    onChange: (data) =>
      onChange?.(isDialCodeOnly(data.phone, data.country.dialCode) ? '' : data.phone),
  });

  return (
    <Space.Compact className="w-full">
      <Space.Addon>
        <CountrySelector
          selectedCountry={country.iso2}
          countries={US_COUNTRIES}
          hideDropdown
          disabled={disabled}
          buttonStyle={{ border: 'none', background: 'transparent', padding: 0, cursor: 'default' }}
        />
      </Space.Addon>
      <Input
        className="flex-1"
        value={inputValue}
        onChange={handlePhoneValueChange}
        disabled={disabled}
        placeholder={placeholder}
      />
    </Space.Compact>
  );
}
