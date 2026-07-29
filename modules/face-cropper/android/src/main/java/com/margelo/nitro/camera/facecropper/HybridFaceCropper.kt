package com.margelo.nitro.camera.facecropper

import android.graphics.ImageFormat
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.facecropper.conversion.YuvConverter
import com.margelo.nitro.camera.facecropper.resize.BilinearResizer
import com.margelo.nitro.camera.facecropper.util.Normalization
import com.margelo.nitro.camera.facecropper.util.PlanarTensorWriter
import com.margelo.nitro.camera.facecropper.util.FrameCoordinates
import com.margelo.nitro.camera.facecropper.util.Roi
import com.margelo.nitro.camera.public.NativeFrame

@Keep
@DoNotStrip
class HybridFaceCropper : HybridFaceCropperSpec() {
  override fun cropFace(
    frame: HybridFrameSpec,
    x: Double,
    y: Double,
    width: Double,
    height: Double,
    targetWidth: Double,
    targetHeight: Double,
  ): FaceTensor? {
    return try {
      val nativeFrame = frame as? NativeFrame ?: return null
      val image = nativeFrame.image
      if (image.format != ImageFormat.YUV_420_888 || image.planes.size != 3) return null

      val outputWidth = targetWidth.toInt()
      val outputHeight = targetHeight.toInt()
      if (targetWidth != outputWidth.toDouble() || targetHeight != outputHeight.toDouble()) return null
      if (outputWidth <= 0 || outputHeight <= 0) return null

      // FaceDetector gives ML Kit's rotation-corrected bounds. ImageProxy's
      // planes remain in the sensor's native orientation, so map each sample
      // back into those planes instead of rotating a whole image.
      val coordinates = FrameCoordinates(image.width, image.height, image.imageInfo.rotationDegrees)
      val roi = Roi.clamp(x, y, width, height, coordinates.orientedWidth, coordinates.orientedHeight) ?: return null
      val allocated = PlanarTensorWriter.allocate(outputWidth, outputHeight, DEFAULT_NORMALIZATION) ?: return null
      val converter = YuvConverter(image)
      BilinearResizer.forEachPixel(roi, outputWidth, outputHeight) { pixelIndex, sourceX, sourceY ->
        val bufferPoint = coordinates.toBuffer(sourceX, sourceY)
        converter.writeRgb(pixelIndex, bufferPoint.x, bufferPoint.y, allocated.second)
      }
      FaceTensor(outputWidth.toDouble(), outputHeight.toDouble(), allocated.first)
    } catch (_: Throwable) {
      // A disposed frame or malformed vendor buffer is an expected dropped-frame condition.
      null
    }
  }

  companion object {
    private val DEFAULT_NORMALIZATION = Normalization()
  }
}
