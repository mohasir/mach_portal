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

/** Renders a stored phone number using the same country mask as `PhoneInput`, e.g. "+1 (131) 321-3123". */
export function FormattedPhone({ value }: FormattedPhoneProps) {
  const { inputValue } = usePhoneInput({
    defaultCountry: 'us',
    value: value ?? '',
    countries: US_COUNTRIES,
    forceDialCode: true,
  });

  return value ? <>{inputValue}</> : null;
}

export function PhoneInput({ value, onChange, disabled, placeholder }: PhoneInputProps) {
  const { inputValue, country, handlePhoneValueChange } = usePhoneInput({
    defaultCountry: 'us',
    value,
    countries: US_COUNTRIES,
    forceDialCode: true,
    onChange: (data) => onChange?.(data.phone),
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
