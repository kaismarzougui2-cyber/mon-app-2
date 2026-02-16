import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Layers, Type, Sliders, Trash2, ArrowRight, Check, Scissors, User, FileArchive } from 'lucide-react';

// Importation des polices Google Fonts
const GoogleFonts = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&family=Anton&family=Inter:wght@900&family=Oswald:wght@700&family=Roboto+Condensed:wght@700&display=swap');
  `}} />
);

/**
 * Composant de rendu pour une diapositive individuelle
 */
const SlideCanvas = ({ text, index, fontSize, fontFamily, signature, onCanvasReady }) => {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Résolution Standard Réseaux Sociaux (1080x1080)
    canvas.width = 1080;
    canvas.height = 1080;

    // Fond Blanc
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Rendu de la Signature (Nouveauté) ---
    if (signature && signature.trim() !== "") {
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'center';
      ctx.font = `bold 35px sans-serif`;
      ctx.fillText(signature.toUpperCase(), canvas.width / 2, canvas.height - 120);
      
      // Petite ligne décorative au dessus de la signature
      ctx.strokeStyle = '#EEEEEE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 100, canvas.height - 145);
      ctx.lineTo(canvas.width / 2 + 100, canvas.height - 145);
      ctx.stroke();
    }

    // --- Rendu du Texte Principal ---
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    
    const upperText = text.toUpperCase();
    const words = upperText.split(' ');
    const maxWidth = 880;
    const lineHeight = fontSize * 1.15;
    let lines = [];
    let currentLine = '';

    words.forEach(word => {
      let testLine = currentLine + word + ' ';
      if (ctx.measureText(testLine).width > maxWidth) {
        lines.push(currentLine);
        currentLine = word + ' ';
      } else {
        currentLine = testLine;
      }
    });
    lines.push(currentLine);

    const totalHeight = lines.length * lineHeight;
    let startY = (canvas.height - totalHeight) / 2 + (lineHeight / 2);

    lines.forEach((line, i) => {
      ctx.fillText(line.trim(), canvas.width / 2, startY + (i * lineHeight));
    });

    // Numéro de page
    ctx.font = `bold 24px sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.fillText(`${index + 1}`, canvas.width / 2, canvas.height - 60);

    // Notifier le parent que le canvas est prêt pour l'export
    if (onCanvasReady) onCanvasReady(canvas, index);
  }, [text, fontSize, fontFamily, signature, index, onCanvasReady]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="relative group bg-white p-2 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      <canvas 
        ref={canvasRef} 
        className="w-full aspect-square rounded-xl shadow-inner"
      />
      <div className="absolute top-6 left-6 bg-black text-white text-[10px] font-black px-2 py-1 rounded tracking-widest">
        SLIDE {index + 1}
      </div>
    </div>
  );
};

