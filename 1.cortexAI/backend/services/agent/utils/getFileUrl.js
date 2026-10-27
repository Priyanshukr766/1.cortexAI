import supabase from "../config/supabase.js"

export const getFileUrl = async (filename, expiresIn = 600) => {
    const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .createSignedUrl(filename, expiresIn)

    if (error) throw error
    return data.signedUrl
}
