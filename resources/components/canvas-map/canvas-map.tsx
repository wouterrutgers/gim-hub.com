import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { Context2DScaledWrapper } from "./canvas-wrapper";
import { CanvasMapRenderer, type LabelledCoordinates } from "./canvas-map-renderer";
import { useGroupStateContext } from "../../context/group-state-context";
import type { GroupState } from "../../api/api";
import { Vec2D, type WikiPosition2D } from "./coordinates";

import "./canvas-map.css";
import { createPortal } from "react-dom";

const memberCoordinatesSelector = (state: GroupState | undefined): LabelledCoordinates[] => {
  if (!state) return [];
  return [
    ...state.members
      .entries()
      .filter(([_, state]) => state.coordinates)
      .map(([name, state]) => ({ label: name, coords: state.coordinates!.coords, plane: state.coordinates!.plane })),
  ];
};

export const CanvasMap = ({ interactive }: { interactive: boolean }): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelRatioRef = useRef<number>(1);
  const [renderer, setRenderer] = useState<CanvasMapRenderer>();
  const [dragging, setDragging] = useState<boolean>();
  const [coordinates, setCoordinates] = useState<WikiPosition2D>();
  const [followedPlayer, setFollowedPlayer] = useState<string>();
  const [visiblePlane, setVisiblePlane] = useState<number>(0);
  const animationFrameHandleRef = useRef<number>(undefined);
  const memberCoordinates = useGroupStateContext(memberCoordinatesSelector);

  if (memberCoordinates) {
    renderer?.tryUpdatePlayerPositions(memberCoordinates);
  }

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const devicePixelRatio = window.devicePixelRatio;
    pixelRatioRef.current = devicePixelRatio;
    canvas.width = Math.max(canvas.offsetWidth * devicePixelRatio, 1);
    canvas.height = Math.max(canvas.offsetHeight * devicePixelRatio, 1);

    const context = new Context2DScaledWrapper({
      pixelRatio: pixelRatioRef.current,
      context: canvas.getContext("2d")!,
    });
    if (renderer) {
      renderer.forceRenderNextFrame = true;
      renderer.update(context);
    }
  }, [renderer]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return (): void => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas]);

  const render = useCallback((): void => {
    if (canvasRef.current === null) {
      console.error("No canvas.");
      return;
    }

    if (renderer === undefined) return;

    const context = new Context2DScaledWrapper({
      pixelRatio: pixelRatioRef.current,
      context: canvasRef.current.getContext("2d")!,
    });

    renderer.update(context);
    animationFrameHandleRef.current = window.requestAnimationFrame(() => {
      render();
    });
  }, [renderer]);

  useEffect(() => {
    console.info("Rebuilding renderer.");

    CanvasMapRenderer.load()
      .then((renderer) => {
        setRenderer(renderer);
      })
      .catch((reason) => {
        console.error("Failed to build renderer:", reason);
      });
  }, []);

  useEffect(() => {
    if (renderer === undefined) return;

    renderer.onHoveredCoordinatesUpdate = setCoordinates;
    renderer.onDraggingUpdate = setDragging;
    renderer.onFollowPlayerUpdate = setFollowedPlayer;
    renderer.onVisiblePlaneUpdate = setVisiblePlane;

    return (): void => {
      renderer.onHoveredCoordinatesUpdate = undefined;
      renderer.onDraggingUpdate = undefined;
      renderer.onFollowPlayerUpdate = undefined;
      renderer.onVisiblePlaneUpdate = undefined;
    };
  }, [renderer]);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (animationFrameHandleRef.current) {
      window.cancelAnimationFrame(animationFrameHandleRef.current);
    }

    render();
  }, [render]);

  const handlePointerMove = useCallback(
    ({ clientX, clientY }: { clientX: number; clientY: number }) => {
      renderer?.handlePointerMove(Vec2D.create({ x: clientX, y: clientY }));
    },
    [renderer],
  );
  const handlePointerUp = useCallback(() => {
    renderer?.handlePointerUp();
  }, [renderer]);
  const handlePointerDown = useCallback(() => {
    renderer?.handlePointerDown();
  }, [renderer]);
  const handlePointerLeave = useCallback(() => {
    renderer?.handlePointerLeave();
  }, [renderer]);
  const handleScroll = useCallback(
    ({ deltaY }: { deltaY: number }) => {
      renderer?.handleScroll(deltaY);
    },
    [renderer],
  );
  const handleSelectPlane = useCallback(
    (plane: number) => {
      renderer?.setPlane(plane);
    },
    [renderer],
  );

  const coordinatesView = coordinates ? `X: ${coordinates.x}, Y: ${coordinates.y}` : undefined;
  const draggingClass = dragging ? "dragging" : "";
  const interactiveClass = interactive ? "interactive" : "";

  const planeSelect = (
    <div id="canvas-map-plane-select-container" className="rsborder-tiny rsbackground">
      <select
        id="canvas-map-plane-select"
        onChange={(e) => {
          const plane = parseInt(e.target.options[e.target.selectedIndex].value);
          if (visiblePlane === plane) return;
          handleSelectPlane(plane);
        }}
        value={visiblePlane}
      >
        <option value={0}>Plane: 1</option>
        <option value={1}>Plane: 2</option>
        <option value={2}>Plane: 3</option>
        <option value={3}>Plane: 4</option>
      </select>
    </div>
  );
  const teleportButtons = [];
  for (const { label: player } of memberCoordinates) {
    teleportButtons.push(
      <button
        key={player}
        className={`${player === followedPlayer ? "canvas-map-selected-teleport-button" : ""} men-button `}
        onClick={() => {
          if (!renderer) return;
          renderer.startFollowingPlayer({
            player,
          });
          renderer.forceRenderNextFrame = true;
        }}
      >
        {player}
      </button>,
    );
  }

  const backgroundMap = (
    <div id="canvas-map-container">
      <canvas
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleScroll}
        id="canvas-map"
        className={`${draggingClass} ${interactiveClass}`}
        ref={canvasRef}
      />
    </div>
  );

  let portal = undefined;
  const portalDestination = document.getElementById("main-content");
  if (portalDestination && interactive) {
    const coordinateIndicator = (
      <div key="coordinates" id="canvas-map-coordinates">
        {coordinatesView}
      </div>
    );
    const controls = (
      <div key="controls" id="canvas-map-controls">
        {planeSelect}
        {teleportButtons}
      </div>
    );

    portal = createPortal([coordinateIndicator, controls], portalDestination);
  }

  return (
    <>
      {backgroundMap}
      {portal}
    </>
  );
};
