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
    const rect = e.currentTarget.getBoundingClientRect();
    setCorners([...corners, {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    }]);
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

  const downloadImage = (canvas: HTMLCanvasElement | null, fileName: string) => {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  return (
    <div className="app-container">
      <h1 className="serif-text">書道Artmaker</h1>

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
          <p>半紙の<strong>左上 → 右上 → 右下 → 左下</strong>の順番でタップすると、自動で綺麗に切り取られます。</p>
          
          <div className="image-picker-container">
            <img src={rawImage} alt="raw" onClick={handleImageClick} />
            {corners.map((c, index) => (
              <div key={index} className="corner-pin" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}>
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
          <button onClick={() => setStep(3)}>
            <RefreshIcon /> やり直す
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;