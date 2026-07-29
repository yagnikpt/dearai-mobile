# VisionCamera Face Cropper (Android)

`faceCropper.cropFace()` accepts a VisionCamera V5 `Frame` and a bounding box in
the Frame's pixel coordinate system. Configure the frame output with
`pixelFormat: 'yuv'`; private/GPU-only and RGB buffers are deliberately rejected.

The application links this local package through the root `package.json`. Run
`bun install`, then rebuild Android so React Native autolinking loads
`VisionCameraFaceCropperPackage`. Use it from the Frame Output worklet:

```ts
try {
  const tensor = faceCropper.cropFace(frame, x, y, width, height, 112, 112)
  // tensor?.data is a Float32 ArrayBuffer with planar RGB values.
} finally {
  frame.dispose()
}
```

The Android `ImageProxy` exposes YUV_420_888 as three planes: full-resolution Y,
then half-resolution U and V. Planes are not guaranteed to be tightly packed.
`rowStride` is the byte distance between adjacent rows and `pixelStride` is the
byte distance between samples within one row (interleaved chroma commonly has a
pixel stride of two). `YuvConverter` uses both values for every sample, so it
works with padded and interleaved CameraX buffers.

The crop is intersected with the image first. `BilinearResizer` maps output pixel
centers into that crop and `YuvConverter` bilinearly samples luma and chroma,
converts Y'CbCr directly to RGB, applies default `[0, 1]` normalization, and
writes each value to its final destination. There is no Bitmap, RGB byte array,
JPEG, or per-pixel object allocation.

The returned direct `ArrayBuffer` is the only output-sized allocation. It is
native-owned by Nitro and remains valid after the call; therefore it must not be
reused for the next frame. Its Float32 layout is planar: indices
`0..pixels-1` are R, `pixels..2*pixels-1` are G, and the final plane is B.
`Normalization` centralizes mean/std support for a later public normalization
option without adding work to the current default path.

The frame remains owned by VisionCamera. This plugin only reads it and never
closes it; the frame processor must still call `frame.dispose()` in `finally`.
