export interface Point {
  x: number;
  y: number;
}

// どんな画像処理ライブラリが来ても対応できる共通インターフェース
export interface IImageScanner {
  isReady(): boolean;
  scanAndBinarize(source: HTMLImageElement, corners: Point[], outputCanvas: HTMLCanvasElement): boolean;
  invertColors(canvas: HTMLCanvasElement): void;
}

// OpenCVを使った具体的な実装
export class OpenCVScannerAdapter implements IImageScanner {
  public isReady(): boolean {
    // @ts-ignore
    return !!(window.cv && window.cv.Mat);
  }

  public scanAndBinarize(imgElement: HTMLImageElement, corners: Point[], outputCanvas: HTMLCanvasElement): boolean {
    try {
      // @ts-ignore
      const cv = window.cv;
      if (!this.isReady()) return false;

      // 1. 自動リサイズ
      const MAX_DIMENSION = 1500;
      let scale = 1;
      if (imgElement.naturalWidth > MAX_DIMENSION || imgElement.naturalHeight > MAX_DIMENSION) {
        scale = MAX_DIMENSION / Math.max(imgElement.naturalWidth, imgElement.naturalHeight);
      }
      const safeWidth = imgElement.naturalWidth * scale;
      const safeHeight = imgElement.naturalHeight * scale;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = safeWidth;
      tempCanvas.height = safeHeight;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(imgElement, 0, 0, safeWidth, safeHeight);

      const src = cv.imread(tempCanvas);
      const scaledCorners = corners.map(c => ({ x: c.x * scale, y: c.y * scale }));
      const [tl, tr, br, bl] = scaledCorners;

      // 2. 実際の幅と高さを計算（ピタゴラスの定理）
      const widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
      const widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
      const maxWidth = Math.max(widthA, widthB);

      const heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
      const heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
      const maxHeight = Math.max(heightA, heightB);

      const width = Math.round(maxWidth);
      const height = Math.round(maxHeight);

      // 3. 透視投影変換
      const srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
      const dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
      const M = cv.getPerspectiveTransform(srcCoords, dstCoords);
      const warped = new cv.Mat();
      const dsize = new cv.Size(width, height);
      cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

      // 4. グレースケール ＆ 白レベル補正
      const gray = new cv.Mat();
      cv.cvtColor(warped, gray, cv.COLOR_RGBA2GRAY);
      const corrected = gray.clone();
      const data = corrected.data; 
      
      for (let i = 0; i < data.length; i++) {
        data[i] = data[i] >= 160 ? 255 : Math.min(255, data[i] * 1.5);
      }

      cv.imshow(outputCanvas, corrected);

      // メモリ解放
      src.delete(); srcCoords.delete(); dstCoords.delete();
      M.delete(); warped.delete(); gray.delete(); corrected.delete();

      return true;
    } catch (error) {
      console.error("OpenCV Adapter Error:", error);
      return false;
    }
  }

  // 白黒反転処理をアダプターに集約
  public invertColors(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    ctx.putImageData(imageData, 0, 0);
  }
}