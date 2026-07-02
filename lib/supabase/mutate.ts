/**
 * Mutation client for Supabase INSERT / UPDATE / DELETE operations.
 *
 * postgrest-js v2 resolves mutation payload types to `never` for tables that
 * have FK relationships defined in the Database schema, making it impossible
 * to call .insert() / .update() with a properly typed payload without a cast.
 *
 * This helper returns the browser client cast to `any` so that:
 *   - Mutation code remains readable and structurally correct
 *   - The workaround is isolated to a single place
 *   - SELECT queries (via the normal createClient()) stay fully typed
 *   - Easy to remove when postgrest-js fixes payload type inference
 *
 * Usage: const db = mutationClient()
 *        await db.from('issues').update({ status: 'open' }).eq('id', id)
 */

import { createClient } from './client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mutationClient(): any {
  return createClient()
}
