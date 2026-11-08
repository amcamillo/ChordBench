export function cameraPosition(aspect: number, yaw: number, tilt: number, zoom: number) {
  const theta = yaw + .7;
  const elevation = -(tilt + .15);
  const distance = 18 * Math.max(1, 1.48 / Math.max(.1, aspect)) / zoom;
  return { x: Math.sin(theta) * Math.cos(elevation) * distance,
    y: Math.sin(elevation) * distance,
    z: -5.4 + Math.cos(theta) * Math.cos(elevation) * distance };
}
