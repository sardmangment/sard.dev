// Service catalogue grouped by the four approved value pillars (C-E01/E02/E03, D-40).
// Text lives in the locale files under services.items.<id> and services.pillars.<pillar>.
export const PILLARS = ['connect', 'grow', 'control', 'intelligence'];

export const SERVICES = [
  { id: 'businessSystems', pillar: 'connect' },
  { id: 'smartCloud', pillar: 'connect' },
  { id: 'posOmnichannel', pillar: 'connect' },
  { id: 'webCommerce', pillar: 'grow' },
  { id: 'businessAcceleration', pillar: 'grow' },
  { id: 'customApps', pillar: 'grow' },
  { id: 'governanceConsulting', pillar: 'control' },
  { id: 'dataProtection', pillar: 'control' },
  { id: 'onboardingSupport', pillar: 'control' },
  { id: 'processAutomation', pillar: 'intelligence' },
  { id: 'dataIntelligence', pillar: 'intelligence' },
  { id: 'dailyTaskAssistant', pillar: 'intelligence' },
];

export const VALUE_KEYS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'];
