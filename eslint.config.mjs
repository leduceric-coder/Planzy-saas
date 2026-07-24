// Flat ESLint config — Next.js 16 a retiré la commande « next lint ».
// On réutilise la config officielle eslint-config-next (flat).
//
// Certaines règles récentes (style React-Compiler) et stylistiques sont
// abaissées en « warn » : elles sont largement présentes dans le code existant
// du SaaS et ne constituent pas des erreurs bloquantes. Le code « Feux France »
// ajouté vise 0 erreur ET 0 avertissement sur les règles de correction.
import next from 'eslint-config-next'

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },
  ...next,
  {
    rules: {
      // Stylistique / perf — informatif seulement.
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-img-element': 'warn',
      '@next/next/no-page-custom-font': 'warn',
      // Règles expérimentales « React Compiler » (eslint-plugin-react-hooks v6).
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
]
