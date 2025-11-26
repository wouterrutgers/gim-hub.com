import {
  type WorldPosition2D,
  type CursorDisplacement2D,
  type Transform2D,
  Disp2D,
  type ImagePosition2D,
  type ImageDisplacement2D,
  Rect2D,
  Vec2D,
  Pos2D,
} from "./coordinates";

// Figuring out when to apply scaling is hard, so this wrapper handles
// that by implementing a subset of Context2D rendering commands.
export class Context2DScaledWrapper {
  // Canvas pixel ratio, shouldn't be changed unless canvas is.
  // This ratio is the number of physical canvas pixels per logical CSS pixel.
  // We care about this because we want higher pixel-density screens to not be unviewable.
  private pixelRatio: number;

  private context: CanvasRenderingContext2D;

  // Transform of the view/camera, in world units
  private camera: Transform2D;

  constructor({ pixelRatio, context }: { pixelRatio: number; context: CanvasRenderingContext2D }) {
    this.pixelRatio = pixelRatio;
    this.context = context;
    this.camera = {
      translation: Vec2D.create({ x: 0, y: 0 }),
      scale: 1,
    };
    this.context.imageSmoothingEnabled = false;
  }

  public getCanvasExtent(): CursorDisplacement2D {
    return Vec2D.create({
      x: this.context.canvas.clientWidth,
      y: this.context.canvas.clientHeight,
    });
  }
  public getCamera(): Transform2D {
    return this.camera;
  }

  // Sets context for transformation.
  // The parameters should match your camera, do not pass inverted parameters.
  public setTransform({ translation, scale }: { translation: WorldPosition2D; scale: number }): void {
    // Ratio of world units to physical pixels
    this.camera = {
      translation,
      scale,
    };

    // The rectangular canvas is the view plane of the camera.
    // So view space (0,0) is visible at the center of the canvas.
    // Thus, we offset by half the canvas pixels since (0,0) is in the corner of the canvas.
    this.context.setTransform(
      this.pixelRatio,
      0,
      0,
      this.pixelRatio,
      this.context.canvas.width / 2,
      this.context.canvas.height / 2,
    );
  }

  /**
   * @returns Gives the rectangle that defines the area of world-space that is
   *  visible to the camera.
   */
  public getVisibleWorldBox(): { min: WorldPosition2D; max: WorldPosition2D } {
    const extent = Disp2D.viewToWorld({
      view: Vec2D.create({ x: this.context.canvas.clientWidth, y: this.context.canvas.clientHeight }),
      camera: this.camera,
    });
    return {
      min: Vec2D.add(this.camera.translation, Vec2D.mul(-0.5, extent)),
      max: Vec2D.add(this.camera.translation, Vec2D.mul(0.5, extent)),
    };
  }

  // Sets context for further fill commands
  setFillStyle(fillStyle: string | CanvasGradient | CanvasPattern): void {
    this.context.fillStyle = fillStyle;
  }

  /**
   * Draws a filled rectangle.
   */
  drawRect({
    rect,
    fillStyle,
    insetBorder,
  }: {
    rect: { min: WorldPosition2D; max: WorldPosition2D };
    fillStyle: string;
    opacity?: number;
    insetBorder?: {
      style: string;
      widthPixels: number;
    };
  }): void {
    this.context.fillStyle = fillStyle;
    const { min, max } = Rect2D.worldToView({ min: rect.min, max: rect.max, camera: this.camera });

    const position = min;
    const extent = Vec2D.sub(max, min);

    this.context.fillRect(position.x, position.y, extent.x, extent.y);
    if (insetBorder) {
      this.context.strokeStyle = insetBorder.style;
      this.context.lineWidth = insetBorder.widthPixels;
      this.context.strokeRect(
        position.x + insetBorder.widthPixels / 2,
        position.y + insetBorder.widthPixels / 2,
        extent.x - insetBorder.widthPixels,
        extent.y - insetBorder.widthPixels,
      );
    }
  }

  fillLine({
    worldStartPosition,
    worldEndPosition,
  }: {
    worldStartPosition: WorldPosition2D;
    worldEndPosition: WorldPosition2D;
  }): void {
    const start = Pos2D.worldToView({ world: worldStartPosition, camera: this.camera });
    const end = Pos2D.worldToView({ world: worldEndPosition, camera: this.camera });

    this.context.beginPath();
    this.context.moveTo(start.x, start.y);
    this.context.lineTo(end.x, end.y);
    this.context.stroke();
  }

