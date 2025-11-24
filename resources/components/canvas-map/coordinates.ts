import type { DistinctPair } from "../../ts/util";

/*
 * The crux of this is that positions and displacements (position - position)
 * are not interchangeable. They operate differently under linear operators,
 * e.g. displacements are not translated and only ever scaled. So only some
 * algebraic operations make sense, and the types in this file restrict that.
 *
 * To avoid accidental assignments and conversions, we leverage Typescript. With
 * these extra discriminators, vectors of different categories cannot be
 * implicitly converted. This makes manually working with them difficult, but we
 * write helper functions that handle all the conversions and math correctly.
 *
 * Description of each coordinate space:
 *
 * Wiki:
 *
 *  The coordinates utilized by the wiki and the remote backend. Each unit is 1
 *  square in runescape, with +Y pointing "up" or north in-game.
 *
 * World:
 *
 *  Same unit as Wiki coordinates, just with the Y-axis flipped and +Y pointing
 *  "down" or south in-game. The flip was done to simplify rendering, although
 *  it should theoretically be possible to not need to flip the axis until the
 *  actual canvas draws.
 *
 * Region:
 *
 *  The coordinates referred to by the region/tile file names. For example,
 *  Lumbridge castle is (52,50,0) (x,y,plane). These are scaled and shifted from
 *  Wiki coordinates.
 *
 * View:
 *
 *  These coordinates are 1 to 1 with logical/CSS pixels. The origin in this
 *  coordinate space is the center of the screen, where the camera is
 *  positioned.
 *
 * Cursor:
 *
 *  These coordinates are what the pointer events use. The size of a unit is the
 *  same as the view, just offset so the origin is in the (-,-) corner of the
 *  screen. In the Javascript Web API, these coordinates are labelled (ClientX,
 *  ClientY) or (ClientWidth, ClientHeight).
 *
 * Image:
 *
 *  Image coordinates are what are used when referring to the pixels of an image
 *  resource utilized by the canvas 2D API.
 */
type Space = "Wiki" | "World" | "Region" | "View" | "Cursor" | "Image";
type Category = "Position" | "Displacement";

type Component<C extends Category, S extends Space> = DistinctPair<number, C, S>;

interface Vec2D<C extends Category, S extends Space> {
  x: Component<C, S>;
  y: Component<C, S>;
  __CATEGORY__: C;
  __SPACE__: S;
}

/*
 * Helper type that help match types across operands.
 */

type SpaceOf<P extends { __SPACE__: Space }> = P["__SPACE__"];
type CategoryOf<P extends { __CATEGORY__: Category }> = P["__CATEGORY__"];

export interface Transform2D {
  translation: WorldPosition2D;
  scale: number;
}

export type WikiPosition2D = Vec2D<"Position", "Wiki">;

export type WorldPosition2D = Vec2D<"Position", "World">;
export type WorldDisplacement2D = Vec2D<"Displacement", "World">;

export type RegionPosition2D = Vec2D<"Position", "Region">;
export type RegionDisplacement2D = Vec2D<"Displacement", "Region">;

export type ViewPosition2D = Vec2D<"Position", "View">;
export type ViewDisplacement2D = Vec2D<"Displacement", "View">;

export type CursorPosition2D = Vec2D<"Position", "Cursor">;
export type CursorDisplacement2D = Vec2D<"Displacement", "Cursor">;

export type ImagePosition2D = Vec2D<"Position", "Image">;
export type ImageDisplacement2D = Vec2D<"Displacement", "Image">;

/**
 * For whatever reason, regions are identified by a position far offset from
 * their actual coordinate position.
 *
 * E.g., the Lumbridge tile is named "0_53_50.webp". It runs from (3200,3200) to
 * (3264,3264) in in-game coordinates.
 *
 * However, (53,50) * 64 = (3392,3200) = (3200,3200) + (192,0), so we offset by
 * -192 in the x direction to align region coordinates with world coordinates.
 */
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
} as ImageDisplacement2D);

export const ICON_IMAGE_PIXEL_EXTENT = Object.freeze({
  x: 15,
  y: 15,
} as ImageDisplacement2D);

