import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://itqlxsbmdntmgfchxbuj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWx4c2JtZG50bWdmY2h4YnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTM3OTYsImV4cCI6MjA4NjQ4OTc5Nn0.qlDtDuHEZ5lJfnSEMoU1weNhcvXE_6wYHxk5Wo-7o8E'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
