import { supabase } from './supabase'

const BUCKET = 'question-images'

export async function uploadImage(file, path) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return urlData.publicUrl
}

export async function deleteImage(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
