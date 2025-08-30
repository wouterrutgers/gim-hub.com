import { fetchMapJSON, type MapMetadata } from "../../game/map-data";
import type { Distinct } from "../../ts/util";
import type { Context2DScaledWrapper } from "./canvas-wrapper";
import {
  type CursorPosition2D,
  type WorldDisplacement2D,
  type WorldPosition2D,
  type WikiPosition2D,
  Pos2D,
  type RegionPosition2D,
  Vec2D,
  REGION_IMAGE_PIXEL_EXTENT,
  ICON_IMAGE_PIXEL_EXTENT,
  Disp2D,
  Rect2D,
  type RegionDisplacement2D,
  type CursorDisplacement2D,
} from "./coordinates";

export interface LabelledCoordinates {
  label: string;
  coords: WikiPosition2D;
  plane: number;
}

interface CoordinateLerp {
  from: WorldPosition2D;
  to: WorldPosition2D;
  timeRemainingMS: number;
}

const FOLLOW_ANIMATION_TIME_MS = 300;
interface CanvasMapCamera {
  position: WorldPosition2D;

  followPlayer: string | undefined;

  followingAnimation: CoordinateLerp | undefined;

  // Zoom of camera with smoothing
  zoom: number;
  minZoom: number;
  maxZoom: number;
}
interface CanvasMapCursor {
  /**
   * Current position of the cursor in the window. We do not store this as a
   * WorldTranslation since it will need to be resolved as the camera moves and
   * scales.
   */
  position: CursorPosition2D;
  positionPrevious: CursorPosition2D;

  /**
   * Stores samples of the cursors movement across frames, so the camera coasts
   * with no accidental "flicking".
   */
  rateSamples: CursorDisplacement2D[];

  /**
   * Milliseconds of time spent in friction, for computing the deceleration of
   * the camera when let go
   */
  accumulatedFrictionMS: number;

  isVisible: boolean;
  isDragging: boolean;

  // Multiple scroll events may occur in a frame, so we add them all up.
  accumulatedScroll: number;
}
const REGION_FADE_IN_SECONDS = 1;
const REGION_FADE_IN_ALPHA_PER_MS = 1 / (REGION_FADE_IN_SECONDS * 1000);

interface MapRegion {
  alpha: number;
  // Undefined while loading from file
  image?: ImageBitmap;
  position: RegionPosition2D;
}

type MapRegionCoordinate2DHash = Distinct<string, "MapRegionCoordinate2DHash">;
type MapRegionCoordinate3DHash = Distinct<string, "MapRegionCoordinate3DHash">;
type RegionGrid = Map<MapRegionCoordinate3DHash, MapRegion>;

// Fractional coordinates get rounded
const hashMapRegionCoordinate2Ds = ({ x, y }: RegionPosition2D): MapRegionCoordinate2DHash => {
  return `${Math.round(x)}_${Math.round(y)}` as MapRegionCoordinate2DHash;
};
const hashMapRegionCoordinate3Ds = ({ x, y }: RegionPosition2D, plane: number): MapRegionCoordinate3DHash => {
  return `${Math.round(plane)}_${Math.round(x)}_${Math.round(y)}` as MapRegionCoordinate3DHash;
};

// An icon is those round indicators in runescape, e.g. the blue star for quests.
interface MapIcon {
  // Index into the icon atlas
  spriteIndex: number;
  worldPosition: WorldPosition2D;
}

type MapIconGrid = Map<MapRegionCoordinate2DHash, MapIcon[]>;

interface MapLabel {
  // labelID.webp is the filename of the label
  labelID: number;
  worldPosition: WorldPosition2D;
  plane: number;
  image?: ImageBitmap;
}

type MapLabelGrid = Map<MapRegionCoordinate2DHash, MapLabel[]>;

/*
 * We bound the regions we bother attempting to load, to avoid loading regions
 * outside the valid area and creating superfluous requests.
 */
const REGION_X_MIN = 18;
const REGION_X_MAX = 68;
const REGION_Y_MIN = 19;
const REGION_Y_MAX = 160;

