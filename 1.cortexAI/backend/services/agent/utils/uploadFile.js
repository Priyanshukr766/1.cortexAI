import supabase from "../config/supabase.js"

export const uploadFile = async (filename, buffer, contentType) => {
    const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(filename, buffer, {
            contentType,
            upsert: true
        })

    if (error) throw error
    return filename
}
