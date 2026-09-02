// Phone display formatting for the packing slip (Sherlyn, 2026-09-02):
// "608 988-4079" is easier for volunteers to remember while dialing.
// Applicants type phones every which way, so normalize only the recognizable
// shapes (10 digits, 1+10 digits, 7 digits) and return anything else exactly
// as typed — never mangle their input.
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const rest = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (rest.length === 10 && (digits.length === 10 || digits.length === 11)) {
    return `${rest.slice(0, 3)} ${rest.slice(3, 6)}-${rest.slice(6)}`;
  }
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return raw.trim();
}
