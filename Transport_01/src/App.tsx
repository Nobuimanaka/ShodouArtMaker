import { useState, useRef, useEffect, useMemo } from 'react';
import { OpenCVScannerAdapter, type Point } from './utils/cvAdapter';
import { NormalBlendStrategy, ClipBlendStrategy, type ICompositionStrategy } from './utils/compositionStrategy';
import './App.css';

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
      <h1>書道Artmaker</h1>

      {/* ステップ 1 */}
      {step === 1 && (
        <div className="step-section">
          <h2>1. 作品を撮影してください</h2>
          <input type="file" accept="image/*" capture="environment" onChange={handleCapture} />
        </div>
      )}

      {/* ステップ 2 */}
      {step === 2 && rawImage && (
        <div className="step-section">
          <h2>2. 半紙の四隅をタップしてください（{corners.length}/4）</h2>
          <p className="hint-text">左上 → 右上 → 右下 → 左下 の順番でタップすると綺麗に切り取れます。</p>
          
          <div className="image-picker-container">
            <img src={rawImage} alt="raw" onClick={handleImageClick} />
            {corners.map((c, index) => (
              <div key={index} className="corner-pin" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}>
                <span>{index + 1}</span>
              </div>
            ))}
          </div>

          <div className="action-buttons">
            <button onClick={() => setCorners([])}>やり直す</button>
            <button 
              onClick={executeTransform} 
              disabled={corners.length !== 4 || !isCvReady}
              className="primary-btn"
            >
              {!isCvReady ? "OpenCVを準備中..." : "変形を実行"}
            </button>
          </div>
        </div>
      )}

      {/* ステップ 3 */}
      <div className="step-section" style={{ display: step >= 3 ? 'block' : 'none' }}>
        <h2>3. 補正結果の確認</h2>
        <canvas ref={processedCanvasRef} />
        
        {step === 3 && (
          <div className="control-panel">
            <div className="panel-section">
              <p className="panel-title">色の調整と保存</p>
              <div className="action-buttons">
                <button onClick={toggleInvert} className={isInverted ? "btn-inverted active" : "btn-inverted"}>
                  {isInverted ? '🔄 白背景に戻す' : '🔄 黒背景に反転'}
                </button>
                <button onClick={() => downloadImage(processedCanvasRef.current, isInverted ? 'shuji-black.jpg' : 'shuji-white.jpg')}>
                  このまま保存する
                </button>
              </div>
            </div>
            
            <hr />
            
            <div className="panel-section">
              <p className="panel-title">好きな背景と合成する場合（オプション）</p>
              <input type="file" accept="image/*" onChange={handleCompositeImageSelect} />
            </div>
          </div>
        )}
      </div>

      {/* ステップ 4 */}
      <div className="step-section" style={{ display: step === 4 ? 'block' : 'none' }}>
        <h2>4. 合成完了！</h2>

        <div className="action-buttons center">
          <button 
            onClick={() => setCompositeStyle('normal')}
            className={compositeStyle === 'normal' ? "" : "dimmed"}
          >
            {compositeStyle === 'normal' ? '✅ ' : ''}
            {isInverted ? '写真文字 × 黒背景' : '墨文字 × 背景写真'}
          </button>
          <button 
            onClick={() => setCompositeStyle('clip')}
            className={compositeStyle === 'clip' ? "" : "dimmed"}
          >
            {compositeStyle === 'clip' ? '✅ ' : ''}
            {isInverted ? '白文字 × 背景写真' : '写真文字 × 白背景'}
          </button>
        </div>

        <canvas ref={compositeCanvasRef} />
        
        <div className="action-buttons center" style={{ marginTop: '15px' }}>
          <button onClick={() => downloadImage(compositeCanvasRef.current, 'shuji-composite.jpg')} className="primary-btn">
            合成画像を保存する
          </button>
          <button onClick={() => setStep(3)}>
            やり直す
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;