export const Pos2D = Object.freeze({
  worldToWiki({ x, y }: WorldPosition2D): WikiPosition2D {
    return {
      x: x as number,
      y: -(y as number),
    } as WikiPosition2D;
  },

  wikiToWorld({ x, y }: WikiPosition2D): WorldPosition2D {
    return {
      x: x as number,
      y: -(y as number),
    } as WorldPosition2D;
  },

  viewToWorld({
    view: { x, y },
    camera: { scale, translation },
  }: {
    view: ViewPosition2D;
    camera: { scale: number; translation: WorldPosition2D };
  }): WorldPosition2D {
    return {
      x: scale * x + translation.x,
      y: scale * y + translation.y,
    } as WorldPosition2D;
  },

  cursorToView({
    cursor,
    canvasExtent,
  }: {
    cursor: CursorPosition2D;
    canvasExtent: CursorDisplacement2D;
  }): ViewPosition2D {
    return {
      x: cursor.x - 0.5 * canvasExtent.x,
      y: cursor.y - 0.5 * canvasExtent.y,
    } as ViewPosition2D;
  },

  cursorToWorld({
    cursor,
    camera,
    canvasExtent,
  }: {
    cursor: CursorPosition2D;
    camera: Transform2D;
    canvasExtent: CursorDisplacement2D;
  }): WorldPosition2D {
    const view = Pos2D.cursorToView({ cursor, canvasExtent });
    const world = Pos2D.viewToWorld({ view, camera });
    return world;
  },

  regionToWorld({ x, y }: RegionPosition2D): WorldPosition2D {
    return {
      x: x * WORLD_UNITS_PER_REGION + WORLD_TO_REGION_CONVERSION.x,
      y: -(y * WORLD_UNITS_PER_REGION + WORLD_TO_REGION_CONVERSION.y),
    } as WorldPosition2D;
  },

  worldToRegion({ x, y }: WorldPosition2D): RegionPosition2D {
    return {
      x: (x - WORLD_TO_REGION_CONVERSION.x) / WORLD_UNITS_PER_REGION,
      y: -(y + WORLD_TO_REGION_CONVERSION.y) / WORLD_UNITS_PER_REGION,
    } as RegionPosition2D;
  },

  worldToView({
    world: { x, y },
    camera: { scale, translation },
  }: {
    world: WorldPosition2D;
    camera: { scale: number; translation: WorldPosition2D };
  }): ViewPosition2D {
    return {
      x: (x - translation.x) / scale,
      y: (y - translation.y) / scale,
    } as ViewPosition2D;
  },
});

export const Disp2D = Object.freeze({
  worldToView({ world, camera: { scale } }: { world: WorldDisplacement2D; camera: Transform2D }): ViewDisplacement2D {
    return {
      x: world.x / scale,
      y: world.y / scale,
    } as ViewDisplacement2D;
  },

  viewToWorld({ view, camera: { scale } }: { view: ViewDisplacement2D; camera: Transform2D }): WorldDisplacement2D {
    return {
      x: scale * view.x,
      y: scale * view.y,
    } as WorldDisplacement2D;
  },

  cursorToWorld({ cursor, camera }: { cursor: CursorDisplacement2D; camera: Transform2D }): WorldDisplacement2D {
    const view = Vec2D.create<ViewDisplacement2D>(cursor);
    const world = this.viewToWorld({ view, camera });
    return world;
  },
});

/**
 * Functions that work on multiple categories of vector.
 */