  clear(): void {
    this.context.clearRect(
      -this.context.canvas.width,
      -this.context.canvas.height,
      2 * this.context.canvas.width,
      2 * this.context.canvas.height,
    );
  }

  /**
   * Draw tile region, stretching it to fit to exact pixel of the adjacent regions.
   */
  drawImageSnappedToGrid({
    image,
    rect: { min, max },
    alpha,
  }: {
    image: ImageBitmap;
    rect: { min: WorldPosition2D; max: WorldPosition2D };
    alpha: number;
  }): void {
    const position = Pos2D.worldToView({ world: min, camera: this.camera });
    const positionNeighbor = Pos2D.worldToView({ world: max, camera: this.camera });

    const previousAlpha = this.context.globalAlpha;
    this.context.globalAlpha = alpha;
    {
      this.context.setTransform(1, 0, 0, 1, 0, 0);

      const dx1 = Math.floor(this.pixelRatio * position.x + this.context.canvas.width / 2);
      const dy1 = Math.floor(this.pixelRatio * position.y + this.context.canvas.height / 2);

      /*
       * Compute dx2,dy2 in a consistent way such that they are actually the dx1/dy1 of adjacent regions.
       * This allows us to then render in a pixel-perfect way, in terms of leaving no gaps.
       */
      const dx2 = Math.floor(this.pixelRatio * positionNeighbor.x + this.context.canvas.width / 2);
      const dy2 = Math.floor(this.pixelRatio * positionNeighbor.y + this.context.canvas.height / 2);

      this.context.drawImage(image, 0, 0, image.width, image.height, dx1, dy1, dx2 - dx1, dy2 - dy1);
      this.context.setTransform(
        this.pixelRatio,
        0,
        0,
        this.pixelRatio,
        this.context.canvas.width / 2,
        this.context.canvas.height / 2,
      );
    }
    this.context.globalAlpha = previousAlpha;
  }

  /**
   * Draws an image.
   * Be careful of the image offset/extent, you need to have knowledge of the underlying image.
   */
  drawImage({
    image,
    imageOffsetInPixels,
    imageExtentInPixels,
    rect,
    alpha,
  }: {
    image: ImageBitmap;
    imageOffsetInPixels: ImagePosition2D;
    imageExtentInPixels: ImageDisplacement2D;
    rect: { min: WorldPosition2D; max: WorldPosition2D };
    alpha: number;
  }): void {
    const { min, max } = Rect2D.worldToView({ min: rect.min, max: rect.max, camera: this.camera });

    const previousAlpha = this.context.globalAlpha;
    this.context.globalAlpha = alpha;
    this.context.setTransform(1, 0, 0, 1, 0, 0);

    const centerOffset = this.context.canvas.width / 2;
    const dx = Math.floor(this.pixelRatio * min.x + centerOffset);
    const dy = Math.floor(this.pixelRatio * min.y + this.context.canvas.height / 2);
    const dw = Math.ceil(this.pixelRatio * (max.x - min.x));
    const dh = Math.ceil(this.pixelRatio * (max.y - min.y));

    this.context.drawImage(
      image,
      imageOffsetInPixels.x,
      imageOffsetInPixels.y,
      imageExtentInPixels.x,
      imageExtentInPixels.y,
      dx,
      dy,
      dw,
      dh,
    );
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, centerOffset, this.context.canvas.height / 2);
    this.context.globalAlpha = previousAlpha;
  }

  drawRSText({ position, label }: { position: WorldPosition2D; label: string }): void {
    const positionView = Pos2D.worldToView({ world: position, camera: this.camera });
    const scale = 32;

    this.context.font = `${scale}px rssmall`;
    this.context.textAlign = "center";
    this.context.lineWidth = 1;
    this.context.textBaseline = "middle";

    this.context.fillStyle = "black";
    this.context.fillText(label, positionView.x + scale / 16, positionView.y + scale / 16);

    this.context.fillStyle = "yellow";
    this.context.fillText(label, positionView.x, positionView.y);
  }
}
