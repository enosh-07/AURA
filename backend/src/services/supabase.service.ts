/**
 * Server-Side Supabase Service
 *
 * Utilizes the privileged SUPABASE_SERVICE_ROLE_KEY for administrative operations,
 * background database synchronization, and user identity management.
 *
 * SECURITY: SUPABASE_SERVICE_ROLE_KEY is strictly server-side and never exposed to clients.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../config/env.js';

class SupabaseServerService {
  private client: SupabaseClient | null = null;
  public readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = Boolean(
      ENV.SUPABASE_URL &&
      !ENV.SUPABASE_URL.includes('your-project-id') &&
      (ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY)
    );

    if (this.isConfigured) {
      const key = ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY;
      this.client = createClient(ENV.SUPABASE_URL, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }

  public getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase server client is not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }
    return this.client;
  }

  /**
   * Verifies a Supabase JWT token received from client Authorization header
   */
  public async verifyToken(token: string) {
    if (!this.client) return null;
    try {
      const { data: { user }, error } = await this.client.auth.getUser(token);
      if (error || !user) return null;
      return user;
    } catch {
      return null;
    }
  }

  /**
   * Fetches public profile with fallback
   */
  public async getProfile(userId: string) {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('profiles')
      .select('*, user_preferences(*)')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data;
  }
}

export const supabaseServer = new SupabaseServerService();
