export interface Settings {
  pinataApiKey?: string;
  pinataApiSecret?: string;
}

export interface PageAttributes {
  title: string;
  url: string;
  preview: string;
  contractAddress?: string;
}