export class CanvasMapRenderer {
  private regions: RegionGrid;
  private camera: CanvasMapCamera;
  private cursor: CanvasMapCursor;
  private lastUpdateTime: DOMHighResTimeStamp;
  private iconsAtlas?: ImageBitmap;
  private iconsByRegion?: MapIconGrid;
  private labelsByRegion?: MapLabelGrid;
  private playerPositions = new Map<string, { coords: WorldPosition2D; plane: number }>();
  private getImageUrl: (path: string) => string;

  private interactive = false;
  public setInteractive(interactive: boolean): void {
    if (this.interactive === interactive) return;

    this.interactive = interactive;
    this.forceRenderNextFrame = true;
  }

  public forceRenderNextFrame = false;

  /**
   * This stores which plane of the runescape world to render.
   * Only 4 of them (index 0 to 3) have valid images.
   * The region image assets have all 3 planes visibly composited, so we only need to render
   * one image per region.
   */
  private plane: number;

  private processMapData(mapData: MapMetadata): void {
    this.iconsByRegion = new Map();
    for (const regionXString of Object.keys(mapData.icons)) {
      for (const regionYString of Object.keys(mapData.icons[regionXString])) {
        const regionPosition = Vec2D.create<RegionPosition2D>({
          x: parseInt(regionXString),
          y: parseInt(regionYString),
        });

        const icons: MapIcon[] = Object.entries(mapData.icons[regionXString][regionYString])
          .map(([spriteIndex, coordinatesFlat]) => {
            return coordinatesFlat
              .reduce<[number, number][]>((pairs, _, index, coordinates) => {
                if (index % 2 === 0) {
                  pairs.push([coordinates[index], coordinates[index + 1]]);
                }
                return pairs;
              }, [])
              .map((position) => ({
                spriteIndex: parseInt(spriteIndex),
                worldPosition: Vec2D.create<WorldPosition2D>({ x: position[0] - 128, y: -position[1] }),
              }));
          })
          .flat();

        this.iconsByRegion.set(hashMapRegionCoordinate2Ds(regionPosition), icons);
      }
    }

    this.labelsByRegion = new Map();
    for (const regionXString of Object.keys(mapData.labels)) {
      for (const regionYString of Object.keys(mapData.labels[regionXString])) {
        const regionPosition = Vec2D.create<RegionPosition2D>({
          x: parseInt(regionXString),
          y: parseInt(regionYString),
        });

        const labels: MapLabel[] = Object.entries(mapData.labels[regionXString][regionYString])
          .map(([planeString, XYLabelIDFlat]) => {
            const plane = parseInt(planeString);

            return XYLabelIDFlat.reduce<MapLabel[]>((labels, _, index, labelFlat) => {
              if (index % 3 === 0) {
                const position = Vec2D.create<WorldPosition2D>({
                  x: labelFlat[index] - 128,
                  y: -labelFlat[index + 1],
                });

                labels.push({
                  labelID: labelFlat[index + 2],
                  plane,
                  worldPosition: position,
                });
              }
              return labels;
            }, []);
          })
          .flat();

        this.labelsByRegion.set(hashMapRegionCoordinate2Ds(regionPosition), labels);
      }
    }
  }

  private constructor(getImageUrl: (path: string) => string) {
    const INITIAL_X = 3232;
    const INITIAL_Y = -3232;
    const INITIAL_ZOOM = 1 / 4;
    const INITIAL_PLANE = 0;

    this.getImageUrl = getImageUrl;
    this.regions = new Map();
    this.camera = {
      position: Vec2D.create({ x: INITIAL_X, y: INITIAL_Y }),
      followingAnimation: undefined,
      zoom: INITIAL_ZOOM,
      minZoom: 1 / 32,
      maxZoom: 1 / 4,
      followPlayer: undefined,
    };
    this.cursor = {
      position: Vec2D.create({ x: 0, y: 0 }),
      positionPrevious: Vec2D.create({ x: 0, y: 0 }),
      rateSamples: [Vec2D.create({ x: 0, y: 0 })],
      accumulatedFrictionMS: 0,
      isVisible: false,
      isDragging: false,
      accumulatedScroll: 0,
    };
    this.lastUpdateTime = performance.now();
    this.plane = INITIAL_PLANE;
  }

