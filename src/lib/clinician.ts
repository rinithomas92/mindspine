export function clinicianLabel(specialty?: string) {
  return specialty === 'psychologist' ? 'Psychologist' : specialty === 'physiotherapist' ? 'Physiotherapist' : 'Care team';
}
