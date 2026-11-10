import { FunctionAnimation } from "skinview3d";

export function applyPose(player, pose) {
  if (pose === "sit") {
    player.skin.rightLeg.rotation.x = -Math.PI / 2;
    player.skin.leftLeg.rotation.x = -Math.PI / 2;
    // The right hip is at negative X; these signs spread the feet outward.
    player.skin.rightLeg.rotation.z = -Math.PI / 12;
    player.skin.leftLeg.rotation.z = Math.PI / 12;
    player.position.y = -5;
  } else {
    player.rotation.x = -Math.PI / 2;
  }
}
export class SittingAnimation extends FunctionAnimation {
  constructor() {
    super((player) => applyPose(player, "sit"));
  }
}
export class LyingAnimation extends FunctionAnimation {
  constructor() {
    super((player) => applyPose(player, "lie"));
  }
}