export const Vec2D = Object.freeze({
  /**
   * Returns component-wise lhs === rhs.
   */
  equals<LHS extends Vec2D<Category, Space>, RHS extends Vec2D<CategoryOf<LHS>, SpaceOf<LHS>>>(
    lhs: LHS,
    rhs: RHS,
  ): boolean {
    return lhs.x === rhs.x && lhs.y === rhs.y;
  },

  /**
   * Returns component-wise lhs >= rhs.
   */
  greaterOrEqualThan<LHS extends Vec2D<Category, Space>, RHS extends Vec2D<CategoryOf<LHS>, SpaceOf<LHS>>>(
    lhs: LHS,
    rhs: RHS,
  ): boolean {
    return lhs.x >= rhs.x && lhs.y >= rhs.y;
  },

  /**
   * Returns component-wise lhs <= rhs.
   */
  lessOrEqualThan<LHS extends Vec2D<Category, Space>, RHS extends Vec2D<CategoryOf<LHS>, SpaceOf<LHS>>>(
    lhs: LHS,
    rhs: RHS,
  ): boolean {
    return lhs.x <= rhs.x && lhs.y <= rhs.y;
  },

  /**
   * Returns component-wise floor.
   */
  floor<Vector extends Vec2D<Category, Space>>({ x, y }: Vector): Vector {
    return {
      x: Math.floor(x),
      y: Math.floor(y),
    } as Vector;
  },

  /**
   * Returns component-wise ceiling.
   */
  ceil<Vector extends Vec2D<Category, Space>>({ x, y }: Vector): Vector {
    return {
      x: Math.ceil(x),
      y: Math.ceil(y),
    } as Vector;
  },

  /**
   * Returns p + d. Both arguments must be in the space coordinate space, with the
   * left hand side being a position and the right hand side being a displacement.
   */
  add<Position extends Vec2D<"Position", Space>, Displacement extends Vec2D<"Displacement", SpaceOf<Position>>>(
    position: Position,
    displacement: Displacement,
  ): Position {
    return {
      x: position.x + displacement.x,
      y: position.y + displacement.y,
    } as Position;
  },

  /**
   * Returns lhs - rhs. Both arguments must be positions and must be the same
   * coordinate space.
   */
  sub<Position extends Vec2D<"Position", Space>, Displacement extends Vec2D<"Displacement", SpaceOf<Position>>>(
    lhs: Position,
    rhs: Position,
  ): Displacement {
    return {
      x: lhs.x - rhs.x,
      y: lhs.y - rhs.y,
    } as Displacement;
  },

  /**
   * Returns multiplier * vector for dimensionless scalar. Works with any
   * category, and returns a vector in the space coordinate space.
   */
  mul<Vec extends Vec2D<Category, Space>>(multiplier: number, vector: Vec): Vec {
    return {
      x: multiplier * vector.x,
      y: multiplier * vector.y,
    } as Vec;
  },

  create<Vec extends Vec2D<Category, Space>>({ x, y }: { x: number; y: number }): Vec {
    return { x, y } as Vec;
  },

  average<Vec extends Vec2D<Category, Space>>(arr: Vec[]): Vec {
    const result = { x: 0, y: 0 };
    if (arr.length < 1) return result as Vec;

    for (const { x, y } of arr) {
      result.x += x;
      result.y += y;
    }

    result.x /= arr.length;
    result.y /= arr.length;

    return result as Vec;
  },

  lerp<C extends Category, S extends Space, V extends Vec2D<C, S>>({ t, from, to }: { t: number; from: V; to: V }): V {
    return {
      x: (1 - t) * from.x + t * to.x,
      y: (1 - t) * from.y + t * to.y,
    } as V;
  },

  lengthSquared<C extends Category, S extends Space, V extends Vec2D<C, S>>({ x, y }: V): number {
    return x * x + y * y;
  },
});

/**
 * For a (min,max) style AABB, when converting coordinate spaces the min and max
 * will swap and twist components due to changing axes. The functions in this
 * helper object convert in a way that handles that.
 */
export const Rect2D = Object.freeze({
  create<Position extends Vec2D<"Position", Space>, Displacement extends Vec2D<"Displacement", SpaceOf<Position>>>({
    position,
    extent,
  }: {
    position: Position;
    extent: Displacement;
  }): { min: Position; max: Position } {
    const first = position;
    const second = Vec2D.add(position, extent);

    return {
      min: Vec2D.create({ x: Math.min(first.x, second.x), y: Math.min(first.y, second.y) }),
      max: Vec2D.create({ x: Math.max(first.x, second.x), y: Math.max(first.y, second.y) }),
    };
  },

  ceilFloor<Vec extends Vec2D<Category, Space>>({ min, max }: { min: Vec; max: Vec }): { min: Vec; max: Vec } {
    return {
      min: Vec2D.floor(min),
      max: Vec2D.ceil(max),
    };
  },

  worldToRegion({ min, max }: { min: WorldPosition2D; max: WorldPosition2D }): {
    min: RegionPosition2D;
    max: RegionPosition2D;
  } {
    const first = Pos2D.worldToRegion(min);
    const second = Pos2D.worldToRegion(max);

    return {
      min: Vec2D.create({ x: Math.min(first.x, second.x), y: Math.min(first.y, second.y) }),
      max: Vec2D.create({ x: Math.max(first.x, second.x), y: Math.max(first.y, second.y) }),
    };
  },

  regionToWorld({ min, max }: { min: RegionPosition2D; max: RegionPosition2D }): {
    min: WorldPosition2D;
    max: WorldPosition2D;
  } {
    const first = Pos2D.regionToWorld(min);
    const second = Pos2D.regionToWorld(max);

    return {
      min: Vec2D.create({ x: Math.min(first.x, second.x), y: Math.min(first.y, second.y) }),
      max: Vec2D.create({ x: Math.max(first.x, second.x), y: Math.max(first.y, second.y) }),
    };
  },

  worldToView({ min, max, camera }: { min: WorldPosition2D; max: WorldPosition2D; camera: Transform2D }): {
    min: ViewPosition2D;
    max: ViewPosition2D;
  } {
    const first = Pos2D.worldToView({ world: min, camera });
    const second = Pos2D.worldToView({ world: max, camera });

    return {
      min: Vec2D.create({ x: Math.min(first.x, second.x), y: Math.min(first.y, second.y) }),
      max: Vec2D.create({ x: Math.max(first.x, second.x), y: Math.max(first.y, second.y) }),
    };
  },
});