  public static async load(getImageUrl: (path: string) => string): Promise<CanvasMapRenderer> {
    const renderer = new CanvasMapRenderer(getImageUrl);

    // Promisify the image loading
    const iconAtlasPromise = new Promise<ImageBitmap>((resolve) => {
      const ICONS_IN_ATLAS = 123;
      const iconAtlas = new Image(ICONS_IN_ATLAS * ICON_IMAGE_PIXEL_EXTENT.x, ICON_IMAGE_PIXEL_EXTENT.y);
      iconAtlas.src = getImageUrl("/map/icons/map_icons.webp");
      iconAtlas.onload = (): void => {
        resolve(createImageBitmap(iconAtlas));
      };
    });

    const [mapData, iconAtlas_1] = await Promise.all([fetchMapJSON(), iconAtlasPromise]);
    renderer.processMapData(mapData);
    renderer.iconsAtlas = iconAtlas_1;
    return renderer;
  }

  handlePointerDown(): void {
    if (this.cursor.isDragging) return;

    // We reset the samples here, since if the cursor is down, the map should
    // snap to the cursor. When it snaps, the momentum needs to be cancelled.
    this.cursor.rateSamples = [];

    this.cursor.isDragging = true;
    this.onDraggingUpdate?.(this.cursor.isDragging);
  }
  handlePointerUp(): void {
    if (!this.cursor.isDragging) return;

    this.cursor.isDragging = false;
    this.onDraggingUpdate?.(this.cursor.isDragging);
  }
  handlePointerMove(position: CursorPosition2D): void {
    if (!Vec2D.equals(this.cursor.position, position)) {
      this.forceRenderNextFrame = true;
    }
    this.cursor.isVisible = true;
    this.cursor.position = position;
  }
  handlePointerLeave(): void {
    this.cursor.isDragging = false;
    this.cursor.isVisible = false;
    this.forceRenderNextFrame = true;

    this.onDraggingUpdate?.(this.cursor.isDragging);
  }
  handleScroll(amount: number): void {
    this.cursor.accumulatedScroll += amount;
  }
  setPlane(plane: number): void {
    if (plane !== 0 && plane !== 1 && plane !== 2 && plane !== 3) return;

    this.plane = plane;
    this.onVisiblePlaneUpdate?.(this.plane);
    this.forceRenderNextFrame = true;
  }

  public onHoveredCoordinatesUpdate?: (coords: WikiPosition2D) => void;
  public onDraggingUpdate?: (dragging: boolean) => void;
  public onFollowPlayerUpdate?: (player: string | undefined) => void;
  public onVisiblePlaneUpdate?: (plane: number) => void;

  public startFollowingPlayer({ player }: { player: string | undefined }): void {
    if (!player || !this.playerPositions.has(player)) {
      this.camera.followPlayer = undefined;
      this.camera.followingAnimation = undefined;
      this.onFollowPlayerUpdate?.(undefined);
      return;
    }

    const { coords, plane } = this.playerPositions.get(player)!;

    this.camera.followPlayer = player;
    this.camera.followingAnimation = {
      from: this.camera.position,
      to: coords,
      timeRemainingMS: FOLLOW_ANIMATION_TIME_MS,
    };

    this.setPlane(plane);
    this.onFollowPlayerUpdate?.(this.camera.followPlayer);
  }

  public tryUpdatePlayerPositions(positions: LabelledCoordinates[]): void {
    for (const { label, coords: coordsWiki, plane } of positions) {
      const current = this.playerPositions.get(label);
      const coords = Pos2D.wikiToWorld(coordsWiki);

      if (current && Vec2D.equals(coords, current.coords) && plane === current.plane) continue;

      this.playerPositions.set(label, { coords, plane });
      this.forceRenderNextFrame = true;

      if (this.camera.followPlayer !== label) continue;

      this.camera.followingAnimation = {
        timeRemainingMS: FOLLOW_ANIMATION_TIME_MS,
        from: this.camera.position,
        to: Vec2D.create(coords),
      };

      this.setPlane(plane);
    }
  }

