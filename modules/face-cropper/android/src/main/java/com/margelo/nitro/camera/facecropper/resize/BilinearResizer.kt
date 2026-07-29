package com.margelo.nitro.camera.facecropper.resize

import com.margelo.nitro.camera.facecropper.util.Roi
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** Maps target pixel centers to bilinear coordinates in a cropped source ROI. */
internal object BilinearResizer {
  inline fun forEachPixel(
    roi: Roi,
    targetWidth: Int,
    targetHeight: Int,
    block: (pixelIndex: Int, sourceX: Float, sourceY: Float) -> Unit,
  ) {
    val scaleX = roi.width.toFloat() / targetWidth.toFloat()
    val scaleY = roi.height.toFloat() / targetHeight.toFloat()
    val maxX = (roi.right - 1).toFloat()
    val maxY = (roi.bottom - 1).toFloat()
    var pixelIndex = 0

    for (targetY in 0 until targetHeight) {
      val sourceY = min(maxY, max(roi.top.toFloat(), roi.top + (targetY + 0.5f) * scaleY - 0.5f))
      for (targetX in 0 until targetWidth) {
        val sourceX = min(maxX, max(roi.left.toFloat(), roi.left + (targetX + 0.5f) * scaleX - 0.5f))
        block(pixelIndex, sourceX, sourceY)
        pixelIndex += 1
      }
    }
  }
}
