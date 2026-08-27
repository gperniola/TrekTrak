import '@testing-library/jest-dom';

/**
 * I matcher di jest-dom vengono registrati dall'import qui sopra, ma i suoi TIPI no —
 * non per i file di test di questo repo. `@testing-library/jest-dom` augmenta il
 * namespace globale `jest`, mentre 53 dei nostri file importano `expect` da
 * `@jest/globals`: quell'`expect` è `@jest/expect`, un'interfaccia diversa, che
 * l'augmentation globale non tocca.
 *
 * Il risultato era che `toBeInTheDocument` e `toBeDisabled` risultavano inesistenti
 * appena si type-checkavano i test (90 errori su 143 in `npm run typecheck:tests`).
 * `import type {}` applica l'augmentation del sottopath e viene eliminato a runtime,
 * dove i matcher sono già a posto.
 */
import type {} from '@testing-library/jest-dom/jest-globals';