  private updateCursorVelocity(elapsed: number): void {
    if (elapsed < 0.001) return;

    const displacement = Vec2D.sub(this.cursor.position, this.cursor.positionPrevious);

    if (this.cursor.isDragging) {
      const EVENTS_TO_KEEP = 10;

      this.cursor.rateSamples.push(Vec2D.mul(1 / elapsed, displacement));
      if (this.cursor.rateSamples.length > EVENTS_TO_KEEP) {
        this.cursor.rateSamples = this.cursor.rateSamples.slice(this.cursor.rateSamples.length - EVENTS_TO_KEEP);
      }
      this.cursor.accumulatedFrictionMS = 0;
    } else {
      this.cursor.accumulatedFrictionMS += elapsed;
    }
  }

  private updateCamera({ context, elapsed }: { context: Context2DScaledWrapper; elapsed: number }): void {
    const previousZoom = this.camera.zoom;
    const ZOOM_SENSITIVITY = 1 / 3000;
    if (this.cursor.accumulatedScroll !== 0) {
      this.camera.zoom += ZOOM_SENSITIVITY * this.cursor.accumulatedScroll;
    }
    this.cursor.accumulatedScroll = 0;
    this.camera.zoom = Math.max(Math.min(this.camera.zoom, this.camera.maxZoom), this.camera.minZoom);

    const cursorWorldPosition = Pos2D.cursorToWorld({
      cursor: this.cursor.position,
      camera: context.getCamera(),
      canvasExtent: context.getCanvasExtent(),
    });
    const cursorWorldDelta = Disp2D.cursorToWorld({
      cursor: Vec2D.sub(this.cursor.position, this.cursor.positionPrevious),
      camera: context.getCamera(),
    });

    /*
     * Don't shift the camera with zoom when following, since we just want the
     * camera to zoom in/out of the player being followed.
     */
    if (this.camera.zoom !== previousZoom && !this.camera.followingAnimation) {
      /*
       * Zoom requires special handling since we want to zoom in on the cursor.
       * This requires translating the camera towards the cursor some amount.
       */
      const cameraToCursorDisplacement = Vec2D.sub(this.camera.position, cursorWorldPosition);
      const zoomRatio = this.camera.zoom / previousZoom;
      this.camera.position = Vec2D.add(cursorWorldPosition, Vec2D.mul(zoomRatio, cameraToCursorDisplacement));
    }

    if (this.camera.followPlayer && !this.playerPositions.has(this.camera.followPlayer)) {
      this.startFollowingPlayer({ player: undefined });
    }

    /*
     * When calculating camera delta from cursor delta, we negate, since
     * dragging is opposite the intended direction of movement.
     *
     * We add the delta, since if the user grabs the canvas off-center we don't
     * want to jump to that, we just want to move the world as the cursor moves.
     */
    if (this.cursor.isDragging) {
      this.camera.position = Vec2D.add(this.camera.position, Vec2D.mul(-1.0, cursorWorldDelta));
      this.startFollowingPlayer({ player: undefined });
    } else if (this.camera.followingAnimation) {
      const { to, from, timeRemainingMS } = this.camera.followingAnimation;

      const t = 1.0 - timeRemainingMS / FOLLOW_ANIMATION_TIME_MS;
      this.camera.position = Vec2D.lerp({ t, from, to });
    } else {
      // The camera continues to move with linear deceleration due to friction
      const SPEED_THRESHOLD = 0.05;
      const FRICTION_PER_MS = 0.004;

      const velocityAverage = Vec2D.average(this.cursor.rateSamples);

      const speed = Math.sqrt(Vec2D.lengthSquared(velocityAverage));
      const speedAfterFriction = speed - FRICTION_PER_MS * this.cursor.accumulatedFrictionMS;
      if (speedAfterFriction > SPEED_THRESHOLD) {
        const velocityAfterFriction = Vec2D.mul(speedAfterFriction / speed, velocityAverage);
        const displacement = Disp2D.cursorToWorld({
          cursor: Vec2D.mul(elapsed, velocityAfterFriction),
          camera: context.getCamera(),
        });
        this.camera.position = Vec2D.add(this.camera.position, Vec2D.mul(-1.0, displacement));
      }
    }
  }

