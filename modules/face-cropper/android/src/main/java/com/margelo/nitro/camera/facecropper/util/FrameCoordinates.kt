package com.margelo.nitro.camera.facecropper.util

/**
 * Converts coordinates in ML Kit's rotation-corrected image into coordinates
 * of CameraX's physical YUV buffer. CameraX keeps the buffer unrotated and
 * supplies rotation as metadata; ML Kit applies that metadata before returning
 * its face bounds.
 */
internal class FrameCoordinates(
  private val bufferWidth: Int,
  private val bufferHeight: Int,
  rotationDegrees: Int,
) {
  private val rotation = ((rotationDegrees % 360) + 360) % 360

  val orientedWidth: Int
    get() = if (rotation == 90 || rotation == 270) bufferHeight else bufferWidth

  val orientedHeight: Int
    get() = if (rotation == 90 || rotation == 270) bufferWidth else bufferHeight

  fun toBuffer(x: Float, y: Float): SourcePoint {
    return when (rotation) {
      0 -> SourcePoint(x, y)
      // InputImage rotation is clockwise. These are the inverse transforms,
      // mapping an upright ML Kit coordinate back into the raw ImageProxy.
      90 -> SourcePoint(y, bufferHeight - 1f - x)
      180 -> SourcePoint(bufferWidth - 1f - x, bufferHeight - 1f - y)
      270 -> SourcePoint(bufferWidth - 1f - y, x)
      else -> throw IllegalArgumentException("Unsupported CameraX rotation: $rotation degrees")
    }
  }
}

internal data class SourcePoint(val x: Float, val y: Float)
