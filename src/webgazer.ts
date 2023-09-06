import { createDangerToast, createDefaultToast } from './toast';
import { getUidFromEl, getWindowIdFromEl } from './util';

type CameraConstraints = {
  video: {
    facingMode: 'user' | string;
    height: {
      min: number;
      ideal: number;
      max: number;
    };
    width: {
      min: number;
      ideal: number;
      max: number;
    };
  };
};

type Webgazer = {
  addMouseEventListeners: () => Webgazer;
  addRegression: (name: string) => Webgazer;
  addRegressionModule: (name: string) => Webgazer;
  addTrackerModule: (name: string, constructor: Function) => Webgazer;
  applyKalmanFilter: (val: boolean) => Webgazer;
  begin: (onFail?: Function) => Webgazer;
  clearData: () => Promise<Webgazer>;
  clearGazeListener: () => Webgazer;
  computeValidationBoxSize: () => Webgazer;
  detectCompatibility: () => Webgazer;
  end: () => Webgazer;
  getCurrentPrediction: (regIndex?: number) => {
    x: number;
    y: number;
  } | null;
  getStoredPoints: () => Array<Array<any>>;
  getTracker: () => string;
  getVideoElementCanvas: () => HTMLCanvasElement;
  getVideoPreviewToCameraResolutionRatio: () => Webgazer;
  isReady: () => boolean;

  params: {
    showVideoPreview: boolean;
  };
  pause: () => Webgazer;
  recordScreenPosition: (x: number, y: number, eventType?: string) => Webgazer;
  reg: {
    RidgeReg: Function;
    RidgeWeightedReg: Function;
    RidgeRegThreaded: Function;
  };
  removeMouseEventListeners: () => Webgazer;
  resume: () => Promise<Webgazer>;
  saveDataAcrossSessions: (val: boolean) => Webgazer;
  setCameraConstraints: (params: CameraConstraints) => Webgazer;
  setGazeListener: (
    callback: (
      gazeData: { x: number; y: number } | null,
      elapsedTime: number
    ) => void
  ) => Webgazer;
  setRegression: (
    regressionString: 'ridge' | 'weightedRidge' | 'threadedRidge'
  ) => Webgazer;
  setStaticVideo: (videoLoc: string) => Webgazer;
  setTracker: (
    libraryString: 'clmtrackr' | 'js_objectdetect' | 'trackingjs'
  ) => Webgazer;
  setVideoElementCanvas: (canvas: any) => Webgazer;
  setVideoViewerSize: (width: string, height: string) => Webgazer;
  showFaceFeedbackbox: (val: boolean) => Webgazer;
  showFaceOverlay: (val: boolean) => Webgazer;
  showPredictionPoints: (val: boolean) => Webgazer;
  showVideo: (val: boolean) => Webgazer;
  showVideoPreview: (val: boolean) => Webgazer;
  stopVideo: () => Webgazer;
  storePoints: (x: string, y: string, k: string) => Webgazer;
  tracker: {};
  util: {};
};

declare const webgazer: Webgazer;

const videoPlaybackElId = 'webgazerVideoFeed';
const videoCanvasId = 'webgazerVideoCanvas';
const faceOverlayCanvasId = 'webgazerFaceOverlay';
const webgazerFaceFeedbackBoxId = 'webgazerFaceFeedbackBox';
const webgazerVideoContainerId = 'webgazerVideoContainer';

function setToBottomLeft(el: HTMLElement) {
  el.style.position = 'fixed';
  const topPx = el.style.top;
  if (topPx) {
    el.style.top = null;
    el.style.bottom = topPx;
  } else {
    el.style.bottom = '0px';
  }
}

function setupVideoPreview() {
  setToBottomLeft(document.getElementById(webgazerVideoContainerId));
  setToBottomLeft(document.getElementById(videoPlaybackElId));
  setToBottomLeft(document.getElementById(videoCanvasId));
  setToBottomLeft(document.getElementById(faceOverlayCanvasId));
  setToBottomLeft(document.getElementById(webgazerFaceFeedbackBoxId));
}

let previousBlockLookedAt: HTMLElement = null;

function isRoamBlockEl(el: HTMLElement) {
  return el.classList.contains('rm-block');
}

function findClosestRoamBlock(el: HTMLElement): HTMLElement {
  if (!el) return null;
  if (isRoamBlockEl(el)) {
    return el;
  } else {
    const parent = el?.parentElement;
    return findClosestRoamBlock(parent);
  }
}

function makeNewPosition() {
  var h = document.body.clientHeight - 50;
  var w = document.body.clientWidth - 50;

  var nh = Math.floor(Math.random() * h);
  var nw = Math.floor(Math.random() * w);

  return [nh, nw];
}

