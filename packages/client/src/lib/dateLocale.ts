import { es, enUS } from 'date-fns/locale'
import type { Locale } from 'date-fns'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// date-fns' `es` locale lowercases month/weekday names (grammatically correct
// Spanish — "julio", "martes"), but our UI capitalizes them everywhere
// regardless of language, to match the English headers ("July", "Tuesday").
// Wrapping localize.month/day here fixes it at the source for every `format()`
// call site, instead of patching each formatted string after the fact (which
// breaks for patterns where the month/day isn't the first word, e.g. "d MMMM").
const esCapitalized: Locale = {
  ...es,
  localize: {
    ...es.localize,
    month: (n, options) => capitalize(es.localize.month(n, options)),
    day: (n, options) => capitalize(es.localize.day(n, options)),
  },
}

export function getDateLocale(language: string): Locale {
  return language === 'es' ? esCapitalized : enUS
}
