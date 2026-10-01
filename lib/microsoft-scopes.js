export function microsoftScopes(accountType = 'personal') {
  const base = 'offline_access User.Read Files.ReadWrite Calendars.ReadWrite';
  return accountType === 'organization' ? `${base} Team.ReadBasic.All` : base;
}
