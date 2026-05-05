// 合成アルゴリズムの共通インターフェース
export interface ICompositionStrategy {
  composite(
    ctx: CanvasRenderingContext2D,
    bgImg: HTMLImageElement,
    fgCanvas: HTMLCanvasElement,
    isInverted: boolean
  ): void;
}

// 共通のサイズ計算ロジックを持たせたベースクラス
abstract class BaseCompositionStrategy implements ICompositionStrategy {
  protected calculateLayout(bgWidth: number, bgHeight: number, fgWidth: number, fgHeight: number) {
    const scale = Math.min(bgWidth / fgWidth, bgHeight / fgHeight) * 0.8;
    return {
      drawWidth: fgWidth * scale,
      drawHeight: fgHeight * scale,
      drawX: (bgWidth - fgWidth * scale) / 2,
      drawY: (bgHeight - fgHeight * scale) / 2,
    };
  }

  // 子クラスで必ず実装するメソッド
  abstract composite(ctx: CanvasRenderingContext2D, bgImg: HTMLImageElement, fgCanvas: HTMLCanvasElement, isInverted: boolean): void;
}

// 通常の乗算合成
export class NormalBlendStrategy extends BaseCompositionStrategy {
  composite(ctx: CanvasRenderingContext2D, bgImg: HTMLImageElement, fgCanvas: HTMLCanvasElement, isInverted: boolean): void {
    const layout = this.calculateLayout(bgImg.width, bgImg.height, fgCanvas.width, fgCanvas.height);
    
    // 背景を下塗り
    ctx.fillStyle = isInverted ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, bgImg.width, bgImg.height);
    
    // 習字を描画
    ctx.drawImage(fgCanvas, layout.drawX, layout.drawY, layout.drawWidth, layout.drawHeight);
    
    // 背景写真を乗算で重ねる
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(bgImg, 0, 0, bgImg.width, bgImg.height);
    
    ctx.globalCompositeOperation = 'source-over';
  }
}

// スクリーンブレンド合成
export class ClipBlendStrategy extends BaseCompositionStrategy {
  composite(ctx: CanvasRenderingContext2D, bgImg: HTMLImageElement, fgCanvas: HTMLCanvasElement, isInverted: boolean): void {
    const layout = this.calculateLayout(bgImg.width, bgImg.height, fgCanvas.width, fgCanvas.height);
    
    // 背景を下塗り
    ctx.fillStyle = isInverted ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, bgImg.width, bgImg.height);
    
    // 習字を描画
    ctx.drawImage(fgCanvas, layout.drawX, layout.drawY, layout.drawWidth, layout.drawHeight);
    
    // 背景写真をスクリーンモードで重ねる
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(bgImg, 0, 0, bgImg.width, bgImg.height);
    
    ctx.globalCompositeOperation = 'source-over';
  }
}