import { jest } from '@jest/globals';

/**
 * `jest.fn()` senza generici ha tipo `(...args: unknown[]) => unknown`: il valore di
 * ritorno non è una promessa, quindi il parametro di `mockResolvedValue` collassa a
 * `never` e non accetta più nulla. È la causa di gran parte degli errori che
 * `npm run typecheck:tests` fa emergere sui mock di Supabase.
 *
 * Questo helper dichiara la sola cosa che al test serve davvero — che la funzione è
 * asincrona — e lascia il valore risolto a `unknown`, che è esattamente quanto il
 * test sa della risposta del servizio. Dove invece contano gli argomenti (perché il
 * test li asserisce con `toHaveBeenCalledWith`) va dichiarata la firma per esteso:
 * un mock a zero parametri rende quell'asserzione un errore di tipo, ed è giusto così.
 */
export const asyncMock = <T = unknown>() => jest.fn<(...args: unknown[]) => Promise<T>>();