function animate(
  render: Function,
  from: { x: number; y: number },
  to: { x: number; y: number },
  duration: number,
  timeFn: Function
): Promise<boolean> {
  let startTime = performance.now();
  return new Promise((resolve) => {
    requestAnimationFrame(function step(time) {
      // TODO but can't this be set to false like right after this statement b4 the render? idk
      if (!dotCalibrationEnabled) return resolve(false);
      let pTime = (time - startTime) / duration;
      if (pTime > 1) pTime = 1;
      const newCoords = {
        x: from.x + (to.x - from.x) * timeFn(pTime),
        y: from.y + (to.y - from.y) * timeFn(pTime),
      };
      render(newCoords);
      if (pTime < 1) {
        requestAnimationFrame(step);
      } else {
        return resolve(true);
      }
    });
  });
}

function easeInOut(k: number) {
  return 0.5 * (Math.sin((k - 0.5) * Math.PI) + 1);
}

function animateDotRandom() {
  // TODO currently too slow so switching to a
  // https://stackoverflow.com/a/65228641/10175127
  var newq = makeNewPosition();
  const el = document.querySelector(`.${calibrationDotElClass}`) as HTMLElement;
  if (!el) return; // in case el is removed
  var elBounds = el.getBoundingClientRect();
  const elOffset = {
    top: elBounds.top + window.scrollY,
    left: elBounds.left + window.scrollX,
  };
  var speed = calcSpeed([elOffset.top, elOffset.left], newq);
  animate(
    ({ x, y }: { x: number; y: number }) => {
      if (!el?.parentNode) return;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    },
    {
      x: elOffset.left,
      y: elOffset.top,
    },
    {
      x: newq[1],
      y: newq[0],
    },
    speed,
    easeInOut
  ).then(() => {
    if (dotCalibrationEnabled) animateDotRandom();
  });
}

let calibrationClock = performance.now();
const calibrationTickSize = 500;
function saveDataPointAt(x: number, y: number) {
  const now = performance.now();
  if (now < calibrationClock + calibrationTickSize) {
    return;
  } else {
    calibrationClock = now;
    console.log(`Recording click event at (${x}, ${y})!`);
    webgazer.recordScreenPosition(x, y, 'click');
  }
}

function calcSpeed(prev: Array<number>, next: Array<number>) {
  // TODO I want the speed to be consistent despite how far or close it's going. So I want the duration to be variable but the speed to feel right I guess... might not happen in this fn
  var x = Math.abs(prev[1] - next[1]);
  var y = Math.abs(prev[0] - next[0]);

  var greatest = x > y ? x : y;

  // var speedModifier = 0.25;
  var speedModifier = 0.05;

  var speed = Math.ceil(greatest / speedModifier);

  return speed;
}

const calibrationDotElClass = 'calibration-dot';
function startCalibrationSequence() {
  const calibrationDotEl = document.createElement('div');
  calibrationDotEl.classList.add(calibrationDotElClass);
  // TODO don't want so much data always at the starting place. solution is to change starting place randomly and/or put a delay b4 u start collecting data. for now idc I guess...
  // const [y, x] = makeNewPosition();
  calibrationDotEl.style.cssText = `display: block; z-index: 99999; opacity: 0.8; top: 0; left: 0; width: 15px; height: 15px; background-color: red; position: fixed; font-size: 10px; font-weight: bold`;
  document.body.appendChild(calibrationDotEl);

  animateDotRandom();
}

function stopCalibrationSequence() {
  document.querySelector(`.${calibrationDotElClass}`).remove();
}

function clearPrevBlock(previousBlockLookedAt: HTMLElement) {
  const prevBlockMainContent = previousBlockLookedAt.querySelector(
    '.rm-block-main'
  ) as HTMLElement;
  if (!prevBlockMainContent) return;
  prevBlockMainContent.style.backgroundColor = null;
}

/*
 * Calculate percentage accuracy for each prediction based on distance of
 * the prediction point from the centre point (uses the window height as
 * lower threshold 0%)
 */
function calculatePredictionAccuracy(
  dotCoords: { x: number; y: number },
  predictionCoords: { x: number; y: number }
) {
  if (!predictionCoords?.x || !predictionCoords?.y) return;
  var h = document.body.clientHeight;

  // Calculate distance between each prediction and staring point
  var xDiff = dotCoords.x - predictionCoords.x;
  var yDiff = dotCoords.y - predictionCoords.y;
  var distance = Math.sqrt(xDiff * xDiff + yDiff * yDiff);

  // Calculate precision percentage
  var halfWindowHeight = h / 2;

  var precision = 0;
  if (distance <= halfWindowHeight && distance > -1) {
    precision = 100 - (distance / halfWindowHeight) * 100;
  } else if (distance > halfWindowHeight) {
    precision = 0;
  } else if (distance > -1) {
    precision = 100;
  }

  return Math.round(precision);
}

