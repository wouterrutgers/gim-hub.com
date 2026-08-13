import { fetchMapData } from "../../game/map-data";
import { Pos2D, Vec2D, REGION_IMAGE_PIXEL_EXTENT, ICON_IMAGE_PIXEL_EXTENT, Disp2D, Rect2D } from "./coordinates";

const FOLLOW_ANIMATION_TIME_MS = 300;
const REGION_FADE_IN_SECONDS = 1;
const REGION_FADE_IN_ALPHA_PER_MS = 1 / (REGION_FADE_IN_SECONDS * 1000);
function hashMapRegionCoordinate2Ds({ x, y }) {
  return `${Math.round(x)}_${Math.round(y)}`;
}

function hashMapRegionCoordinate3Ds({ x, y }, plane) {
  return `${Math.round(plane)}_${Math.round(x)}_${Math.round(y)}`;
}
const REGION_X_MIN = 18;
const REGION_X_MAX = 68;
const REGION_Y_MIN = 19;
const REGION_Y_MAX = 160;
const OUTBOUND_IMAGE_FETCHES_CAP = 24;
function* makeInsideOutIterator1D(minInclusive, maxExclusive) {
  if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive) || minInclusive > maxExclusive) {
    throw new Error("min and max must be a well defined interval of integers.");
  }
  const n = Math.abs(maxExclusive - minInclusive);
  const isEven = n % 2 === 0;
  if (isEven) {
    const higher = n / 2 + minInclusive;
    const lower = higher - 1;
    for (let i = 0; i < n / 2; i++) {
      yield {
        lower: lower - i,
        higher: higher + i,
      };
    }
  } else {
    const higher = Math.floor(n / 2) + minInclusive;
    const lower = higher;
    for (let i = 0; i < n / 2; i++) {
      yield {
        lower: lower - i,
        higher: higher + i,
      };
    }
  }
  return undefined;
}
function* makeInsideOutRegionIterator(minInclusive, maxExclusive) {
  const extent = Vec2D.sub(maxExclusive, minInclusive);
  const xGenerator = makeInsideOutIterator1D(minInclusive.x, maxExclusive.x);
  const xSteps = Math.ceil(extent.x / 2);
  const yGenerator = makeInsideOutIterator1D(minInclusive.y, maxExclusive.y);
  const ySteps = Math.ceil(extent.y / 2);
  let xCurrentPair = xGenerator.next();
  let yCurrentPair = yGenerator.next();
  if (ySteps > xSteps) {
    const { lower: lowerX, higher: higherX } = xCurrentPair.value;
    for (let i = 0; i < ySteps - xSteps; i++) {
      const { lower: lowerY, higher: higherY } = yCurrentPair.value;
      yield Vec2D.create({
        x: lowerX,
        y: lowerY,
      });
      if (lowerX !== higherX) {
        yield Vec2D.create({
          x: higherX,
          y: lowerY,
        });
      }
      if (lowerY !== higherY) {
        yield Vec2D.create({
          x: lowerX,
          y: higherY,
        });
      }
      if (lowerX !== higherX && lowerY !== higherY) {
        yield Vec2D.create({
          x: higherX,
          y: higherY,
        });
      }
      yCurrentPair = yGenerator.next();
    }
  } else if (xSteps > ySteps) {
    const { lower: lowerY, higher: higherY } = yCurrentPair.value;
    for (let i = 0; i < xSteps - ySteps; i++) {
      const { lower: lowerX, higher: higherX } = xCurrentPair.value;
      yield Vec2D.create({
        x: lowerX,
        y: lowerY,
      });
      if (lowerX !== higherX) {
        yield Vec2D.create({
          x: higherX,
          y: lowerY,
        });
      }
      if (lowerY !== higherY) {
        yield Vec2D.create({
          x: lowerX,
          y: higherY,
        });
      }
      if (lowerX !== higherX && lowerY !== higherY) {
        yield Vec2D.create({
          x: higherX,
          y: higherY,
        });
      }
      xCurrentPair = xGenerator.next();
    }
  }
  while (!xCurrentPair.done && !yCurrentPair.done) {
    const { lower: lowerX, higher: higherX } = xCurrentPair.value;
    const { lower: lowerY, higher: higherY } = yCurrentPair.value;
    for (let x = lowerX; x <= higherX; x++) {
      yield Vec2D.create({
        x,
        y: higherY,
      });
    }
    for (let y = higherY - 1; y > lowerY; y--) {
      yield Vec2D.create({
        x: higherX,
        y,
      });
    }
    if (lowerY !== higherY) {
      for (let x = higherX; x >= lowerX; x--) {
        yield Vec2D.create({
          x,
          y: lowerY,
        });
      }
    }
    if (lowerX !== higherX) {
      for (let y = lowerY + 1; y < higherY; y++) {
        yield Vec2D.create({
          x: lowerX,
          y,
        });
      }
    }
    yCurrentPair = yGenerator.next();
    xCurrentPair = xGenerator.next();
  }
}
export class CanvasMapRenderer {
  regions;
  camera;
  cursor;
  lastUpdateTime;
  outboundImageFetchesCount;
  iconsAtlas;
  iconsByRegion;
  labelsByRegion;
  playerPositions = new Map();
  getImageUrl;
  interactive = false;
  setInteractive(interactive) {
    if (this.interactive === interactive) return;
    this.interactive = interactive;
    this.forceRenderNextFrame = true;
  }
  forceRenderNextFrame = false;
  plane;
  processMapData(mapData) {
    this.iconsByRegion = new Map();
    for (const regionXString of Object.keys(mapData.icons)) {
      for (const regionYString of Object.keys(mapData.icons[regionXString])) {
        const regionPosition = Vec2D.create({
          x: parseInt(regionXString),
          y: parseInt(regionYString),
        });
        const icons = Object.entries(mapData.icons[regionXString][regionYString])
          .map(([spriteIndex, coordinatesFlat]) => {
            return coordinatesFlat
              .reduce((pairs, _, index, coordinates) => {
                if (index % 2 === 0) {
                  pairs.push([coordinates[index], coordinates[index + 1]]);
                }
                return pairs;
              }, [])
              .map((position) => ({
                spriteIndex: parseInt(spriteIndex),
                worldPosition: Vec2D.create({
                  x: position[0] - 128,
                  y: -position[1],
                }),
              }));
          })
          .flat();
        this.iconsByRegion.set(hashMapRegionCoordinate2Ds(regionPosition), icons);
      }
    }
    this.labelsByRegion = new Map();
    for (const regionXString of Object.keys(mapData.labels)) {
      for (const regionYString of Object.keys(mapData.labels[regionXString])) {
        const regionPosition = Vec2D.create({
          x: parseInt(regionXString),
          y: parseInt(regionYString),
        });
        const labels = Object.entries(mapData.labels[regionXString][regionYString])
          .map(([planeString, XYLabelIDFlat]) => {
            const plane = parseInt(planeString);
            return XYLabelIDFlat.reduce((labels, _, index, labelFlat) => {
              if (index % 3 === 0) {
                const position = Vec2D.create({
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
  constructor(getImageUrl) {
    const INITIAL_X = 3232;
    const INITIAL_Y = -3232;
    const INITIAL_ZOOM = 1 / 4;
    const INITIAL_PLANE = 0;
    this.getImageUrl = getImageUrl;
    this.outboundImageFetchesCount = 0;
    this.regions = new Map();
    this.camera = {
      position: Vec2D.create({
        x: INITIAL_X,
        y: INITIAL_Y,
      }),
      followingAnimation: undefined,
      zoom: INITIAL_ZOOM,
      minZoom: 1 / 32,
      maxZoom: 1.5,
      followPlayer: undefined,
    };
    this.cursor = {
      position: Vec2D.create({
        x: 0,
        y: 0,
      }),
      positionPrevious: Vec2D.create({
        x: 0,
        y: 0,
      }),
      rateSamples: [
        Vec2D.create({
          x: 0,
          y: 0,
        }),
      ],
      accumulatedFrictionMS: 0,
      isVisible: false,
      isDragging: false,
      accumulatedScroll: 0,
    };
    this.lastUpdateTime = performance.now();
    this.plane = INITIAL_PLANE;
  }
  static async load(getImageUrl) {
    const renderer = new CanvasMapRenderer(getImageUrl);
    const iconAtlasPromise = new Promise((resolve) => {
      const ICONS_IN_ATLAS = 123;
      const iconAtlas = new Image(ICONS_IN_ATLAS * ICON_IMAGE_PIXEL_EXTENT.x, ICON_IMAGE_PIXEL_EXTENT.y);
      void getImageUrl("/map-misc/map_icons.webp").then((url) => {
        iconAtlas.src = url;
      });
      iconAtlas.onload = () => {
        resolve(createImageBitmap(iconAtlas));
      };
    });
    const [mapData, iconAtlas_1] = await Promise.all([fetchMapData(), iconAtlasPromise]);
    renderer.processMapData(mapData);
    renderer.iconsAtlas = iconAtlas_1;
    return renderer;
  }
  handlePointerDown() {
    if (this.cursor.isDragging) return;
    this.cursor.rateSamples = [];
    this.cursor.isDragging = true;
    this.onDraggingUpdate?.(this.cursor.isDragging);
  }
  handlePointerUp() {
    if (!this.cursor.isDragging) return;
    this.cursor.isDragging = false;
    this.onDraggingUpdate?.(this.cursor.isDragging);
  }
  handlePointerMove(position) {
    if (!Vec2D.equals(this.cursor.position, position)) {
      this.forceRenderNextFrame = true;
    }
    this.cursor.isVisible = true;
    this.cursor.position = position;
  }
  handlePointerLeave() {
    this.cursor.isDragging = false;
    this.cursor.isVisible = false;
    this.forceRenderNextFrame = true;
    this.onDraggingUpdate?.(this.cursor.isDragging);
  }
  handleScroll(amount) {
    this.cursor.accumulatedScroll += amount;
  }
  setPlane(plane) {
    if (plane !== 0 && plane !== 1 && plane !== 2 && plane !== 3) return;
    this.plane = plane;
    this.onVisiblePlaneUpdate?.(this.plane);
    this.forceRenderNextFrame = true;
  }
  onHoveredCoordinatesUpdate;
  onDraggingUpdate;
  onFollowPlayerUpdate;
  onVisiblePlaneUpdate;
  startFollowingPlayer({ player }) {
    if (!player || !this.playerPositions.has(player)) {
      this.camera.followPlayer = undefined;
      this.camera.followingAnimation = undefined;
      this.onFollowPlayerUpdate?.(undefined);
      return;
    }
    const { coords, plane } = this.playerPositions.get(player);
    this.camera.followPlayer = player;
    this.camera.followingAnimation = {
      from: this.camera.position,
      to: coords,
      timeRemainingMS: FOLLOW_ANIMATION_TIME_MS,
    };
    this.setPlane(plane);
    this.onFollowPlayerUpdate?.(this.camera.followPlayer);
  }
  tryUpdatePlayerPositions(positions, roster) {
    for (const { label, coords: coordsWiki, plane, isOnBoat } of positions) {
      const current = this.playerPositions.get(label);
      const coords = Pos2D.wikiToWorld(coordsWiki);
      if (current && Vec2D.equals(coords, current.coords) && plane === current.plane && isOnBoat === current.isOnBoat)
        continue;
      const previousCoords = current?.coords;
      this.playerPositions.set(label, {
        coords,
        plane,
        isOnBoat,
        previousCoords,
      });
      this.forceRenderNextFrame = true;
      if (this.camera.followPlayer !== label) continue;
      this.camera.followingAnimation = {
        timeRemainingMS: FOLLOW_ANIMATION_TIME_MS,
        from: this.camera.position,
        to: Vec2D.create(coords),
      };
      this.setPlane(plane);
    }
    for (const [label] of this.playerPositions) {
      if (roster.has(label)) continue;
      const deleted = this.playerPositions.delete(label);
      this.forceRenderNextFrame = deleted;
    }
  }
  updateCursorVelocity(elapsed) {
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
  updateCamera({ context, elapsed }) {
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
    if (this.camera.zoom !== previousZoom && !this.camera.followingAnimation) {
      const cameraToCursorDisplacement = Vec2D.sub(this.camera.position, cursorWorldPosition);
      const zoomRatio = this.camera.zoom / previousZoom;
      this.camera.position = Vec2D.add(cursorWorldPosition, Vec2D.mul(zoomRatio, cameraToCursorDisplacement));
    }
    if (this.camera.followPlayer && !this.playerPositions.has(this.camera.followPlayer)) {
      this.startFollowingPlayer({
        player: undefined,
      });
    }
    if (this.cursor.isDragging) {
      this.camera.position = Vec2D.add(this.camera.position, Vec2D.mul(-1.0, cursorWorldDelta));
      this.startFollowingPlayer({
        player: undefined,
      });
    } else if (this.camera.followingAnimation) {
      const { to, from, timeRemainingMS } = this.camera.followingAnimation;
      const t = 1.0 - timeRemainingMS / FOLLOW_ANIMATION_TIME_MS;
      this.camera.position = Vec2D.lerp({
        t,
        from,
        to,
      });
    } else {
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
  updateRegionsAlpha(context, elapsed) {
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
  update(context) {
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
    this.updateCamera({
      context,
      elapsed,
    });
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
      const view = Pos2D.cursorToView({
        cursor: this.cursor.position,
        canvasExtent: context.getCanvasExtent(),
      });
      const world = Pos2D.viewToWorld({
        view,
        camera: context.getCamera(),
      });
      const wiki = Pos2D.worldToWiki(world);
      this.onHoveredCoordinatesUpdate?.(wiki);
    }
    this.cursor.positionPrevious = this.cursor.position;
    this.lastUpdateTime = currentUpdateTime;
  }
  loadVisibleAll(context) {
    const probablyVisibleRegions = Rect2D.ceilFloor(Rect2D.worldToRegion(context.getVisibleWorldBox()));
    for (const region of makeInsideOutRegionIterator(probablyVisibleRegions.min, probablyVisibleRegions.max)) {
      const regionX = region.x;
      const regionY = region.y;
      if (regionX < REGION_X_MIN || regionX > REGION_X_MAX || regionY < REGION_Y_MIN || regionY > REGION_Y_MAX) {
        continue;
      }
      const regionPosition = Vec2D.create({
        x: regionX,
        y: regionY,
      });
      const hash3D = hashMapRegionCoordinate3Ds(regionPosition, this.plane);
      const hash2D = hashMapRegionCoordinate2Ds(regionPosition);
      const rateLimited = this.outboundImageFetchesCount > OUTBOUND_IMAGE_FETCHES_CAP;
      if (!this.regions.has(hash3D) && !rateLimited) {
        const image = new Image(REGION_IMAGE_PIXEL_EXTENT.x, REGION_IMAGE_PIXEL_EXTENT.y);
        const regionFileBaseName = `${this.plane}_${regionX}_${regionY}`;
        this.outboundImageFetchesCount += 1;
        const region = {
          alpha: 0,
          position: Vec2D.create(regionPosition),
        };
        image.onload = () => {
          this.outboundImageFetchesCount -= 1;
          createImageBitmap(image)
            .then((bitmap) => {
              region.image = bitmap;
            })
            .catch((reason) => {
              console.error("Failed to load image bitmap for:", image.src, reason);
            });
        };
        image.onerror = () => {
          this.outboundImageFetchesCount -= 1;
        };
        void this.getImageUrl(`/map-tiles/${regionFileBaseName}.webp`).then((url) => {
          if (url) {
            image.src = url;
            return;
          }
          this.outboundImageFetchesCount -= 1;
        });
        this.regions.set(hash3D, region);
      }
      const labels = this.labelsByRegion?.get(hash2D);
      if (labels === undefined) continue;
      labels.forEach((label) => {
        const { labelID, plane } = label;
        if (plane !== this.plane) return;
        if (!label.imageFetch && !rateLimited) {
          label.imageFetch = {
            loaded: false,
            asset: undefined,
          };
          const image = new Image();
          this.outboundImageFetchesCount += 1;
          void this.getImageUrl(`/map-misc/${labelID}.webp`).then((url) => {
            image.src = url;
          });
          image.onload = () => {
            this.outboundImageFetchesCount -= 1;
            createImageBitmap(image)
              .then((bitmap) => {
                label.imageFetch.asset = bitmap;
                label.imageFetch.loaded = true;
              })
              .catch((reason) => console.error("Failed to load image bitmap for", image.src, reason));
          };
          image.onerror = () => {
            this.outboundImageFetchesCount -= 1;
          };
        }
      });
    }
  }
  drawVisibleIcons(context) {
    const ICON_HIDE_THRESHOLD = 0.55;
    if (context.getCamera().scale > ICON_HIDE_THRESHOLD) return;
    const iconScale = 16 * Math.max(context.getCamera().scale, 1 / 8);
    const visibleRect = Rect2D.ceilFloor(Rect2D.worldToRegion(context.getVisibleWorldBox()));
    for (let regionX = visibleRect.min.x - 1; regionX <= visibleRect.max.x; regionX++) {
      for (let regionY = visibleRect.min.y - 1; regionY <= visibleRect.max.y; regionY++) {
        const mapIcons = this.iconsByRegion?.get(
          hashMapRegionCoordinate2Ds(
            Vec2D.create({
              x: regionX,
              y: regionY,
            }),
          ),
        );
        if (!mapIcons || !this.iconsAtlas) continue;
        const offset = Vec2D.create({
          x: -iconScale / 2,
          y: -iconScale / 2,
        });
        const extent = Vec2D.create({
          x: iconScale,
          y: iconScale,
        });
        mapIcons.forEach(({ spriteIndex, worldPosition }) => {
          const position = Vec2D.add(worldPosition, offset);
          context.drawImage({
            image: this.iconsAtlas,
            imageOffsetInPixels: Vec2D.create({
              x: spriteIndex * ICON_IMAGE_PIXEL_EXTENT.x,
              y: 0,
            }),
            imageExtentInPixels: ICON_IMAGE_PIXEL_EXTENT,
            rect: Rect2D.create({
              position,
              extent,
            }),
            alpha: 1,
          });
        });
      }
    }
  }
  drawVisibleRegions(context) {
    const visibleRect = Rect2D.ceilFloor(Rect2D.worldToRegion(context.getVisibleWorldBox()));
    for (let regionX = visibleRect.min.x - 1; regionX <= visibleRect.max.x; regionX++) {
      for (let regionY = visibleRect.min.y - 1; regionY <= visibleRect.max.y; regionY++) {
        const coordinateHash = hashMapRegionCoordinate3Ds(
          Vec2D.create({
            x: regionX,
            y: regionY,
          }),
          this.plane,
        );
        const position = Vec2D.create({
          x: regionX,
          y: regionY,
        });
        const rect = Rect2D.regionToWorld({
          min: position,
          max: Vec2D.add(
            position,
            Vec2D.create({
              x: 1,
              y: 1,
            }),
          ),
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
  drawVisibleAreaLabels(context) {
    const LABEL_HIDE_THRESHOLD = 0.55;
    if (context.getCamera().scale > LABEL_HIDE_THRESHOLD) return;
    const labelScale = Math.max(context.getCamera().scale, 1 / 12);
    const visibleRect = Rect2D.ceilFloor(Rect2D.worldToRegion(context.getVisibleWorldBox()));
    for (let regionX = visibleRect.min.x - 1; regionX <= visibleRect.max.x; regionX++) {
      for (let regionY = visibleRect.min.y - 1; regionY <= visibleRect.max.y; regionY++) {
        const labels = this.labelsByRegion?.get(
          hashMapRegionCoordinate2Ds(
            Vec2D.create({
              x: regionX,
              y: regionY,
            }),
          ),
        );
        if (!labels) continue;
        labels.forEach((label) => {
          const { worldPosition, plane } = label;
          const image = label.imageFetch?.asset;
          if (plane !== this.plane || !image) return;
          const extent = Vec2D.create({
            x: labelScale * image.width,
            y: labelScale * image.height,
          });
          const centeredPosition = Vec2D.create({
            x: worldPosition.x - extent.x / 2,
            y: worldPosition.y,
          });
          context.drawImage({
            image,
            imageOffsetInPixels: Vec2D.create({
              x: 0,
              y: 0,
            }),
            imageExtentInPixels: Vec2D.create({
              x: image.width,
              y: image.height,
            }),
            rect: Rect2D.create({
              position: centeredPosition,
              extent,
            }),
            alpha: 1,
          });
        });
      }
    }
  }
  drawPlayerPositionMarkers(context) {
    const zoom = context.getCamera().scale;
    const labelOffsetBoat = -1 - 8.5 * zoom;
    for (const [player, { coords, isOnBoat, previousCoords }] of this.playerPositions) {
      const rect = Rect2D.create({
        position: coords,
        extent: Vec2D.create({
          x: 1,
          y: -1,
        }),
      });
      if (isOnBoat) {
        let rotation = Math.PI / 2;
        if (previousCoords && !Vec2D.equals(coords, previousCoords)) {
          const dx = coords.x - previousCoords.x;
          const dy = coords.y - previousCoords.y;
          rotation = Math.atan2(dy, dx) + Math.PI / 2;
        }
        context.drawBoatIcon({
          position: Vec2D.add(
            coords,
            Vec2D.create({
              x: 0.5,
              y: -0.5,
            }),
          ),
          rotation,
        });
        context.drawRSText({
          label: player,
          position: Vec2D.add(
            coords,
            Vec2D.create({
              x: 0.5,
              y: labelOffsetBoat,
            }),
          ),
        });
      } else {
        context.drawRect({
          fillStyle: "rgb(0 200 255 / 50%)",
          insetBorder: {
            style: "rgb(0 200 255 / 50%)",
            widthPixels: 5,
          },
          rect,
        });
        context.drawRSText({
          label: player,
          position: Vec2D.add(
            coords,
            Vec2D.create({
              x: 0.5,
              y: -1,
            }),
          ),
        });
      }
    }
  }
  drawCursor(context) {
    const world = Pos2D.cursorToWorld({
      cursor: this.cursor.position,
      camera: context.getCamera(),
      canvasExtent: context.getCanvasExtent(),
    });
    const rect = Rect2D.create({
      position: Vec2D.create({
        x: Math.floor(world.x),
        y: Math.ceil(world.y),
      }),
      extent: Vec2D.create({
        x: 1,
        y: -1,
      }),
    });
    context.drawRect({
      fillStyle: "rgb(0 200 255 / 50%)",
      insetBorder: {
        style: "rgb(0 200 255 / 50%)",
        widthPixels: 2,
      },
      rect,
    });
  }
  drawAll(context) {
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
