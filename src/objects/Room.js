import * as THREE from 'three';
import { ROOM, PALETTE } from '../config.js';
import { createPlasterTexture } from '../utils/textures.js';

/** The alcove around the desk: back wall, side walls, floor and baseboards. */
export class Room {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'room';

    const plaster = createPlasterTexture({ repeat: [5, 3.5] });
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: PALETTE.wall,
      roughness: 0.95,
      bumpMap: plaster,
      bumpScale: 0.6,
    });

    const roomWidth = ROOM.rightWallX - ROOM.leftWallX;
    const centerX = (ROOM.rightWallX + ROOM.leftWallX) / 2;
    const roomDepth = 4;

    // back wall — the canvas for notes, photos and shelves later on
    this.backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, ROOM.height), wallMaterial);
    this.backWall.position.set(centerX, ROOM.height / 2, ROOM.backWallZ);
    this.backWall.receiveShadow = true;
    this.backWall.name = 'backWall';
    this.group.add(this.backWall);

    const sideGeometry = new THREE.PlaneGeometry(roomDepth, ROOM.height);
    const leftWall = new THREE.Mesh(sideGeometry, wallMaterial);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(ROOM.leftWallX, ROOM.height / 2, ROOM.backWallZ + roomDepth / 2);
    leftWall.receiveShadow = true;
    this.group.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.x = ROOM.rightWallX;
    this.group.add(rightWall);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(roomWidth, roomDepth),
      new THREE.MeshStandardMaterial({ color: 0x3b2a1f, roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, 0, ROOM.backWallZ + roomDepth / 2);
    floor.receiveShadow = true;
    this.group.add(floor);

    // painted baseboard along the back wall
    const baseboardMaterial = new THREE.MeshStandardMaterial({ color: 0xf1e9dc, roughness: 0.6 });
    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.09, 0.015), baseboardMaterial);
    baseboard.position.set(centerX, 0.045, ROOM.backWallZ + 0.0075);
    baseboard.receiveShadow = true;
    this.group.add(baseboard);
  }
}