  /**
   * @param elapsed Milliseconds elapsed since last update.
   * @returns Whether or not any VISIBLE tiles updated their alpha.
   */
  private updateRegionsAlpha(context: Context2DScaledWrapper, elapsed: number): boolean {
    const { min: regionMin, max: regionMax } = Rect2D.ceilFloor(Rect2D.worldToRegion(context.getVisibleWorldBox()));

    let anyVisibleTileUpdatedAlpha = false;

    this.regions.forEach((region) => {
      if (region.image === undefined) {
        region.alpha = 0;
        return;
      }

      const previousAlpha = region.alpha;
      region.alpha = Math.min(1, region.alpha + elapsed * REGION_FADE_IN_ALPHA_PER_MS);

      const alphaChanged = previousAlpha !== region.alpha;
      const regionIsProbablyVisible =
        Vec2D.greaterOrEqualThan(region.position, regionMin) && Vec2D.lessOrEqualThan(region.position, regionMax);

      anyVisibleTileUpdatedAlpha ||= alphaChanged && regionIsProbablyVisible;
    });

    return anyVisibleTileUpdatedAlpha;
  }

  public update(context: Context2DScaledWrapper): void {
    const previousTransform = {
      translation: this.camera.position,
      scale: this.camera.zoom,
    };

    const currentUpdateTime = performance.now();
    const elapsed = currentUpdateTime - this.lastUpdateTime;

    if (!this.forceRenderNextFrame && elapsed < 0.001) return;

    if (this.camera.followingAnimation) {
      this.camera.followingAnimation.timeRemainingMS = Math.max(
        this.camera.followingAnimation.timeRemainingMS - elapsed,
        0,
      );
    }
    this.updateCursorVelocity(elapsed);

    context.setTransform({
      translation: this.camera.position,
      scale: this.camera.zoom,
    });

    this.updateCamera({ context, elapsed });

    const currentTransform = {
      translation: this.camera.position,
      scale: this.camera.zoom,
    };

    context.setTransform({
      translation: currentTransform.translation,
      scale: currentTransform.scale,
    });

    const transformHasChanged =
      currentTransform.scale !== previousTransform.scale ||
      currentTransform.translation.x !== previousTransform.translation.x ||
      currentTransform.translation.y !== previousTransform.translation.y;
    const anyVisibleRegionUpdatedAlpha = this.updateRegionsAlpha(context, elapsed);

    this.loadVisibleAll(context);
    if (anyVisibleRegionUpdatedAlpha || transformHasChanged || this.forceRenderNextFrame) {
      this.forceRenderNextFrame = false;
      this.drawAll(context);
    }

    const cursorHasMoved =
      this.cursor.position.x !== this.cursor.positionPrevious.x ||
      this.cursor.position.y !== this.cursor.positionPrevious.y;
    if (cursorHasMoved) {
      const view = Pos2D.cursorToView({ cursor: this.cursor.position, canvasExtent: context.getCanvasExtent() });
      const world = Pos2D.viewToWorld({ view, camera: context.getCamera() });
      const wiki = Pos2D.worldToWiki(world);

      this.onHoveredCoordinatesUpdate?.(wiki);
    }

    this.cursor.positionPrevious = this.cursor.position;
    this.lastUpdateTime = currentUpdateTime;
  }

  private loadVisibleAll(context: Context2DScaledWrapper): void {
    // Load regions and labels, which use individual images.
    // Icons are in an atlas and are already loaded.
    const visibleRect = Rect2D.ceilFloor(Rect2D.worldToRegion(context.getVisibleWorldBox()));

    for (let regionX = visibleRect.min.x - 1; regionX <= visibleRect.max.x; regionX++) {
      for (let regionY = visibleRect.min.y - 1; regionY <= visibleRect.max.y; regionY++) {
        if (regionX < REGION_X_MIN || regionX > REGION_X_MAX || regionY < REGION_Y_MIN || regionY > REGION_Y_MAX) {
          continue;
        }

        const regionPosition = Vec2D.create<RegionPosition2D>({ x: regionX, y: regionY });
        const hash3D = hashMapRegionCoordinate3Ds(regionPosition, this.plane);
        const hash2D = hashMapRegionCoordinate2Ds(regionPosition);

        if (!this.regions.has(hash3D)) {
          const image = new Image(REGION_IMAGE_PIXEL_EXTENT.x, REGION_IMAGE_PIXEL_EXTENT.y);
          const regionFileBaseName = `${this.plane}_${regionX}_${regionY}`;

          const region: MapRegion = {
            alpha: 0,
            position: Vec2D.create(regionPosition),
          };
          image.onload = (): void => {
            createImageBitmap(image)
              .then((bitmap) => {
                region.image = bitmap;
              })
              .catch((reason) => {
                console.error("Failed to load image bitmap for:", image.src, reason);
              });
          };
          image.src = this.getImageUrl(`/map/${regionFileBaseName}.webp`);

          this.regions.set(hash3D, region);
        }

        const labels = this.labelsByRegion?.get(hash2D);
        if (labels === undefined) continue;

        labels.forEach((label) => {
          const { labelID, plane } = label;
          if (plane !== this.plane) return;

          if (label.image === undefined) {
            const image = new Image();
            image.src = this.getImageUrl(`/map/labels/${labelID}.webp`);
            image.onload = (): void => {
              createImageBitmap(image)
                .then((bitmap) => (label.image = bitmap))
                .catch((reason) => console.error("Failed to load image bitmap for", image.src, reason));
            };
          }
        });
      }
    }
  }

