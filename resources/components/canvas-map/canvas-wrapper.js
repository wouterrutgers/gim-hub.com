import { Disp2D, Rect2D, Vec2D, Pos2D } from "./coordinates";

export class Context2DScaledWrapper {
  pixelRatio;
  context;
  camera;
  constructor({ pixelRatio, context }) {
    this.pixelRatio = pixelRatio;
    this.context = context;
    this.camera = {
      translation: Vec2D.create({
        x: 0,
        y: 0,
      }),
      scale: 1,
    };
    this.context.imageSmoothingEnabled = false;
  }
  getCanvasExtent() {
    return Vec2D.create({
      x: this.context.canvas.clientWidth,
      y: this.context.canvas.clientHeight,
    });
  }
  getCamera() {
    return this.camera;
  }
  setTransform({ translation, scale }) {
    this.camera = {
      translation,
      scale,
    };
    this.context.setTransform(
      this.pixelRatio,
      0,
      0,
      this.pixelRatio,
      this.context.canvas.width / 2,
      this.context.canvas.height / 2,
    );
  }
  getVisibleWorldBox() {
    const extent = Disp2D.viewToWorld({
      view: Vec2D.create({
        x: this.context.canvas.clientWidth,
        y: this.context.canvas.clientHeight,
      }),
      camera: this.camera,
    });
    return {
      min: Vec2D.add(this.camera.translation, Vec2D.mul(-0.5, extent)),
      max: Vec2D.add(this.camera.translation, Vec2D.mul(0.5, extent)),
    };
  }
  setFillStyle(fillStyle) {
    this.context.fillStyle = fillStyle;
  }
  drawRect({ rect, fillStyle, insetBorder }) {
    this.context.fillStyle = fillStyle;
    const { min, max } = Rect2D.worldToView({
      min: rect.min,
      max: rect.max,
      camera: this.camera,
    });
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
  fillLine({ worldStartPosition, worldEndPosition }) {
    const start = Pos2D.worldToView({
      world: worldStartPosition,
      camera: this.camera,
    });
    const end = Pos2D.worldToView({
      world: worldEndPosition,
      camera: this.camera,
    });
    this.context.beginPath();
    this.context.moveTo(start.x, start.y);
    this.context.lineTo(end.x, end.y);
    this.context.stroke();
  }
  clear() {
    this.context.clearRect(
      -this.context.canvas.width,
      -this.context.canvas.height,
      2 * this.context.canvas.width,
      2 * this.context.canvas.height,
    );
  }
  drawImageSnappedToGrid({ image, rect: { min, max }, alpha }) {
    const position = Pos2D.worldToView({
      world: min,
      camera: this.camera,
    });
    const positionNeighbor = Pos2D.worldToView({
      world: max,
      camera: this.camera,
    });
    const previousAlpha = this.context.globalAlpha;
    this.context.globalAlpha = alpha;
    {
      this.context.setTransform(1, 0, 0, 1, 0, 0);
      const dx1 = Math.floor(this.pixelRatio * position.x + this.context.canvas.width / 2);
      const dy1 = Math.floor(this.pixelRatio * position.y + this.context.canvas.height / 2);
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
  drawImage({ image, imageOffsetInPixels, imageExtentInPixels, rect, alpha }) {
    const { min, max } = Rect2D.worldToView({
      min: rect.min,
      max: rect.max,
      camera: this.camera,
    });
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
  drawRSText({ position, label }) {
    const positionView = Pos2D.worldToView({
      world: position,
      camera: this.camera,
    });
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
  drawBoatIcon({ position, rotation }) {
    const positionView = Pos2D.worldToView({
      world: position,
      camera: this.camera,
    });
    const scale = 0.42;
    this.context.save();
    this.context.translate(positionView.x, positionView.y);
    this.context.rotate(rotation);
    this.context.scale(scale, scale);
    this.context.translate(-28, -45);
    this.context.fillStyle = "#11131b";
    this.context.fillRect(25, 0, 6, 40);
    this.context.fillStyle = "#613f24";
    this.context.strokeStyle = "#2a1a12";
    this.context.lineWidth = 2;
    this.context.lineJoin = "round";
    this.context.beginPath();
    this.context.moveTo(28, 12);
    this.context.bezierCurveTo(20, 20, 15, 38, 15, 60);
    this.context.lineTo(15, 90);
    this.context.lineTo(41, 90);
    this.context.lineTo(41, 60);
    this.context.bezierCurveTo(41, 38, 36, 20, 28, 12);
    this.context.closePath();
    this.context.fill();
    this.context.stroke();
    this.context.strokeStyle = "#7e5231";
    this.context.lineWidth = 1;
    this.context.beginPath();
    this.context.moveTo(22, 24);
    this.context.bezierCurveTo(19, 40, 19, 60, 21, 80);
    this.context.stroke();
    this.context.beginPath();
    this.context.moveTo(28, 20);
    this.context.bezierCurveTo(27, 40, 27, 60, 28, 84);
    this.context.stroke();
    this.context.beginPath();
    this.context.moveTo(34, 24);
    this.context.bezierCurveTo(36, 40, 36, 60, 34, 80);
    this.context.stroke();
    this.context.restore();
  }
}
