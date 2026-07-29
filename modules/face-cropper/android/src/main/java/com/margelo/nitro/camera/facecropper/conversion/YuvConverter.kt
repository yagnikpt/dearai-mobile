package com.margelo.nitro.camera.facecropper.conversion

import androidx.camera.core.ImageProxy
import com.margelo.nitro.camera.facecropper.util.PlanarTensorWriter
import java.nio.ByteBuffer
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** Reads YUV_420_888 planes with their actual strides and writes normalized RGB directly. */
internal class YuvConverter(image: ImageProxy) {
  private val yPlane = image.planes[0]
  // VisionCamera's Android YUV stream exposes the chroma buffers as V then U
  // on the target CameraX pipeline. Reading them as U then V produces the
  // characteristic blue/orange tint visible in the tensor preview.
  private val vPlane = image.planes[1]
  private val uPlane = image.planes[2]
  private val yBuffer = yPlane.buffer.duplicate()
  private val uBuffer = uPlane.buffer.duplicate()
  private val vBuffer = vPlane.buffer.duplicate()
  private val imageWidth = image.width
  private val imageHeight = image.height

  fun writeRgb(pixelIndex: Int, sourceX: Float, sourceY: Float, output: PlanarTensorWriter) {
    val y = sample(yBuffer, yPlane.rowStride, yPlane.pixelStride, imageWidth, imageHeight, sourceX, sourceY)
    // Chroma planes are half resolution. Sampling them bilinearly avoids blocky chroma edges.
    val u = sample(uBuffer, uPlane.rowStride, uPlane.pixelStride, (imageWidth + 1) / 2, (imageHeight + 1) / 2, sourceX * 0.5f, sourceY * 0.5f)
    val v = sample(vBuffer, vPlane.rowStride, vPlane.pixelStride, (imageWidth + 1) / 2, (imageHeight + 1) / 2, sourceX * 0.5f, sourceY * 0.5f)

    // Camera YUV_420_888 is conventionally limited-range Y'CbCr. Convert once and
    // normalize in this pass; no interleaved RGB buffer is ever materialized.
    val luma = 1.1643836f * (y - 16f)
    val chromaU = u - 128f
    val chromaV = v - 128f
    output.write(
      pixelIndex,
      clamp01((luma + 1.5960268f * chromaV) / 255f),
      clamp01((luma - 0.3917623f * chromaU - 0.8129676f * chromaV) / 255f),
      clamp01((luma + 2.0172321f * chromaU) / 255f),
    )
  }

  private fun sample(
    buffer: ByteBuffer,
    rowStride: Int,
    pixelStride: Int,
    width: Int,
    height: Int,
    x: Float,
    y: Float,
  ): Float {
    val x0 = floor(x).toInt().coerceIn(0, width - 1)
    val y0 = floor(y).toInt().coerceIn(0, height - 1)
    val x1 = min(x0 + 1, width - 1)
    val y1 = min(y0 + 1, height - 1)
    val xFraction = x - floor(x)
    val yFraction = y - floor(y)
    val topLeft = valueAt(buffer, rowStride, pixelStride, x0, y0)
    val topRight = valueAt(buffer, rowStride, pixelStride, x1, y0)
    val bottomLeft = valueAt(buffer, rowStride, pixelStride, x0, y1)
    val bottomRight = valueAt(buffer, rowStride, pixelStride, x1, y1)
    val top = topLeft + (topRight - topLeft) * xFraction
    val bottom = bottomLeft + (bottomRight - bottomLeft) * xFraction
    return top + (bottom - top) * yFraction
  }

  private fun valueAt(buffer: ByteBuffer, rowStride: Int, pixelStride: Int, x: Int, y: Int): Float {
    val offset = buffer.position() + y * rowStride + x * pixelStride
    if (offset < buffer.position() || offset >= buffer.limit()) throw IllegalArgumentException("YUV plane index is outside its buffer.")
    return (buffer.get(offset).toInt() and 0xFF).toFloat()
  }

  private fun clamp01(value: Float): Float = min(1f, max(0f, value))
}
