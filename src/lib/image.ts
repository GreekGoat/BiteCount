/** Shrinks a photo in the browser before it is sent for estimation. */
export async function fileToCompressedBase64(file: File, maxSide = 1280, quality = 0.8): Promise<{ data: string; mediaType: string; preview: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read that image.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { data: dataUrl.split(',')[1] ?? '', mediaType: 'image/jpeg', preview: dataUrl }
}
