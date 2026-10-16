/** Indicatifs proposés pour la connexion par SMS (web et mobile). Le serveur normalise le numéro. */
export const PHONE_COUNTRIES = [
  { code: '+228', label: 'TG', name: 'Togo', flag: '🇹🇬' },
  { code: '+225', label: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: '+221', label: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: '+229', label: 'BJ', name: 'Bénin', flag: '🇧🇯' },
  { code: '+237', label: 'CM', name: 'Cameroun', flag: '🇨🇲' },
  { code: '+226', label: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+223', label: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: '+227', label: 'NE', name: 'Niger', flag: '🇳🇪' },
  { code: '+234', label: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+233', label: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: '+243', label: 'CD', name: 'RD Congo', flag: '🇨🇩' },
  { code: '+242', label: 'CG', name: 'Congo', flag: '🇨🇬' },
  { code: '+250', label: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { code: '+254', label: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: '+212', label: 'MA', name: 'Maroc', flag: '🇲🇦' },
  { code: '+216', label: 'TN', name: 'Tunisie', flag: '🇹🇳' },
  { code: '+213', label: 'DZ', name: 'Algérie', flag: '🇩🇿' },
  { code: '+261', label: 'MG', name: 'Madagascar', flag: '🇲🇬' },
  { code: '+33', label: 'FR', name: 'France', flag: '🇫🇷' },
] as const;

/** « +228 » + « 90 12 34 56 » (ou « 090… ») -> « +22890123456 ». */
export function joinPhone(countryCode: string, number: string): string {
  return `${countryCode}${number.replace(/\D/g, '').replace(/^0+/, '')}`;
}
