const WORLD_TO_REGION_CONVERSION = {
  x: -192,
  y: 0,
};
const REGION_IMAGE_PIXEL_SIZE = 256;
const RS_SQUARE_PIXEL_SIZE = 4;
const WORLD_UNITS_PER_REGION = REGION_IMAGE_PIXEL_SIZE / RS_SQUARE_PIXEL_SIZE;
export const REGION_IMAGE_PIXEL_EXTENT = Object.freeze({
  x: REGION_IMAGE_PIXEL_SIZE,
  y: REGION_IMAGE_PIXEL_SIZE,
});
export const ICON_IMAGE_PIXEL_EXTENT = Object.freeze({
  x: 15,
  y: 15,
});
export const Pos2D = Object.freeze({
  worldToWiki({ x, y }) {
    return {
      x: x,
      y: -y,
    };
  },
  wikiToWorld({ x, y }) {
    return {
      x: x,
      y: -y,
    };
  },
  viewToWorld({ view: { x, y }, camera: { scale, translation } }) {
    return {
      x: scale * x + translation.x,
      y: scale * y + translation.y,
    };
  },
  cursorToView({ cursor, canvasExtent }) {
    return {
      x: cursor.x - 0.5 * canvasExtent.x,
      y: cursor.y - 0.5 * canvasExtent.y,
    };
  },
  cursorToWorld({ cursor, camera, canvasExtent }) {
    const view = Pos2D.cursorToView({
      cursor,
      canvasExtent,
    });
    const world = Pos2D.viewToWorld({
      view,
      camera,
    });
    return world;
  },
  regionToWorld({ x, y }) {
    return {
      x: x * WORLD_UNITS_PER_REGION + WORLD_TO_REGION_CONVERSION.x,
      y: -(y * WORLD_UNITS_PER_REGION + WORLD_TO_REGION_CONVERSION.y),
    };
  },
  worldToRegion({ x, y }) {
    return {
      x: (x - WORLD_TO_REGION_CONVERSION.x) / WORLD_UNITS_PER_REGION,
      y: -(y + WORLD_TO_REGION_CONVERSION.y) / WORLD_UNITS_PER_REGION,
    };
  },
  worldToView({ world: { x, y }, camera: { scale, translation } }) {
    return {
      x: (x - translation.x) / scale,
      y: (y - translation.y) / scale,
    };
  },
});
export const Disp2D = Object.freeze({
  worldToView({ world, camera: { scale } }) {
    return {
      x: world.x / scale,
      y: world.y / scale,
    };
  },
  viewToWorld({ view, camera: { scale } }) {
    return {
      x: scale * view.x,
      y: scale * view.y,
    };
  },
  cursorToWorld({ cursor, camera }) {
    const view = Vec2D.create(cursor);
    const world = this.viewToWorld({
      view,
      camera,
    });
    return world;
  },
});
export const Vec2D = Object.freeze({
  equals(lhs, rhs) {
    return lhs.x === rhs.x && lhs.y === rhs.y;
  },
  greaterOrEqualThan(lhs, rhs) {
    return lhs.x >= rhs.x && lhs.y >= rhs.y;
  },
  lessOrEqualThan(lhs, rhs) {
    return lhs.x <= rhs.x && lhs.y <= rhs.y;
  },
  floor({ x, y }) {
    return {
      x: Math.floor(x),
      y: Math.floor(y),
    };
  },
  ceil({ x, y }) {
    return {
      x: Math.ceil(x),
      y: Math.ceil(y),
    };
  },
  add(position, displacement) {
    return {
      x: position.x + displacement.x,
      y: position.y + displacement.y,
    };
  },
  sub(lhs, rhs) {
    return {
      x: lhs.x - rhs.x,
      y: lhs.y - rhs.y,
    };
  },
  mul(multiplier, vector) {
    return {
      x: multiplier * vector.x,
      y: multiplier * vector.y,
    };
  },
  create({ x, y }) {
    return {
      x,
      y,
    };
  },
  average(arr) {
    const result = {
      x: 0,
      y: 0,
    };
    if (arr.length < 1) return result;
    for (const { x, y } of arr) {
      result.x += x;
      result.y += y;
    }
    result.x /= arr.length;
    result.y /= arr.length;
    return result;
  },
  lerp({ t, from, to }) {
    return {
      x: (1 - t) * from.x + t * to.x,
      y: (1 - t) * from.y + t * to.y,
    };
  },
  lengthSquared({ x, y }) {
    return x * x + y * y;
  },
});
export const Rect2D = Object.freeze({
  create({ position, extent }) {
    const first = position;
    const second = Vec2D.add(position, extent);
    return {
      min: Vec2D.create({
        x: Math.min(first.x, second.x),
        y: Math.min(first.y, second.y),
      }),
      max: Vec2D.create({
        x: Math.max(first.x, second.x),
        y: Math.max(first.y, second.y),
      }),
    };
  },
  ceilFloor({ min, max }) {
    return {
      min: Vec2D.floor(min),
      max: Vec2D.ceil(max),
    };
  },
  worldToRegion({ min, max }) {
    const first = Pos2D.worldToRegion(min);
    const second = Pos2D.worldToRegion(max);
    return {
      min: Vec2D.create({
        x: Math.min(first.x, second.x),
        y: Math.min(first.y, second.y),
      }),
      max: Vec2D.create({
        x: Math.max(first.x, second.x),
        y: Math.max(first.y, second.y),
      }),
    };
  },
  regionToWorld({ min, max }) {
    const first = Pos2D.regionToWorld(min);
    const second = Pos2D.regionToWorld(max);
    return {
      min: Vec2D.create({
        x: Math.min(first.x, second.x),
        y: Math.min(first.y, second.y),
      }),
      max: Vec2D.create({
        x: Math.max(first.x, second.x),
        y: Math.max(first.y, second.y),
      }),
    };
  },
  worldToView({ min, max, camera }) {
    const first = Pos2D.worldToView({
      world: min,
      camera,
    });
    const second = Pos2D.worldToView({
      world: max,
      camera,
    });
    return {
      min: Vec2D.create({
        x: Math.min(first.x, second.x),
        y: Math.min(first.y, second.y),
      }),
      max: Vec2D.create({
        x: Math.max(first.x, second.x),
        y: Math.max(first.y, second.y),
      }),
    };
  },
});
