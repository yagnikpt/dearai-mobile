import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'

/** A CPU-owned, planar Float32 RGB tensor. */
export interface FaceTensor {
  width: number
  height: number
  /**
   * Float32 data in native byte order: all R pixels, then all G pixels, then
   * all B pixels. Its byte length is `width * height * 3 * 4`.
   */
  data: ArrayBuffer
}

/** Android-only CPU frame processor for face crops from YUV_420_888 Frames. */
export interface FaceCropper
  extends HybridObject<{ android: 'kotlin' }> {
  /**
   * Crops a frame-space face rectangle, bilinearly resizes it, and returns a
   * normalized planar RGB Float32 tensor. Returns undefined for invalid input.
   * The caller retains ownership of, and must dispose, `frame`.
   */
  cropFace(
    frame: Frame,
    x: number,
    y: number,
    width: number,
    height: number,
    targetWidth: number,
    targetHeight: number,
  ): FaceTensor | undefined
}
