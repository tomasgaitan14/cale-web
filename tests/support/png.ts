// Lectura de PNG para los tests: el encabezado (IHDR) sin decodificar la imagen, y la comparación de dos imágenes.
import sharp from 'sharp';

const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;
const PNG_COLOR_TYPE_OFFSET = 25;

// Tipo de color 2 = RGB sin canal alfa
export const PNG_COLOR_TYPE_RGB = 2;

export function pngInfo(png: Buffer): { width: number; height: number; colorType: number } {
  return {
    width: png.readUInt32BE(PNG_WIDTH_OFFSET),
    height: png.readUInt32BE(PNG_HEIGHT_OFFSET),
    colorType: png[PNG_COLOR_TYPE_OFFSET]!,
  };
}

// Comparar un PNG guardado con el que sale hoy del código: el suavizado de bordes puede variar entre máquinas, así que
// se cuenta la fracción de píxeles que difieren más de 32 (de 255) en algún canal, y el test tolera una mínima
const RGB_CHANNELS = 3;
const CHANNEL_TOLERANCE = 32;

export async function differentPixelRatio(saved: Buffer, current: Buffer): Promise<number> {
  const [a, b] = await Promise.all([saved, current].map((png) => sharp(png).removeAlpha().raw().toBuffer()));
  if (a!.length !== b!.length) return 1;
  let different = 0;
  for (let index = 0; index < a!.length; index += RGB_CHANNELS) {
    const channelDifferences = [0, 1, 2].map((channel) => Math.abs(a![index + channel]! - b![index + channel]!));
    if (Math.max(...channelDifferences) > CHANNEL_TOLERANCE) different += 1;
  }
  return different / (a!.length / RGB_CHANNELS);
}
