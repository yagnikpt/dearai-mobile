package com.margelo.nitro.camera.facecropper.util

import com.margelo.nitro.core.ArrayBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

internal data class Normalization(
  val redMean: Float = 0f,
  val greenMean: Float = 0f,
  val blueMean: Float = 0f,
  val redStd: Float = 1f,
  val greenStd: Float = 1f,
  val blueStd: Float = 1f,
) {
  init {
    require(redStd > 0f && greenStd > 0f && blueStd > 0f) { "Standard deviations must be positive." }
  }
}

/** Allocates exactly the returned Float32 tensor and provides planar writes. */
internal class PlanarTensorWriter private constructor(
  private val floats: FloatBuffer,
  private val pixels: Int,
  private val normalization: Normalization,
) {
  fun write(pixelIndex: Int, red: Float, green: Float, blue: Float) {
    floats.put(pixelIndex, (red - normalization.redMean) / normalization.redStd)
    floats.put(pixels + pixelIndex, (green - normalization.greenMean) / normalization.greenStd)
    floats.put(pixels * 2 + pixelIndex, (blue - normalization.blueMean) / normalization.blueStd)
  }

  companion object {
    fun allocate(width: Int, height: Int, normalization: Normalization): Pair<ArrayBuffer, PlanarTensorWriter>? {
      val floatCount = width.toLong() * height.toLong() * 3L
      val byteCount = floatCount * Float.SIZE_BYTES
      if (floatCount <= 0L || byteCount > Int.MAX_VALUE) return null

      val buffer = ArrayBuffer.allocate(byteCount.toInt())
      val floats = buffer.getBuffer(false).order(ByteOrder.nativeOrder()).asFloatBuffer()
      return buffer to PlanarTensorWriter(floats, (width.toLong() * height.toLong()).toInt(), normalization)
    }
  }
}