  /**
   * Icons are the "points of interests", the circular icons such as the blue
   * quest star and green agility shortcut arrow.
   */
  private drawVisibleIcons(context: Context2DScaledWrapper): void {
    // When zooming out, we want icons to get bigger since they would become unreadable otherwise.
    const iconScale = 16 * Math.max(context.getCamera().scale, 1 / 8);

    const visibleRect = Rect2D.ceilFloor(Rect2D.worldToRegion(context.getVisibleWorldBox()));

    for (let regionX = visibleRect.min.x - 1; regionX <= visibleRect.max.x; regionX++) {
      for (let regionY = visibleRect.min.y - 1; regionY <= visibleRect.max.y; regionY++) {
        const mapIcons = this.iconsByRegion?.get(hashMapRegionCoordinate2Ds(Vec2D.create({ x: regionX, y: regionY })));
        if (!mapIcons || !this.iconsAtlas) continue;

        // The 1 centers the icons, the 64 is to get it to be visually correct.
        // I'm not too sure where the 64 comes from, but it exists since our regions/images/coordinates are not quite synced up.
        // const offsetX = -iconScale / 2;
        // const offsetY = -iconScale / 2 + 64;

        const offset = Vec2D.create<WorldDisplacement2D>({ x: -iconScale / 2, y: -iconScale / 2 });
        const extent = Vec2D.create<WorldDisplacement2D>({ x: iconScale, y: iconScale });

        mapIcons.forEach(({ spriteIndex, worldPosition }) => {
          const position = Vec2D.add(worldPosition, offset);
          context.drawImage({
            image: this.iconsAtlas!,
            imageOffsetInPixels: Vec2D.create({ x: spriteIndex * ICON_IMAGE_PIXEL_EXTENT.x, y: 0 }),
            imageExtentInPixels: ICON_IMAGE_PIXEL_EXTENT,
            rect: Rect2D.create({ position, extent }),
            alpha: 1,
          });
        });
      }
    }
  }

  /**
   * A region is the 256x256 square areas in OSRS. We render them as square
   * images in the background.
   */
  private drawVisibleRegions(context: Context2DScaledWrapper): void {
    /*
     * WARNING:
     * Region coordinates are FLIPPED from Canvas coordinates.
     * Region 0,0 is the bottom left of the world (south-west in game).
     * Canvas x axis is the same, but y is flipped.
     * So our regions "exist" only in negative canvas y.
     * This requires some annoying sign flips for the y coordinates below.
     * We only do this when converting between world and RS coordinates,
     * since the canvas2D API is really hard to work with flips.
     *
     * For reference, the world regions surrounded by the ocean run from
     * (18, 39) to (53, 64)
     */
    const visibleRect = Rect2D.ceilFloor(Rect2D.worldToRegion(context.getVisibleWorldBox()));

    for (let regionX = visibleRect.min.x - 1; regionX <= visibleRect.max.x; regionX++) {
      for (let regionY = visibleRect.min.y - 1; regionY <= visibleRect.max.y; regionY++) {
        const coordinateHash = hashMapRegionCoordinate3Ds(Vec2D.create({ x: regionX, y: regionY }), this.plane);

        const position = Vec2D.create<RegionPosition2D>({ x: regionX, y: regionY });
        const rect = Rect2D.regionToWorld({
          min: position,
          max: Vec2D.add(position, Vec2D.create<RegionDisplacement2D>({ x: 1, y: 1 })),
        });

        const region = this.regions.get(coordinateHash);
        if (region === undefined) continue;

        if (region.image === undefined) {
          context.drawRect({
            fillStyle: "black",
            rect,
          });
          continue;
        }

        context.drawImageSnappedToGrid({
          image: region.image,
          rect,
          alpha: region.alpha,
        });
      }
    }
  }

