import { NitroModules } from 'react-native-nitro-modules'
import type { FaceCropper } from './FaceCropper.nitro'

export type { FaceCropper, FaceTensor } from './FaceCropper.nitro'

/** Use from a VisionCamera frame worklet; dispose the Frame in the caller. */
export const faceCropper = NitroModules.createHybridObject<FaceCropper>(
  'FaceCropper',
)
