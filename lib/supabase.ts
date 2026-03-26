import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wkvvmuoohudxgfzfvdvl.supabase.co";
const supabaseAnonKey = "sb_publishable_gQ3v_8nV5ydwOH4l6c-80A_r4YnzVyR";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);