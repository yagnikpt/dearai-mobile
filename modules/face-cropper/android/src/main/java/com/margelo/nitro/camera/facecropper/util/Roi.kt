package com.margelo.nitro.camera.facecropper.util

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** An integer, half-open rectangle in frame pixels. */
internal data class Roi(
  val left: Int,
  val top: Int,
  val right: Int,
  val bottom: Int,
) {
  val width: Int get() = right - left
  val height: Int get() = bottom - top

  companion object {
    /**
     * Intersects a floating-point face box with the image. `right` and `bottom`
     * are exclusive so the resulting rectangle works naturally with sampling.
     */
    fun clamp(
      x: Double,
      y: Double,
      width: Double,
      height: Double,
      imageWidth: Int,
      imageHeight: Int,
    ): Roi? {
      if (!x.isFinite() || !y.isFinite() || !width.isFinite() || !height.isFinite()) return null
      if (width <= 0.0 || height <= 0.0 || imageWidth <= 0 || imageHeight <= 0) return null

      val left = max(0, floor(x).toInt())
      val top = max(0, floor(y).toInt())
      val right = min(imageWidth, ceil(x + width).toInt())
      val bottom = min(imageHeight, ceil(y + height).toInt())
      if (left >= right || top >= bottom) return null
      return Roi(left, top, right, bottom)
    }
  }
}
