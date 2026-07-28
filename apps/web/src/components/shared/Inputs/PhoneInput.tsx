'use client';
import { Input, Space } from 'antd';
import { CountrySelector, defaultCountries, usePhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PhoneInput({ value, onChange, disabled, placeholder }: PhoneInputProps) {
  const { inputValue, country, setCountry, handlePhoneValueChange } = usePhoneInput({
    defaultCountry: 'us',
    value,
    countries: defaultCountries,
    onChange: (data) => onChange?.(data.phone),
  });

  return (
    <Space.Compact className="w-full">
      <Space.Addon>
        <CountrySelector
          selectedCountry={country.iso2}
          onSelect={(c) => setCountry(c.iso2)}
          disabled={disabled}
          buttonStyle={{ border: 'none', background: 'transparent', padding: 0 }}
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
