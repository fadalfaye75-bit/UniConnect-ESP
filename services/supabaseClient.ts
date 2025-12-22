
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://nbeevahhwvmrunmnyzak.supabase.co';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZWV2YWhod3ZtcnVubW55emFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNTEwMzIsImV4cCI6MjA4MTkyNzAzMn0.2MQjNubKsDqlnbaIQeboMpATwCjJUGuJem_In1TmNbI';

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase configuration missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