export default function App() {
  const [rawText, setRawText] = useState("BIENVENUE SUR VOTRE GÉNÉRATEUR.\n\nUTILISEZ LE BOUTON SMART SPLIT POUR DÉCOUPER UN LONG TEXTE.\n\nCHAQUE SLIDE EST AUTOMATIQUEMENT EN MAJUSCULE.\n\nLA SIGNATURE APPARAÎT EN BAS DE CHAQUE PAGE.");
  const [signature, setSignature] = useState("VOTRE NOM / MARQUE");
  const [fontSize, setFontSize] = useState(85);
  const [fontFamily, setFontFamily] = useState("'Montserrat', sans-serif");
  const [slides, setSlides] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const canvasMap = useRef({});

  // Chargement de JSZip pour l'export
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Découpage par défaut (double saut de ligne)
  useEffect(() => {
    const chunks = rawText
      .split(/\n\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    setSlides(chunks);
  }, [rawText]);

  /**
   * Fonction Smart Split (Nouveauté)
   * Découpe intelligemment le texte en morceaux de ~225 caractères
   */
  const handleSmartSplit = () => {
    const text = rawText.replace(/\n/g, ' ').trim();
    const limit = 220; // Seuil idéal pour une slide
    let chunks = [];
    let remainingText = text;

    while (remainingText.length > 0) {
      if (remainingText.length <= limit) {
        chunks.push(remainingText);
        break;
      }

      // Chercher le meilleur point de coupe (ponctuation d'abord, sinon espace)
      let splitIndex = -1;
      const lookbackRange = remainingText.substring(0, limit + 20);
      
      // Priorité : Points, points d'interrogation, exclamation
      const punctMatch = lookbackRange.match(/[.!?](?!.*[.!?])/);
      if (punctMatch && punctMatch.index > limit / 2) {
        splitIndex = punctMatch.index + 1;
      } else {
        // Sinon, simple espace le plus proche de la limite
        splitIndex = remainingText.lastIndexOf(' ', limit);
      }

      if (splitIndex === -1) splitIndex = limit; // Failover

      chunks.push(remainingText.substring(0, splitIndex).trim());
      remainingText = remainingText.substring(splitIndex).trim();
    }

    setRawText(chunks.join("\n\n"));
  };

  /**
   * Export ZIP corrigé (Nouveauté)
   */
  const downloadAsZip = async () => {
    if (typeof window.JSZip === 'undefined') {
      alert("La bibliothèque d'export est encore en cours de chargement. Réessayez dans une seconde.");
      return;
    }

    setIsExporting(true);
    try {
      const zip = new window.JSZip();
      const folder = zip.folder("mon_carrousel");

      // On récupère les données de chaque canvas
      const promises = Object.values(canvasMap.current).map(async (canvas, i) => {
        return new Promise((resolve) => {
          canvas.toBlob((blob) => {
            folder.file(`slide-${i + 1}.png`, blob);
            resolve();
          }, 'image/png');
        });
      });

      await Promise.all(promises);
      const content = await zip.generateAsync({ type: "blob" });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `carrousel-${Date.now()}.zip`;
      link.click();
    } catch (err) {
      console.error("Erreur export:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const fonts = [
    { name: 'Montserrat (Gras)', value: "'Montserrat', sans-serif" },
    { name: 'Anton (Impact)', value: "'Anton', sans-serif" },
    { name: 'Oswald (Compact)', value: "'Oswald', sans-serif" },
    { name: 'Roboto Condensed', value: "'Roboto Condensed', sans-serif" }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <GoogleFonts />
      
      {/* Barre de navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-black p-2 rounded-xl">
              <Layers className="text-white" size={24} />
            </div>
            <span className="font-black text-2xl tracking-tighter uppercase">CarrouselPro</span>
          </div>
          
          <button 
            onClick={downloadAsZip}
            disabled={slides.length === 0 || isExporting}
            className="bg-black text-white px-8 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-zinc-800 disabled:opacity-30 transition-all shadow-xl shadow-black/10"
          >
            {isExporting ? (
              <span className="animate-pulse">Génération du ZIP...</span>
            ) : (
              <><FileArchive size={18} /> Télécharger ZIP ({slides.length} images)</>
            )}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Colonne de gauche : Configuration */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Section Contenu */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold uppercase tracking-widest text-xs text-slate-400">Contenu</h2>
              <button 
                onClick={handleSmartSplit}
                className="flex items-center gap-1.5 text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
              >
                <Scissors size={12} /> SMART SPLIT
              </button>
            </div>
            
            <div className="space-y-4">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Collez votre texte ici..."
                className="w-full h-72 p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-black outline-none transition-all font-medium text-slate-800 leading-relaxed"
              />
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <User size={12} /> Nom / Signature
                </label>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Votre nom ou @pseudo"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-black outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section Style */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 space-y-6">
            <h2 className="font-bold uppercase tracking-widest text-xs text-slate-400">Apparence</h2>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold">Taille du texte</label>
                  <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{fontSize}px</span>
                </div>
                <input 
                  type="range" min="40" max="160" 
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-black" 
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold">Police Google</label>
                <select 
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-black font-bold transition-all appearance-none"
                >
                  {fonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne de droite : Aperçu du Carrousel */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-black text-3xl uppercase tracking-tighter">Aperçu en grille</h2>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-500 uppercase">{slides.length} Slides prêtes</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {slides.map((slide, index) => (
              <SlideCanvas 
                key={`${index}-${fontFamily}-${fontSize}-${signature}`} 
                text={slide} 
                index={index} 
                fontSize={fontSize}
                fontFamily={fontFamily}
                signature={signature}
                onCanvasReady={(canvas, idx) => {
                  canvasMap.current[idx] = canvas;
                }}
              />
            ))}
            
            {slides.length === 0 && (
              <div className="col-span-full bg-white border-4 border-dashed border-slate-200 rounded-[3rem] h-[500px] flex flex-col items-center justify-center text-slate-300 space-y-4">
                <Type size={64} strokeWidth={1} />
                <p className="font-bold text-xl uppercase tracking-widest">En attente de texte...</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