  /**
   * A map label is pre-rendered text labelling areas such as "Karamja" and
   * "Mudskipper Point".
   */
  private drawVisibleAreaLabels(context: Context2DScaledWrapper): void {
    const labelScale = Math.max(context.getCamera().scale, 1 / 12);

    const visibleRect = Rect2D.ceilFloor(Rect2D.worldToRegion(context.getVisibleWorldBox()));

    for (let regionX = visibleRect.min.x - 1; regionX <= visibleRect.max.x; regionX++) {
      for (let regionY = visibleRect.min.y - 1; regionY <= visibleRect.max.y; regionY++) {
        const labels = this.labelsByRegion?.get(hashMapRegionCoordinate2Ds(Vec2D.create({ x: regionX, y: regionY })));
        if (labels === undefined) continue;

        labels.forEach((label) => {
          const { worldPosition, plane } = label;

          const image = label.image;
          if (plane !== this.plane || image === undefined) return;

          const extent = Vec2D.create<WorldDisplacement2D>({
            x: labelScale * image.width,
            y: labelScale * image.height,
          });

          const centeredPosition = Vec2D.create<WorldPosition2D>({
            x: worldPosition.x - extent.x / 2,
            y: worldPosition.y,
          });

          context.drawImage({
            image,
            imageOffsetInPixels: Vec2D.create({ x: 0, y: 0 }),
            imageExtentInPixels: Vec2D.create({ x: image.width, y: image.height }),
            rect: Rect2D.create({ position: centeredPosition, extent }),
            alpha: 1,
          });
        });
      }
    }
  }

  /**
   * Each player gets a highlighted square (like runelite tile markers), and a
   * label of their name.
   */
  private drawPlayerPositionMarkers(context: Context2DScaledWrapper): void {
    for (const [player, { coords }] of this.playerPositions) {
      const rect = Rect2D.create({
        position: coords,
        extent: Vec2D.create<WorldDisplacement2D>({ x: 1, y: -1 }),
      });

      context.drawRect({
        fillStyle: "rgb(0 200 255 / 50%)",
        insetBorder: { style: "rgb(0 200 255 / 50%)", widthPixels: 5 },
        rect,
      });
      context.drawRSText({
        label: player,
        position: Vec2D.add(coords, Vec2D.create<WorldDisplacement2D>({ x: 0.5, y: -1 })),
      });
    }
  }

  /**
   * Draw square of the currently hovered tile.
   */
  private drawCursor(context: Context2DScaledWrapper): void {
    const world = Pos2D.cursorToWorld({
      cursor: this.cursor.position,
      camera: context.getCamera(),
      canvasExtent: context.getCanvasExtent(),
    });

    const rect = Rect2D.create({
      position: Vec2D.create<WorldPosition2D>({ x: Math.floor(world.x), y: Math.ceil(world.y) }),
      extent: Vec2D.create<WorldDisplacement2D>({ x: 1, y: -1 }),
    });
    context.drawRect({
      fillStyle: "rgb(0 200 255 / 50%)",
      insetBorder: { style: "rgb(0 200 255 / 50%)", widthPixels: 2 },
      rect,
    });
  }

  private drawAll(context: Context2DScaledWrapper): void {
    context.clear();
    this.drawVisibleRegions(context);
    this.drawVisibleIcons(context);
    this.drawVisibleAreaLabels(context);
    this.drawPlayerPositionMarkers(context);
    if (this.cursor.isVisible && this.interactive) {
      this.drawCursor(context);
    }
  }
}