let mouseCalibrationEnabled = false;
let dotCalibrationEnabled = false;
// toggle with so you can take a moment to blink XD
let recordData = true;
let loopDuration = performance.now();
export async function setupWebgazer(): Promise<Webgazer> {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await webgazer
    .setRegression('threadedRidge')
    //.setTracker('clmtrackr') TODO what's this?
    .saveDataAcrossSessions(true)
    .setGazeListener(function (data, elapsedTime) {
      if (!data?.x || !data?.y) return;

      // const now = performance.now();
      // console.log({ duration: now - loopDuration, data });
      // loopDuration = now;
      if (dotCalibrationEnabled) {
        // save click event at dot location
        const el = document.querySelector(
          `.${calibrationDotElClass}`
        ) as HTMLElement;
        if (el) {
          var elBounds = el.getBoundingClientRect();
          const elOffset = {
            y: elBounds.top + window.scrollY,
            x: elBounds.left + window.scrollX,
          };
          if (recordData) {
            webgazer.recordScreenPosition(elOffset.x, elOffset.y, 'click');
          }
          const percentAccuracy = calculatePredictionAccuracy(elOffset, data);
          el.innerHTML = `${percentAccuracy}%`;
          if (percentAccuracy >= 95) el.style.color = 'green';
          else if (percentAccuracy >= 80 && percentAccuracy <= 95)
            el.style.color = 'orange';
          else el.style.color = 'black';
        }
      }

      // const closestElement = document.elementFromPoint(
      //   data.x,
      //   data.y
      // ) as HTMLElement;
      // const closestRoamBlock = findClosestRoamBlock(closestElement);
      // if (!closestRoamBlock) {
      //   if (previousBlockLookedAt) {
      //     clearPrevBlock(previousBlockLookedAt);
      //   }
      //   return;
      // }
      // if (closestRoamBlock.isEqualNode(previousBlockLookedAt)) return;
      // if (previousBlockLookedAt) {
      //   clearPrevBlock(previousBlockLookedAt);
      // }
      // previousBlockLookedAt = closestRoamBlock;
      // const mainBlockContent = closestRoamBlock.querySelector(
      //   '.rm-block-main'
      // ) as HTMLElement;
      // if (!mainBlockContent) return;
      // mainBlockContent.style.backgroundColor = 'gray';
    })
    .showVideoPreview(true)
    .showPredictionPoints(true)
    .applyKalmanFilter(true)
    .begin();

  document.addEventListener('keydown', (e) => {
    // TODO check if this even works (i.e. returns false when paused/ended)
    if (!webgazer.isReady()) return;

    // TODO, fragile cuz like what if I press the keybind RIGHT when the thing kinda looks away to a different block or nothing (so sets to null)?
    if (e.key === 'F4') {
      e.preventDefault();
      if (!previousBlockLookedAt) return;
      const windowId = getWindowIdFromEl(previousBlockLookedAt);
      console.log({ windowId, previousBlockLookedAt });
      window.roamAlphaAPI.ui.setBlockFocusAndSelection({
        location: {
          'block-uid': getUidFromEl(previousBlockLookedAt),
          'window-id': windowId,
        },
      });
    } else if (e.key === 'F8') {
      e.preventDefault();
      if (dotCalibrationEnabled) {
        createDangerToast(
          'Dot calibration already enabled - disable that first.'
        );
        return;
      }
      if (!mouseCalibrationEnabled) {
        mouseCalibrationEnabled = true;
        createDefaultToast('Mouse calibration enabled');
      } else {
        mouseCalibrationEnabled = false;
        createDefaultToast('Mouse calibration disabled');
      }
    } else if (e.key === 'F9') {
      e.preventDefault();
      if (mouseCalibrationEnabled) {
        createDangerToast(
          'Mouse calibration already enabled - disable that first.'
        );
        return;
      }
      if (!dotCalibrationEnabled) {
        startCalibrationSequence();
        createDefaultToast('Dot calibratrion enabled');
        dotCalibrationEnabled = true;
      } else {
        dotCalibrationEnabled = false;
        stopCalibrationSequence();
        createDefaultToast('Dot calibratrion disabled');
      }
    } else if (e.key === 'F10') {
      e.preventDefault();
      recordData = !recordData;
      if (recordData) {
        createDefaultToast(`Collect data: true`);
      } else {
        createDangerToast(`Collect data: false`);
      }
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (!mouseCalibrationEnabled) return;
    if (recordData) {
      saveDataPointAt(e.clientX, e.clientY);
    }
  });
  setTimeout(setupVideoPreview, 4000);

  return webgazer;
}
