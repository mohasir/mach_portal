export interface QuotePdfEventInfo {
  date?: string;
  type?: string;
  time?: string;
  location?: string;
}

export interface QuotePdfDetailBlock {
  title: string;
  options: string[];
}

export interface QuotePdfServiceInfo {
  label: string;
  duration: string;
}

export interface QuotePdfItem {
  sku?: string;
  description: string;
  quantity: number;
  total: number;
  details?: QuotePdfDetailBlock[];
}

export interface QuotePdfFee {
  description: string;
  amount: number;
}

export interface QuotePdfRequest {
  template: 'mach_quote';
  document_number: string;
  client_name: string;
  event?: QuotePdfEventInfo;
  services?: QuotePdfServiceInfo[];
  items: QuotePdfItem[];
  fees?: QuotePdfFee[];
  deposit?: number;
  terms_and_conditions?: string[];
  validity_note?: string;
  dietary_note?: string;
}

export interface QuotePdfResponse {
  url: string;
  key: string;
}
