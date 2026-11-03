// Shared world dimensions, in meters.
export const DESK = {
  width: 1.4,
  depth: 0.7,
  height: 0.75,
  thickness: 0.035,
};

export const ROOM = {
  backWallZ: -DESK.depth / 2 - 0.02,
  leftWallX: -1.1,
  rightWallX: 1.3,
  height: 2.8,
};

export const PALETTE = {
  night: 0x120d0b,
  wall: 0xe9dfcf,
  lampLight: 0xffd39a,
  lampBody: 0xede6da,
  shadowTint: 0x2a1f1a,
  moon: 0x8fa3c8,
};

// Standing over the desk, looking down: used while arranging things.
export const SETUP_VIEW = {
  position: [0, 1.95, 0.9],
  target: [0, DESK.height, -0.02],
};

// Default "sitting at the desk" point of view.
export const HOME_VIEW = {
  position: [0, 1.3, 1.12],
  target: [0, 0.9, -0.2],
};
