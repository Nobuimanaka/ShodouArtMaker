import React, { useState, useRef, useEffect, useMemo } from 'react';
import { OpenCVScannerAdapter, type Point } from './utils/cvAdapter';
import { NormalBlendStrategy, ClipBlendStrategy, type ICompositionStrategy } from './utils/compositionStrategy';
import './App.css';

// -- Icons (Inline SVG) --
const UploadIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const ImageIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
// -------------------------

function App() {
  const [step, setStep] = useState<number>(1);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [isCvReady, setIsCvReady] = useState<boolean>(false);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [compositeStyle, setCompositeStyle] = useState<'normal' | 'clip'>('normal');
  const [isInverted, setIsInverted] = useState<boolean>(false);

  // ドラッグ状態の管理
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

  const scanner = useMemo(() => new OpenCVScannerAdapter(), []);

  // OpenCVの読み込み待機
  useEffect(() => {
    const checkOpenCV = setInterval(() => {
      if (scanner.isReady()) {
        setIsCvReady(true);
        clearInterval(checkOpenCV);
      }
    }, 500);
    return () => clearInterval(checkOpenCV);
  }, [scanner]);

  // 【Strategyの動的選択】
  const blendStrategy: ICompositionStrategy = useMemo(() => {
    return compositeStyle === 'normal' ? new NormalBlendStrategy() : new ClipBlendStrategy();
  }, [compositeStyle]);

  // 合成実行
  useEffect(() => {
    if (step === 4 && bgImageUrl) {
      const bgImg = new Image();
      bgImg.onload = () => {
        const compCanvas = compositeCanvasRef.current;
        const procCanvas = processedCanvasRef.current;
        if (!compCanvas || !procCanvas) return;

        const ctx = compCanvas.getContext('2d');
        if (!ctx) return;

        compCanvas.width = bgImg.width;
        compCanvas.height = bgImg.height;

        blendStrategy.composite(ctx, bgImg, procCanvas, isInverted);
      };
      bgImg.src = bgImageUrl;
    }
  }, [step, bgImageUrl, blendStrategy, isInverted]);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRawImage(URL.createObjectURL(file));
      setCorners([]);
      setBgImageUrl(null);
      setCompositeStyle('normal');
      setIsInverted(false);
      setStep(2);
      e.target.value = '';
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (corners.length >= 4) return;
    if (draggingIndex !== null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCorners([...corners, {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    }]);
  };

  // --- ドラッグ処理 ---
  const getPointerPosition = (e: React.PointerEvent): Point | null => {
    const container = imageContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePinPointerDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingIndex(index);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIndex === null) return;
    e.preventDefault();
    const pos = getPointerPosition(e);
    if (!pos) return;
    setCorners(prev => prev.map((c, i) => i === draggingIndex ? pos : c));
  };

  const handlePointerUp = () => {
    setDraggingIndex(null);
  };


  const executeTransform = () => {
    if (corners.length < 4) return;
    const img = new Image();
    img.onload = () => {
      if (processedCanvasRef.current) {
        const realCorners = corners.map(c => ({
          x: c.x * img.naturalWidth,
          y: c.y * img.naturalHeight
        }));
        
        const success = scanner.scanAndBinarize(img, realCorners, processedCanvasRef.current);
        if (success) {
          setIsInverted(false);
          setStep(3);
        } else {
          alert("画像処理中にエラーが発生しました。");
        }
      }
    };
    img.src = rawImage!;
  };

  const toggleInvert = () => {
    if (processedCanvasRef.current) {
      scanner.invertColors(processedCanvasRef.current);
      setIsInverted(!isInverted);
    }
  };

  const handleCompositeImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBgImageUrl(URL.createObjectURL(file));
      setStep(4);
      e.target.value = '';
    }
  };

  // Web Share API が利用可能かどうか
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
      try {
        const testFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
        setCanShare(navigator.canShare({ files: [testFile] }));
      } catch {
        setCanShare(false);
      }
    }
  }, []);

  // 端末本体に直接ダウンロード保存（Android: Downloadsフォルダ → ギャラリーで参照可能）
  const downloadImage = (canvas: HTMLCanvasElement | null, fileName: string) => {
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        alert("画像の生成に失敗しました。");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.9);
  };

  // SNSやアプリへ共有（Web Share API）
  const shareImage = async (canvas: HTMLCanvasElement | null, fileName: string) => {
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) {
        alert("画像の生成に失敗しました。");
        return;
      }
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      try {
        await navigator.share({
          files: [file],
          title: '書道ArtMaker',
        });
      } catch (error) {
        console.log("共有がキャンセルされました:", error);
      }
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="app-container">
      <h1 className="serif-text">書道ArtMaker</h1>

      {/* Stepper */}
      <div className="stepper">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`step-item ${step === s ? 'active' : ''} ${step > s ? 'completed' : ''}`}>
            {step > s ? <CheckIcon /> : s}
          </div>
        ))}
      </div>

      {/* ステップ 1 */}
      {step === 1 && (
        <div className="panel fade-in">
          <h2>1. 作品をアップロード</h2>
          <p>カメラで撮影した書道の半紙画像をアップロードしてください。</p>
          
          <label className="upload-area">
            <UploadIcon />
            <span>画像を撮影または選択</span>
            <p>タップしてカメラを起動、またはファイルを選択</p>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={handleCapture} 
              className="hidden-input"
            />
          </label>
        </div>
      )}

      {/* ステップ 2 */}
      {step === 2 && rawImage && (
        <div className="panel fade-in">
          <h2>2. 四隅をタップ（{corners.length}/4）</h2>
          <p>半紙の<strong>左上 → 右上 → 右下 → 左下</strong>の順番でタップ。{corners.length === 4 && <><br /><span className="drag-hint">ピンをドラッグして微調整できます。</span></>}</p>
          
          <div
            className="image-picker-container"
            ref={imageContainerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img src={rawImage} alt="raw" onClick={handleImageClick} draggable={false} />

            {/* 4点指定後のオーバーレイ（選択範囲外を暗く表示） */}
            {corners.length === 4 && (
              <svg className="selection-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <mask id="selection-mask">
                    <rect x="0" y="0" width="100" height="100" fill="white" />
                    <polygon
                      points={corners.map(c => `${c.x * 100},${c.y * 100}`).join(' ')}
                      fill="black"
                    />
                  </mask>
                </defs>
                {/* 枠線: 選択範囲のアウトライン */}
                <polygon
                  points={corners.map(c => `${c.x * 100},${c.y * 100}`).join(' ')}
                  fill="none"
                  stroke="rgba(224,60,49,0.8)"
                  strokeWidth="0.3"
                  vectorEffect="non-scaling-stroke"
                />
                {/* 暗いオーバーレイ（選択範囲の穴あき） */}
                <rect
                  x="0" y="0" width="100" height="100"
                  fill="rgba(0,0,0,0.55)"
                  mask="url(#selection-mask)"
                />
              </svg>
            )}

            {/* コーナーピン（4点揃ったらドラッグ可能） */}
            {corners.map((c, index) => (
              <div
                key={index}
                className={`corner-pin ${corners.length === 4 ? 'draggable' : ''} ${draggingIndex === index ? 'dragging' : ''}`}
                style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                onPointerDown={corners.length === 4 ? (e) => handlePinPointerDown(e, index) : undefined}
              >
                <span>{index + 1}</span>
              </div>
            ))}
          </div>

          <div className="action-buttons center">
            <button onClick={() => setCorners([])}>
              <RefreshIcon /> やり直す
            </button>
            <button 
              onClick={executeTransform} 
              disabled={corners.length !== 4 || !isCvReady}
              className="primary-btn"
            >
              <CheckIcon /> {!isCvReady ? "準備中..." : "切り取りを実行"}
            </button>
          </div>
        </div>
      )}

      {/* ステップ 3 */}
      <div className="panel fade-in" style={{ display: step >= 3 && step !== 4 ? 'block' : 'none' }}>
        <h2>3. 補正結果と色調整</h2>
        <canvas ref={processedCanvasRef} />
        
        {step === 3 && (
          <div className="control-panel fade-in">
            <div className="options-grid">
              <div 
                className={`option-card ${!isInverted ? 'active' : ''}`}
                onClick={isInverted ? toggleInvert : undefined}
              >
                <div className="serif-text" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>白背景</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>墨文字 × 白背景</div>
              </div>
              <div 
                className={`option-card ${isInverted ? 'active' : ''}`}
                onClick={!isInverted ? toggleInvert : undefined}
              >
                <div className="serif-text" style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#fff' }}>黒背景</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>白文字 × 黒背景</div>
              </div>
            </div>

            <div className="action-buttons center">
              <button onClick={() => downloadImage(processedCanvasRef.current, isInverted ? 'shuji-black.jpg' : 'shuji-white.jpg')} className="primary-btn">
                <DownloadIcon /> 保存する
              </button>
              {canShare && (
                <button onClick={() => shareImage(processedCanvasRef.current, isInverted ? 'shuji-black.jpg' : 'shuji-white.jpg')}>
                  <ShareIcon /> 共有する
                </button>
              )}
              <button onClick={() => {
                setRawImage(null);
                setStep(1);
              }}>
                <RefreshIcon /> 最初から
              </button>
            </div>
            
            <hr />
            
            <p style={{ textAlign: 'center', marginBottom: '1rem' }}>または、好きな背景画像と合成する</p>
            <label className="upload-area" style={{ padding: '1.5rem' }}>
              <ImageIcon />
              <span>背景画像を選択</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleCompositeImageSelect} 
                className="hidden-input"
              />
            </label>
          </div>
        )}
      </div>

      {/* ステップ 4 */}
      <div className="panel fade-in" style={{ display: step === 4 ? 'block' : 'none' }}>
        <h2>4. 合成結果</h2>

        <div className="options-grid">
          <div 
            className={`option-card ${compositeStyle === 'normal' ? 'active' : ''}`}
            onClick={() => setCompositeStyle('normal')}
          >
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>標準ブレンド</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {isInverted ? '写真文字 × 黒背景' : '墨文字 × 背景写真'}
            </div>
          </div>
          <div 
            className={`option-card ${compositeStyle === 'clip' ? 'active' : ''}`}
            onClick={() => setCompositeStyle('clip')}
          >
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>クリップブレンド</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {isInverted ? '白文字 × 背景写真' : '写真文字 × 白背景'}
            </div>
          </div>
        </div>

        <canvas ref={compositeCanvasRef} />
        
        <div className="action-buttons center">
          <button onClick={() => downloadImage(compositeCanvasRef.current, 'shuji-composite.jpg')} className="primary-btn">
            <DownloadIcon /> 合成画像を保存
          </button>
          {canShare && (
            <button onClick={() => shareImage(compositeCanvasRef.current, 'shuji-composite.jpg')}>
              <ShareIcon /> 共有する
            </button>
          )}
          <button onClick={() => setStep(3)}>
            <RefreshIcon /> やり直す
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;