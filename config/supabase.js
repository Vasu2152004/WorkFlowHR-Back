const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client with anon key for client-side operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables not found. Supabase functionality will be disabled.');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your environment variables.');
  console.error('Current values:', { 
    SUPABASE_URL: process.env.SUPABASE_URL || 'NOT_SET',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET'
  });
  
  // Export dummy clients that won't crash the app
  module.exports = {
    supabase: {
      auth: { 
        signInWithPassword: () => Promise.resolve({ 
          data: null, 
          error: { message: 'Supabase not configured' } 
        }),
        signUp: () => Promise.resolve({ 
          data: null, 
          error: { message: 'Supabase not configured' } 
        }),
        signOut: () => Promise.resolve({ 
          error: { message: 'Supabase not configured' } 
        })
      },
      from: () => ({ 
        select: () => ({ 
          single: () => Promise.resolve({ 
            data: null, 
            error: { message: 'Supabase not configured' } 
          }),
          eq: () => ({ 
            eq: () => ({ 
              order: () => Promise.resolve({ 
                data: [], 
                error: { message: 'Supabase not configured' } 
              })
            })
          })
        }),
        insert: () => Promise.resolve({ 
          data: null, 
          error: { message: 'Supabase not configured' } 
        }),
        update: () => Promise.resolve({ 
          data: null, 
          error: { message: 'Supabase not configured' } 
        })
      })
    },
    supabaseAdmin: {
      auth: { 
        admin: { 
          createUser: () => Promise.resolve({ 
            data: null, 
            error: { message: 'Supabase not configured' } 
          }) 
        } 
      },
      from: () => ({ 
        select: () => ({ 
          single: () => Promise.resolve({ 
            data: null, 
            error: { message: 'Supabase not configured' } 
          }),
          limit: () => Promise.resolve({ 
            data: null, 
            error: { message: 'Supabase not configured' } 
          })
        }),
        insert: () => Promise.resolve({ 
          data: null, 
          error: { message: 'Supabase not configured' } 
        })
      })
    }
  };
  return;
}

// Create Supabase client with retry options and timeout
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'X-Client-Info': 'workflowhr-backend'
    }
  }
});

// Create Supabase client with service role key for admin operations
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'X-Client-Info': 'workflowhr-backend-admin'
    }
  }
});

module.exports = {
  supabase,
  supabaseAdmin
}; 